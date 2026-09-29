import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCredentialDevices } from "@/hooks/api/credentials";
import { useSetChainTms } from "@/hooks/api/chains";
import { common } from "@/i18n/common";
import type { Chain } from "@/types";

/**
 * The TMSes a chain's theatres may use, from Devices Master › Credentials Manager (type TMS). A theatre's TMS
 * dropdown lists only these.
 */
export function ChainTmsDialog({ chain, onOpenChange }: { chain: Chain | null; onOpenChange: (open: boolean) => void }) {
  const devices = useCredentialDevices();
  const save = useSetChainTms();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (chain) setSelected((chain.tms ?? []).map((t) => t.id));
  }, [chain]);

  const tms = (devices.data ?? [])
    .filter((d) => d.type === "TMS")
    .sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const handleSave = () => {
    if (!chain) return;
    save.mutate({ id: chain.id, deviceIds: selected }, {
      onSuccess: () => { toast.success(`Updated Theatre Management Systems for ${chain.name}`); onOpenChange(false); },
      onError: (err) => toast.error(`Could not update ${chain.name}: ${err.message}`),
    });
  };

  return (
    <Dialog open={!!chain} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Theatre Management Systems</DialogTitle>
          <DialogDescription>
            The TMSes theatres in {chain?.name} can use. A theatre's TMS can only be one of these.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{common.cancel}</Button>
          <Button onClick={handleSave} loading={save.isPending} disabled={!devices.data}>{common.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
