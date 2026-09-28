import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { cameraMakes, cameraModelsByMake, IcountCamera, CameraOwnership } from "@/data/icountData";
import { common } from "@/i18n/common";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  camera: IcountCamera | null;
  screenName?: string;
  onSave: (patch: Partial<IcountCamera>) => void;
}

export const EditIcountCameraDialog = ({ open, onOpenChange, camera, screenName, onSave }: Props) => {
  const [form, setForm] = useState<IcountCamera | null>(camera);

  useEffect(() => { setForm(camera); }, [camera, open]);

  if (!form) return null;

  const upd = (patch: Partial<IcountCamera>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const models = form.make ? cameraModelsByMake[form.make] ?? [] : [];

  const handleSave = () => {
    onSave({
      make: form.make,
      model: form.model,
      serialNumber: form.serialNumber,
      ownership: form.ownership,
      ipAddress: form.ipAddress,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{form.label}{screenName ? ` — ${screenName}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Make</Label>
            <Combobox
              aria-label="Make"
              value={form.make ?? ""}
              onChange={(v) => upd({ make: v ?? "", model: undefined })}
              options={cameraMakes.map((m) => ({ value: m, label: m }))}
              placeholder="Select make"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Model</Label>
            <Combobox
              aria-label="Model"
              value={form.model ?? ""}
              onChange={(v) => upd({ model: v ?? "" })}
              options={models.map((m) => ({ value: m, label: m }))}
              placeholder={form.make ? "Select model" : "Select a make first"}
              disabled={!form.make}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="serial" className="text-xs">Serial Number</Label>
            <Input id="serial" value={form.serialNumber ?? ""} onChange={(e) => upd({ serialNumber: e.target.value })} placeholder="Enter serial number" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ownership</Label>
            <Select value={form.ownership ?? ""} onValueChange={(v: CameraOwnership) => upd({ ownership: v })}>
              <SelectTrigger><SelectValue placeholder="Select ownership" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Theatre">Theatre</SelectItem>
                <SelectItem value="Qube">Qube</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="camip" className="text-xs">IP Address</Label>
            <Input
              id="camip"
              value={form.ipAddress ?? ""}
              onChange={(e) => upd({ ipAddress: e.target.value })}
              placeholder="192.168.1.20"
              pattern="^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{common.cancel}</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditIcountCameraDialog;
