import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { FlmFeed } from "@/data/flmFeedsData";
import { useToast } from "@/hooks/use-toast";
import { useMapFlmThirdPartyId } from "@/hooks/api/flm";
import { common } from "@/i18n/common";

const domainOptions = [
  "amcnetworks.com",
  "cinemacloudworks.com",
  "cinemadb.io",
  "cinemark.com",
  "dcddistribution.com",
  "disney.com",
  "eikon.group",
  "emick.com",
  "fathomevents.com",
  "maccs.com",
  "metameida.global",
  "nbcuniversal.com",
  "rentrak.com",
  "technicolor.com",
  "vert-ent.com",
  "warnerbros.com",
  "yashrajfilms.com",
];

interface MapThirdPartyIdDialogProps {
  feed: FlmFeed | null;
  onClose: () => void;
}

export const MapThirdPartyIdDialog = ({ feed, onClose }: MapThirdPartyIdDialogProps) => {
  const { toast } = useToast();
  const [domain, setDomain] = useState("");
  const [identifier, setIdentifier] = useState("");

  const mapId = useMapFlmThirdPartyId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feed) return;
    try {
      const result = await mapId.mutateAsync({ feedId: feed.id, domain, externalId: identifier.trim() });
      toast({
        title: "Third-party ID mapped",
        description: result.mappedTo === "theatre"
          ? `${domain}:${identifier} mapped to ${feed.theatreName}.`
          : `${domain}:${identifier} saved; it will be added to the theatre when this feed is mapped.`,
      });
      setDomain("");
      setIdentifier("");
      onClose();
    } catch (err) {
      toast({ title: "Could not map ID", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={!!feed} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Map Third Party ID</DialogTitle>
          <DialogDescription>
            Map a third-party identifier to <span className="font-medium">{feed?.theatreName}</span>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Feed Theatre ID</Label>
              <Input value={feed?.theatreIdFeed ?? ""} readOnly disabled className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flm-domain">Domain</Label>
              <Combobox
                id="flm-domain"
                value={domain}
                onChange={(value) => setDomain(value ?? "")}
                options={domainOptions.map((d) => ({ value: d, label: d }))}
                placeholder="Select domain"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flm-id">ID</Label>
              <Input
                id="flm-id"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter ID"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{common.cancel}</Button>
            <Button type="submit" disabled={!domain || !identifier.trim()} loading={mapId.isPending}>
              {common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
