import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { Button, ACTION_BUTTONS } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { common } from "@/i18n/common";
import { chainKeys, useUpdateChain } from "@/hooks/api/chains";
import { useUpdateTheatre } from "@/hooks/api/theatres";
import type { ArgusProposal } from "@/data/argus";
import type { ChainDetails } from "@/data/chainDetails";
import { useArgus, type ProposalState } from "./argusState";

const shown = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

const Value = ({ value, was }: { value: unknown; was?: boolean }) => {
  const text = shown(value);
  if (text === null) return <span className="italic text-muted-foreground">empty</span>;
  return <span className={cn("[overflow-wrap:anywhere]", was && "text-muted-foreground line-through")}>{text}</span>;
};

/**
 * A change Argus proposed, as field: old → new. Save applies it through the entity's own update (the same
 * endpoint and query invalidation as its edit page), so validation and change logs stay in one place.
 */
export function ArgusProposalCard({ proposal }: { proposal: ArgusProposal & { state: ProposalState } }) {
  const { setProposalState } = useArgus();
  const qc = useQueryClient();
  const updateTheatre = useUpdateTheatre();
  const updateChain = useUpdateChain();
  const { state } = proposal;
  const changes = Object.fromEntries(proposal.changes.map((c) => [c.field, c.to]));

  const apply = async () => {
    setProposalState(proposal.id, { status: "applying" });
    try {
      if (proposal.kind === "theatre") {
        // PUT /theatres/:id takes a partial update
        await updateTheatre.mutateAsync({ id: proposal.targetId, ...changes });
      } else {
        // PUT /chains/:id replaces Basic and Contact Information, so start from the chain as it is now
        const chain = await qc.fetchQuery({
          queryKey: chainKeys.detail(proposal.targetId),
          queryFn: () => api.get<ChainDetails>(`/chains/${proposal.targetId}`),
        });
        const { name, displayName, cityId, postalCode, area, headOfficeAddress, emails, phones, owners } = chain;
        await updateChain.mutateAsync({
          id: proposal.targetId, name, displayName, cityId, postalCode, area, headOfficeAddress, emails, phones, owners, ...changes,
        });
      }
      setProposalState(proposal.id, { status: "applied" });
    } catch (err) {
      setProposalState(proposal.id, { status: "error", error: err instanceof Error ? err.message : "Couldn't save the change" });
    }
  };

  const link = proposal.kind === "theatre" ? `/theatre/${proposal.targetId}/edit` : `/chains/${proposal.targetId}`;
  const done = state.status === "applied" || state.status === "dismissed";

  return (
    <div className={cn("rounded-lg border bg-card shadow-sm", done && "bg-grey-10")}>
      <div className="flex items-start justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Proposed {proposal.kind} update</p>
          <Link to={link} className="text-sm font-medium text-blue-700 underline-offset-2 hover:underline [overflow-wrap:anywhere]">
            {proposal.targetName}
          </Link>
        </div>
        {state.status === "applied" && <Badge variant="positive"><Check className="h-3 w-3" aria-hidden />Applied</Badge>}
        {state.status === "dismissed" && <Badge variant="secondary">Cancelled</Badge>}
      </div>
      <div className="space-y-2 px-3 py-2">
        {proposal.summary && <p className="text-sm">{proposal.summary}</p>}
        <dl className="space-y-1.5">
          {proposal.changes.map((c) => (
            <div key={c.field} className="text-sm">
              <dt className="text-xs text-muted-foreground">{c.label}</dt>
              <dd className="flex flex-wrap items-center gap-x-1.5">
                <Value value={c.from} was />
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="changes to" />
                <Value value={c.to} />
              </dd>
            </div>
          ))}
        </dl>
        {state.status === "error" && <p className="text-xs text-red-500" role="alert">{state.error}</p>}
      </div>
      {!done && (
        <div className={cn("flex justify-end gap-2 border-t px-3 py-2", ACTION_BUTTONS)}>
          <Button variant="outline" disabled={state.status === "applying"} onClick={() => setProposalState(proposal.id, { status: "dismissed" })}>
            {common.cancel}
          </Button>
          <Button loading={state.status === "applying"} onClick={apply}>{common.save}</Button>
        </div>
      )}
    </div>
  );
}
