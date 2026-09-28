import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QubeAcsScreenDevice } from "@/data/qubeAcsData";
import { cn } from "@/lib/utils";
import { common } from "@/i18n/common";

type Status = "Active" | "Device Paused" | "Inactive";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  screen: QubeAcsScreenDevice | null;
  onSave: (patch: Partial<QubeAcsScreenDevice>) => void;
}

export const EditScreenDeviceDialog = ({ open, onOpenChange, screen, onSave }: Props) => {
  const [form, setForm] = useState<QubeAcsScreenDevice | null>(screen);

  useEffect(() => { setForm(screen); }, [screen, open]);

  if (!form) return null;

  const upd = (patch: Partial<QubeAcsScreenDevice>) => setForm((f) => f ? { ...f, ...patch } : f);

  const handleSave = () => {
    onSave({
      screenNetworkId: form.screenNetworkId,
      screenNetworkPassword: form.screenNetworkPassword,
      applianceId: form.applianceId,
      cmSerialNumber: form.cmSerialNumber,
      ipAddress: form.ipAddress,
      status: form.status,
      hasDevice: form.status !== "Inactive" ? true : form.hasDevice,
      installedDate: form.installedDate,
      installedBy: form.installedBy,
      comments: form.comments,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Screen Device — {form.screenName}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Screen Name</Label>
            <p className="text-sm font-medium h-10 flex items-center">{form.screenName}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Screen ID</Label>
            <p className="text-sm font-medium h-10 flex items-center">{form.screenId}</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="snid" className="text-xs">Screen Network ID</Label>
            <Input id="snid" value={form.screenNetworkId ?? ""} onChange={(e) => upd({ screenNetworkId: e.target.value })} placeholder="Enter Network ID" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="snpw" className="text-xs">Screen Network Password</Label>
            <Input id="snpw" type="password" value={form.screenNetworkPassword ?? ""} onChange={(e) => upd({ screenNetworkPassword: e.target.value })} placeholder="Enter Password" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="appId" className="text-xs">Qube ACS Appliance ID</Label>
            <Input id="appId" value={form.applianceId ?? ""} onChange={(e) => upd({ applianceId: e.target.value })} placeholder="QACS-XXXXX" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cm" className="text-xs">Qube ACS CM Serial Number</Label>
            <Input id="cm" value={form.cmSerialNumber ?? ""} onChange={(e) => upd({ cmSerialNumber: e.target.value })} placeholder="CM-XXXXX" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="ip" className="text-xs">Device IP Address</Label>
            <Input
              id="ip"
              value={form.ipAddress ?? ""}
              onChange={(e) => upd({ ipAddress: e.target.value })}
              placeholder="192.168.1.10"
              pattern="^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v: Status) => upd({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Device Paused">Device Paused</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Installed Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.installedDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.installedDate ? format(new Date(form.installedDate), "dd MMM yyyy") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[60]" align="start">
                <Calendar mode="single" selected={form.installedDate ? new Date(form.installedDate) : undefined}
                  onSelect={(d) => upd({ installedDate: d?.toISOString() })}
                  initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label htmlFor="instBy" className="text-xs">Installed By</Label>
            <Input id="instBy" value={form.installedBy ?? ""} onChange={(e) => upd({ installedBy: e.target.value })} placeholder="Name" />
          </div>
        </div>

        <div className="space-y-1 py-2">
          <Label htmlFor="comments" className="text-xs">Comments</Label>
          <Textarea id="comments" value={form.comments ?? ""} onChange={(e) => upd({ comments: e.target.value })} placeholder="Enter any comments about this screen device..." className="min-h-[80px]" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{common.cancel}</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditScreenDeviceDialog;