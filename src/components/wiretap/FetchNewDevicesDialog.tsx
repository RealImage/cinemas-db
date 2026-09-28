
import { useState } from "react";
import { WireTAPDevice } from "@/types/wireTAP";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { common } from "@/i18n/common";

interface FetchNewDevicesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  newDevices: WireTAPDevice[];
  onAddDevices: (selectedDevices: WireTAPDevice[]) => void;
  isLoading?: boolean;
  error?: Error | null;
}

export function FetchNewDevicesDialog({
  isOpen,
  onOpenChange,
  newDevices,
  onAddDevices,
  isLoading = false,
  error = null,
}: FetchNewDevicesDialogProps) {
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDeviceIds(new Set(newDevices.map(d => d.id)));
    } else {
      setSelectedDeviceIds(new Set());
    }
  };

  const handleSelectDevice = (deviceId: string, checked: boolean) => {
    const newSelection = new Set(selectedDeviceIds);
    if (checked) {
      newSelection.add(deviceId);
    } else {
      newSelection.delete(deviceId);
    }
    setSelectedDeviceIds(newSelection);
  };

  const handleAddDevices = () => {
    const selectedDevices = newDevices.filter(d => selectedDeviceIds.has(d.id));
    onAddDevices(selectedDevices);
    setSelectedDeviceIds(new Set()); // Reset selection
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedDeviceIds(new Set()); // Reset selection
    onOpenChange(false);
  };

  const allSelected = newDevices.length > 0 && selectedDeviceIds.size === newDevices.length;
  const someSelected = selectedDeviceIds.size > 0 && selectedDeviceIds.size < newDevices.length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>
            {isLoading || error ? "New Devices" : <>{newDevices.length} New Device{newDevices.length !== 1 ? 's' : ''} Available</>}
          </DialogTitle>
          <DialogDescription>
            The following devices are registered but not yet available in this Inventory portal
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground" role="status">
            Fetching new devices…
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-500" role="alert">
            Could not fetch new devices: {error.message}
          </div>
        ) : newDevices.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No new devices found
          </div>
        ) : (
          <div className="max-h-[500px] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all devices"
                      className={someSelected ? "data-[state=checked]:bg-primary" : ""}
                    />
                  </TableHead>
                  <TableHead>Appliance Serial Number</TableHead>
                  <TableHead>H/W Serial Number</TableHead>
                  <TableHead>Cluster Name</TableHead>
                  <TableHead>Host Name / Node ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {newDevices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedDeviceIds.has(device.id)}
                        onCheckedChange={(checked) => 
                          handleSelectDevice(device.id, checked as boolean)
                        }
                        aria-label={`Select ${device.applicationSerialNumber}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {device.applicationSerialNumber}
                    </TableCell>
                    <TableCell>{device.hardwareSerialNumber}</TableCell>
                    <TableCell>{device.clusterName || '-'}</TableCell>
                    <TableCell>{device.hostName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>{common.cancel}</Button>
          <Button 
            onClick={handleAddDevices}
            disabled={selectedDeviceIds.size === 0}
          >
            Add Devices ({selectedDeviceIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
