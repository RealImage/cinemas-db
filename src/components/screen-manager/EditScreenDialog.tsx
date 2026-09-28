
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ScreenRecord } from "@/data/screenManagerData";
import { toast } from "sonner";
import { useUpdatePulseScreen } from "@/hooks/api/screenPulse";
import { common } from "@/i18n/common";

interface EditScreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screen: ScreenRecord | null;
  onSaved?: (updated: ScreenRecord) => void;
}

export const EditScreenDialog = ({ open, onOpenChange, screen, onSaved }: EditScreenDialogProps) => {
  const updateScreen = useUpdatePulseScreen();
  const [pulseInstalled, setPulseInstalled] = useState(false);
  const [pulseSerial, setPulseSerial] = useState("");
  const [pulseDate, setPulseDate] = useState<Date | undefined>();
  const [pulseBy, setPulseBy] = useState("");

  const [lionisInstalled, setLionisInstalled] = useState(false);
  const [lionisSerial, setLionisSerial] = useState("");
  const [lionisDate, setLionisDate] = useState<Date | undefined>();
  const [lionisBy, setLionisBy] = useState("");

  useEffect(() => {
    if (screen) {
      setPulseInstalled(screen.pulseInstalled);
      setPulseSerial(screen.pulseSerialNumber || "");
      setPulseDate(screen.pulseInstalledOn ? new Date(screen.pulseInstalledOn) : undefined);
      setPulseBy(screen.pulseInstalledBy || "");
      setLionisInstalled(screen.lionisInstalled);
      setLionisSerial(screen.lionisSerialNumber || "");
      setLionisDate(screen.lionisInstalledOn ? new Date(screen.lionisInstalledOn) : undefined);
      setLionisBy(screen.lionisInstalledBy || "");
    }
  }, [screen]);

  const handleSave = () => {
    if (!screen) return;
    updateScreen.mutate(
      {
        id: screen.id,
        pulseInstalled,
        pulseSerialNumber: pulseInstalled ? pulseSerial : undefined,
        pulseInstalledOn: pulseInstalled && pulseDate ? pulseDate.toISOString() : undefined,
        pulseInstalledBy: pulseInstalled ? pulseBy : undefined,
        lionisInstalled,
        lionisSerialNumber: lionisInstalled ? lionisSerial : undefined,
        lionisInstalledOn: lionisInstalled && lionisDate ? lionisDate.toISOString() : undefined,
        lionisInstalledBy: lionisInstalled ? lionisBy : undefined,
      },
      {
        onSuccess: (updated) => {
          toast.success("Screen updated successfully");
          onSaved?.(updated);
          onOpenChange(false);
        },
        onError: (err) => toast.error(`Could not update screen: ${err.message}`),
      },
    );
  };

  if (!screen) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Screen — {screen.screenName}</DialogTitle>
          <p className="text-sm text-muted-foreground">{screen.theatreName}</p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Pulse Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Pulse Installation</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Installation Status</Label>
                <Select value={pulseInstalled ? "yes" : "no"} onValueChange={(v) => setPulseInstalled(v === "yes")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {pulseInstalled && (
                <div className="space-y-2">
                  <Label>Device Serial Number</Label>
                  <Input value={pulseSerial} onChange={(e) => setPulseSerial(e.target.value)} placeholder="Enter serial number" />
                </div>
              )}
            </div>
            {pulseInstalled && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Installed On</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !pulseDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {pulseDate ? format(pulseDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={pulseDate} onSelect={setPulseDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Installed By</Label>
                  <Input value={pulseBy} onChange={(e) => setPulseBy(e.target.value)} placeholder="Enter name" />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Lionis Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Lionis Installation</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Installation Status</Label>
                <Select value={lionisInstalled ? "yes" : "no"} onValueChange={(v) => setLionisInstalled(v === "yes")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {lionisInstalled && (
                <div className="space-y-2">
                  <Label>Device Serial Number</Label>
                  <Input value={lionisSerial} onChange={(e) => setLionisSerial(e.target.value)} placeholder="Enter serial number" />
                </div>
              )}
            </div>
            {lionisInstalled && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Installed On</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !lionisDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {lionisDate ? format(lionisDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={lionisDate} onSelect={setLionisDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Installed By</Label>
                  <Input value={lionisBy} onChange={(e) => setLionisBy(e.target.value)} placeholder="Enter name" />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{common.cancel}</Button>
          <Button onClick={handleSave} loading={updateScreen.isPending}>
            {common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
