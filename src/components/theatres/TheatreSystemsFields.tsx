import { useEffect, useRef } from "react";
import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheatreSystemOptions } from "@/hooks/api/theatres";

const NONE = "none";

type Option = { id: string; name: string };

/** A dropdown of Credentials Manager entries, defaulting to None. Keeps a saved value selectable if it's no longer listed. */
function SystemSelect({
  id, label, value, currentName, options, onChange, disabled, info, note,
}: {
  id: string;
  label: string;
  value: string | null | undefined;
  currentName?: string | null;
  options: Option[] | undefined;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  info: string;
  note?: string;
}) {
  const listed = options ?? [];
  const extra = value && !listed.some((o) => o.id === value) ? [{ id: value, name: `${currentName ?? value} (not linked)` }] : [];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" aria-label={`About ${label}`} className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">{info}</TooltipContent>
        </Tooltip>
      </div>
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>None</SelectItem>
          {[...extra, ...listed].map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/**
 * The theatre's Theatre Management System and Ticketing System, picked from the Credentials Manager. Only the ones
 * approved for the theatre's chain are offered, so a wrong system can't be mapped; changing the chain clears one
 * the new chain doesn't have.
 */
export function TheatreSystemsFields({
  chainId, chainName, tmsId, tmsName, ticketingSystemId, ticketingSystemName, onChange,
}: {
  chainId?: string;
  chainName?: string;
  tmsId?: string | null;
  tmsName?: string | null;
  ticketingSystemId?: string | null;
  ticketingSystemName?: string | null;
  onChange: (key: "tmsId" | "ticketingSystemId", value: string | null) => void;
}) {
  const options = useTheatreSystemOptions(chainId || undefined);
  const tms = options.data?.tms;
  const ticketing = options.data?.ticketing;
  // The chain whose lists the selections were last checked against; the saved systems start out as-is
  const checkedChain = useRef(chainId);

  useEffect(() => {
    if (!tms || !ticketing || chainId === checkedChain.current) return;
    checkedChain.current = chainId;
    if (tmsId && !tms.some((o) => o.id === tmsId)) onChange("tmsId", null);
    if (ticketingSystemId && !ticketing.some((o) => o.id === ticketingSystemId)) onChange("ticketingSystemId", null);
  }, [tms, ticketing, tmsId, ticketingSystemId, chainId, onChange]);

  const note = (list: unknown[] | undefined, noun: string) => !chainId
    ? "Choose the chain first."
    : list && list.length === 0
      ? `${chainName || "This chain"} has no ${noun} approved yet.`
      : undefined;
  const info = (plural: string, noun: string) =>
    `Only ${plural} approved for this theatre's chain are listed, so a wrong ${noun} can't be mapped. To use another, first add it to the chain: Chains › Edit › Theatre Systems.`;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <SystemSelect
        id="tmsId"
        label="Theatre Management System"
        value={tmsId}
        currentName={tmsName}
        options={tms}
        onChange={(v) => onChange("tmsId", v)}
        // Without a chain there's nothing to pick, but a saved TMS can still be cleared
        disabled={!chainId && !tmsId}
        note={note(tms, "TMS")}
        info={info("TMSes", "TMS")}
      />
      <SystemSelect
        id="ticketingSystemId"
        label="Ticketing System"
        value={ticketingSystemId}
        currentName={ticketingSystemName}
        options={ticketing}
        onChange={(v) => onChange("ticketingSystemId", v)}
        disabled={!chainId && !ticketingSystemId}
        note={note(ticketing, "ticketing system")}
        info={info("ticketing systems", "ticketing system")}
      />
    </div>
  );
}
