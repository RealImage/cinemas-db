import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormActions } from "@/components/ui/form-actions";
import { QueryState } from "@/components/ui/query-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCredentialDevices } from "@/hooks/api/credentials";
import { useChainSystems, useSetChainTms } from "@/hooks/api/chains";
import { common } from "@/i18n/common";
import type { ChainDetails, ChainSystems } from "@/data/chainDetails";

/**
 * The TMSes a chain's theatres may use, from Devices Master › Credentials Manager (type TMS). A theatre's TMS
 * dropdown lists only these.
 */
function ChainTmsEditor({ chain }: { chain: ChainDetails }) {
  const devices = useCredentialDevices();
  const save = useSetChainTms();
  const saved = (chain.tms ?? []).map((t) => t.id);
  const [selected, setSelected] = useState<string[]>(saved);
  const savedKey = saved.join(",");

  useEffect(() => {
    setSelected(savedKey ? savedKey.split(",") : []);
  }, [savedKey]);

  const tms = (devices.data ?? [])
    .filter((d) => d.type === "TMS")
    .sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));
  const dirty = [...selected].sort().join(",") !== [...saved].sort().join(",");

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const handleSave = () => {
    save.mutate({ id: chain.id, deviceIds: selected }, {
      onSuccess: () => toast.success(`Updated Theatre Management Systems for ${chain.name}`),
      onError: (err) => toast.error(`Could not update ${chain.name}: ${err.message}`),
    });
  };

  return (
    <Card className="space-y-3 p-5">
      <div>
        <h3 id="chain-tms-heading" className="text-base font-semibold">Theatre Management Systems</h3>
        <p className="text-sm text-muted-foreground">The TMSes theatres in {chain.name} can use. A theatre's TMS can only be one of these.</p>
      </div>
      <div role="group" aria-labelledby="chain-tms-heading" className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto rounded-md border p-2 md:grid-cols-2">
        {devices.isPending && <p className="p-2 text-sm text-muted-foreground">Loading TMSes…</p>}
        {devices.isError && <p className="p-2 text-sm text-red-500">Could not load TMSes: {devices.error.message}</p>}
        {devices.data && tms.length === 0 && (
          <p className="p-2 text-sm text-muted-foreground">No TMS in the Credentials Manager yet. Add one there with type TMS.</p>
        )}
        {tms.map((d) => {
          const name = d.model.toLowerCase() === d.brand.toLowerCase() ? d.brand : `${d.brand} ${d.model}`;
          return (
            <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-black/[.03]">
              <Checkbox checked={selected.includes(d.id)} onCheckedChange={() => toggle(d.id)} />
              <span>{name}</span>
            </label>
          );
        })}
      </div>
      <FormActions>
        <Button variant="outline" onClick={() => setSelected(saved)} disabled={!dirty || save.isPending}>{common.cancel}</Button>
        <Button onClick={handleSave} loading={save.isPending} disabled={!devices.data || !dirty}>{common.save}</Button>
      </FormActions>
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

const InUse = ({ systems }: { systems: ChainSystems }) => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <CountTable
      title="TMS in use" nameHeader="Theatre Management System" empty="No theatre has a TMS set"
      notSet={systems.theatresWithoutTms}
      rows={systems.tmsInUse.map((t) => ({
        key: t.id, theatres: t.theatres,
        name: t.allowed ? t.name : (
          <span className="inline-flex items-center gap-1">
            {t.name}
            <span className="inline-flex items-center gap-1 text-xs text-amber-700">
              <AlertTriangle className="h-3 w-3" aria-hidden /> Not linked to this chain
            </span>
          </span>
        ),
      }))}
    />
    <CountTable
      title="POS / ticketing systems in use" nameHeader="Ticketing System" empty="No theatre has a ticketing system set"
      notSet={systems.theatresWithoutTicketing}
      rows={systems.ticketingInUse.map((t) => ({ key: t.id, name: t.name, theatres: t.theatres }))}
    />
    <div className="lg:col-span-2">
      <CountTable
        title="Content delivery modes in use" nameHeader="Mode · Method" empty="No theatre has a DCP delivery method set"
        rows={systems.deliveryModes.map((m) => ({
          key: `${m.mode}:${m.method}`, theatres: m.theatres,
          name: m.mode === "Modem" ? "Modem" : <><span className="font-medium">{m.mode}</span> · {m.method}</>,
        }))}
      />
    </div>
  </div>
);

export function ChainSystemsTab({ chain }: { chain: ChainDetails }) {
  const systems = useChainSystems(chain.id);
  return (
    <div className="space-y-4">
      <ChainTmsEditor chain={chain} />
      <QueryState query={systems} label="theatre systems">
        {(s) => (
          <>
            <p className="text-sm text-muted-foreground">
              In use across the chain's {s.theatreCount} {s.theatreCount === 1 ? "theatre" : "theatres"}
            </p>
            <InUse systems={s} />
          </>
        )}
      </QueryState>
    </div>
  );
}
