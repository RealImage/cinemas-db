
import { formatDateTime } from "@/lib/dateUtils";
import { Download, Clock } from "lucide-react";
import { toast } from "sonner";
import { WireTAPDevice } from "@/types/wireTAP";
import { isDeviceOfflineTooLong } from "@/components/wiretap/StatusIcons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { common } from "@/i18n/common";

interface DeviceLogsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  device: WireTAPDevice | null;
}

export function DeviceLogsDialog({ isOpen, onOpenChange, device }: DeviceLogsDialogProps) {
  if (!device) return null;

  const mockLogs = [
    { timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), action: "Status Check", details: "Device heartbeat received" },
    { timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), action: "VPN Connection", details: "VPN connection established" },
    { timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), action: "Bandwidth Test", details: "Bandwidth test completed: 98.5Mbps" },
    { timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), action: "Firmware Update", details: "Firmware updated to v2.3.4" },
    { timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), action: "Configuration Change", details: "Network settings updated" },
  ];

  const isOfflineTooLong = isDeviceOfflineTooLong(device.updatedAt);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Device Logs</DialogTitle>
          <DialogDescription>
            Activity logs for {device.hardwareSerialNumber}
          </DialogDescription>
        </DialogHeader>
        
        {isOfflineTooLong && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 flex items-center">
            <Clock className="h-5 w-5 text-red-500 mr-2" />
            <div>
              <p className="text-sm font-medium text-red-800">Device Offline Warning</p>
              <p className="text-xs text-red-600">
                This device has been offline for more than 24 hours. Last seen on {formatDateTime(device.updatedAt)}
              </p>
            </div>
          </div>
        )}
        
        <div className="max-h-[400px] overflow-y-auto border rounded-md p-4 bg-muted/30">
          <div className="space-y-3">
            {mockLogs.map((log, index) => (
              <div key={index} className="border-b pb-2 last:border-0">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{log.action}</span>
                  <span className="text-muted-foreground">{formatDateTime(log.timestamp)}</span>
                </div>
                <p className="text-sm mt-1">{log.details}</p>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{common.close}</Button>
          <Button variant="outline" onClick={() => toast.success("Log report downloaded")}>
            <Download className="h-4 w-4 mr-2" /> Download Logs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
