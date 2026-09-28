import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WireTAPDevice } from "@/types/wireTAP";
import { common } from "@/i18n/common";

interface DeactivateDeviceDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  device: WireTAPDevice | null;
  onConfirm: (device: WireTAPDevice, reason: string) => void;
}

export function DeactivateDeviceDialog({
  isOpen,
  onOpenChange,
  device,
  onConfirm
}: DeactivateDeviceDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (device) {
      onConfirm(device, reason);
      setReason("");
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Confirm Deactivation
          </DialogTitle>
          <DialogDescription>
            You are about to deactivate device: {device?.hardwareSerialNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Deactivation should be done when the WireTAP hardware is being scrapped. 
              Consider Pulling Out WireTAP for temporary maintenance.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="deactivation-reason">
              Are you sure you want to continue with Deactivation?
            </Label>
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm text-muted-foreground">
                Reason for deactivation:
              </Label>
              <Textarea
                id="reason"
                placeholder="Please provide a reason for deactivating this device..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>{common.cancel}</Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={!reason.trim()}
          >
            Deactivate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}