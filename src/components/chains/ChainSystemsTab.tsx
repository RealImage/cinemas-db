import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormActions } from "@/components/ui/form-actions";
import { QueryState } from "@/components/ui/query-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCredentialDevices } from "@/hooks/api/credentials";
import { useChainSystems, useSetChainFlmSubscriptions, useSetChainSystems } from "@/hooks/api/chains";
import { common } from "@/i18n/common";
import type { ChainDetails, ChainSystemCount, ChainSystems } from "@/data/chainDetails";

type SystemKind = "TMS" | "Ticketing System";

const KINDS: Record<SystemKind, {
  title: string; noun: string; plural: string; path: "tms" | "ticketing-systems"; headingId: string;
  approved: (c: ChainDetails) => { id: string; name: string }[];
  inUse: (s: ChainSystems) => (ChainSystemCount & { allowed: boolean })[];
  notSet: (s: ChainSystems) => number;
}> = {
  TMS: {
    title: "Theatre Management Systems", noun: "TMS", plural: "TMSes", path: "tms", headingId: "chain-tms-heading",
    approved: (c) => c.tms ?? [], inUse: (s) => s.tmsInUse, notSet: (s) => s.theatresWithoutTms,
  },
  "Ticketing System": {
    title: "POS / Ticketing Systems", noun: "ticketing system", plural: "ticketing systems", path: "ticketing-systems",
    headingId: "chain-ticketing-heading",
    approved: (c) => c.ticketingSystems ?? [], inUse: (s) => s.ticketingInUse, notSet: (s) => s.theatresWithoutTicketing,
  },
};

/**
 * The TMSes (or ticketing systems) approved for a chain, with how many of its theatres use each. A theatre's
 * dropdown lists only these. Edit adds or removes them, from Devices Master › Credentials Manager entries of that type.
 */
function ChainSystemList({ chain, kind, systems }: { chain: ChainDetails; kind: SystemKind; systems: ChainSystems | undefined }) {
  const k = KINDS[kind];
  const save = useSetChainSystems(k.path);
  const [editing, setEditing] = useState(false);
  const approved = k.approved(chain);
  const saved = approved.map((t) => t.id);
  const [selected, setSelected] = useState<string[]>(saved);
  const savedKey = saved.join(",");

  useEffect(() => {
    setSelected(savedKey ? savedKey.split(",") : []);
  }, [savedKey]);

  const dirty = [...selected].sort().join(",") !== [...saved].sort().join(",");
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const cancel = () => { setSelected(saved); setEditing(false); };

  const handleSave = () => {
    save.mutate({ id: chain.id, deviceIds: selected }, {
      onSuccess: () => { toast.success(`Updated ${k.title} for ${chain.name}`); setEditing(false); },
      onError: (err) => toast.error(`Could not update ${chain.name}: ${err.message}`),
    });
  };

  const inUse = systems ? k.inUse(systems) : [];
  const count = (id: string) => inUse.find((u) => u.id === id)?.theatres ?? 0;
  // In use by a theatre but not approved (e.g. linked before the chain's list was set): shown with a warning
  const unapproved = inUse.filter((u) => !u.allowed);

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 id={k.headingId} className="text-base font-semibold">{k.title}</h3>
          <p className="text-sm text-muted-foreground">
            The {k.plural} approved for {chain.name}. A theatre's {k.noun} can only be one of these.
          </p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} aria-label={`Edit ${k.title}`}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        )}
      </div>
      {editing ? (
        <SystemPicker kind={kind} headingId={k.headingId} selected={selected} onToggle={toggle} />
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table aria-labelledby={k.headingId}>
            <TableHeader>
              <TableRow>
                <TableHead>{kind === "TMS" ? "Theatre Management System" : "Ticketing System"}</TableHead>
                <TableHead className="w-40 text-right">Theatres using it</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approved.length === 0 && unapproved.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                    No {k.plural} approved for this chain yet. Use Edit to add one.
                  </TableCell>
                </TableRow>
              )}
              {approved.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{t.name}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{systems ? count(t.id) : "…"}</TableCell>
                </TableRow>
              ))}
              {unapproved.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">
                    <span className="inline-flex items-center gap-1">
                      {t.name}
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                        <AlertTriangle className="h-3 w-3" aria-hidden /> Not approved for this chain
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{t.theatres}</TableCell>
                </TableRow>
              ))}
              {!!systems && k.notSet(systems) > 0 && (
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground">No {k.noun} set</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{k.notSet(systems)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && (
        <FormActions>
          <Button variant="outline" onClick={cancel} disabled={save.isPending}>{common.cancel}</Button>
          <Button onClick={handleSave} loading={save.isPending} disabled={!dirty}>{common.save}</Button>
        </FormActions>
      )}
    </Card>
  );
}

/** Every Credentials Manager entry of `kind`, as checkboxes. */
function SystemPicker({ kind, headingId, selected, onToggle }: {
  kind: SystemKind; headingId: string; selected: string[]; onToggle: (id: string) => void;
}) {
  const devices = useCredentialDevices();
  const options = (devices.data ?? [])
    .filter((d) => d.type === kind)
    .sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));
  const noun = KINDS[kind].noun;
  return (
    <div role="group" aria-labelledby={headingId} className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto rounded-md border p-2 md:grid-cols-2">
      {devices.isPending && <p className="p-2 text-sm text-muted-foreground">Loading {KINDS[kind].plural}…</p>}
      {devices.isError && <p className="p-2 text-sm text-red-500">Could not load {KINDS[kind].plural}: {devices.error.message}</p>}
      {devices.data && options.length === 0 && (
        <p className="p-2 text-sm text-muted-foreground">No {noun} in the Credentials Manager yet. Add one there with type {kind}.</p>
      )}
      {options.map((d) => {
        const name = d.model.toLowerCase() === d.brand.toLowerCase() ? d.brand : `${d.brand} ${d.model}`;
        return (
          <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-black/[.03]">
            <Checkbox checked={selected.includes(d.id)} onCheckedChange={() => onToggle(d.id)} />
            <span>{name}</span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * The chain's official FLM providers, with the FLM feeds received from each for its theatres. Usually one or none;
 * several are allowed, with a note. Edit picks from every FLM provider.
 */
function FlmSubscriptionList({ chain, systems }: { chain: ChainDetails; systems: ChainSystems | undefined }) {
  const save = useSetChainFlmSubscriptions();
  const [editing, setEditing] = useState(false);
  const subscriptions = systems?.flmSubscriptions ?? [];
  const saved = subscriptions.map((p) => p.id);
  const [selected, setSelected] = useState<string[]>(saved);
  const savedKey = saved.join(",");
  const headingId = "chain-flm-heading";

  useEffect(() => {
    setSelected(savedKey ? savedKey.split(",") : []);
  }, [savedKey]);

  const dirty = [...selected].sort().join(",") !== [...saved].sort().join(",");
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const cancel = () => { setSelected(saved); setEditing(false); };

  const handleSave = () => {
    save.mutate({ id: chain.id, providerIds: selected }, {
      onSuccess: () => { toast.success(`Updated FLM Subscriptions for ${chain.name}`); setEditing(false); },
      onError: (err) => toast.error(`Could not update ${chain.name}: ${err.message}`),
    });
  };

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 id={headingId} className="text-base font-semibold">FLM Subscriptions</h3>
          <p className="text-sm text-muted-foreground">The official FLM provider for {chain.name}. Usually one, or none.</p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={!systems} aria-label="Edit FLM Subscriptions">
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        )}
      </div>
      {editing ? (
        <>
          <div role="group" aria-labelledby={headingId} className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto rounded-md border p-2 md:grid-cols-2">
            {(systems?.flmProviders ?? []).map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-black/[.03]">
                <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
          {selected.length > 1 && (
            <p className="text-xs text-muted-foreground" role="status">Most chains have one official provider.</p>
          )}
        </>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table aria-labelledby={headingId}>
            <TableHeader>
              <TableRow>
                <TableHead>FLM provider</TableHead>
                <TableHead className="w-40 text-right">Feeds received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!systems && (
                <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground">…</TableCell></TableRow>
              )}
              {!!systems && subscriptions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                    No FLM provider set for this chain. Use Edit to add one.
                  </TableCell>
                </TableRow>
              )}
              {subscriptions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{p.name}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{p.feedsReceived}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && (
        <FormActions>
          <Button variant="outline" onClick={cancel} disabled={save.isPending}>{common.cancel}</Button>
          <Button onClick={handleSave} loading={save.isPending} disabled={!dirty}>{common.save}</Button>
        </FormActions>
      )}
    </Card>
  );
}

/** A read-only "name → theatres" table, with a trailing "Not set" row when some theatres have none. */
function CountTable({ title, nameHeader, rows, notSet, empty }: {
  title: string;
  nameHeader: string;
  rows: { key: string; name: React.ReactNode; theatres: number }[];
  notSet?: number;
  empty: string;
}) {
  return (
    <Card className="space-y-3 p-5">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{nameHeader}</TableHead>
              <TableHead className="w-32 text-right">Theatres</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && !notSet && (
              <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground">{empty}</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="text-sm">{r.name}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{r.theatres}</TableCell>
              </TableRow>
            ))}
            {!!notSet && (
              <TableRow>
                <TableCell className="text-sm text-muted-foreground">Not set</TableCell>
                <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{notSet}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

const DeliveryModes = ({ systems }: { systems: ChainSystems }) => (
  <CountTable
    title="Content delivery modes in use" nameHeader="Mode · Method" empty="No theatre has a DCP delivery method set"
    rows={systems.deliveryModes.map((m) => ({
      key: `${m.mode}:${m.method}`, theatres: m.theatres,
      name: m.mode === "Modem" ? "Modem" : <><span className="font-medium">{m.mode}</span> · {m.method}</>,
    }))}
  />
);

export function ChainSystemsTab({ chain }: { chain: ChainDetails }) {
  const systems = useChainSystems(chain.id);
  return (
    <div className="space-y-4">
      {systems.data && (
        <p className="text-sm text-muted-foreground">
          Across the chain's {systems.data.theatreCount} {systems.data.theatreCount === 1 ? "theatre" : "theatres"}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChainSystemList chain={chain} kind="TMS" systems={systems.data} />
        <ChainSystemList chain={chain} kind="Ticketing System" systems={systems.data} />
        <FlmSubscriptionList chain={chain} systems={systems.data} />
        <QueryState query={systems} label="content delivery modes">
          {(s) => <DeliveryModes systems={s} />}
        </QueryState>
      </div>
    </div>
  );
}
