import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { common } from "@/i18n/common";
import { isIPv4 } from "@/lib/ip";

interface ScreenDevice {
  id: string;
  deviceModel: string;
  serialNumber: string;
  deviceRole: string;
  certificateStatus: 'Active' | 'Inactive' | 'Unknown';
  certificateAutoSync: boolean;
  softwareVersion: string;
  ipAddress?: string;
  subnetMask?: string;
  gateway?: string;
}

interface EditDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device?: ScreenDevice;
  onSave: (deviceData: {
    deviceModel: string;
    serialNumber: string;
    deviceRole: string;
    certificateStatus: 'Active' | 'Inactive' | 'Unknown';
    certificateAutoSync: boolean;
    softwareVersion: string;
    ipAddress?: string;
    subnetMask?: string;
    gateway?: string;
  }) => void;
}

const deviceRoles = [
  "Server (SM)",
  "Root Media Block (RMB)",
  "Projector",
  "Sound Processor",
  "Media Block",
  "Network Switch",
  "Automation Controller",
  "Environmental Monitor"
];

export const EditDeviceDialog = ({ open, onOpenChange, device, onSave }: EditDeviceDialogProps) => {
  const [formData, setFormData] = useState({
    deviceModel: "",
    serialNumber: "",
    deviceRole: "",
    certificateStatus: "Unknown" as 'Active' | 'Inactive' | 'Unknown',
    certificateAutoSync: false,
    softwareVersion: "",
    ipAddress: "",
    subnetMask: "",
    gateway: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (device) {
      setFormData({
        deviceModel: device.deviceModel,
        serialNumber: device.serialNumber,
        deviceRole: device.deviceRole,
        certificateStatus: device.certificateStatus,
        certificateAutoSync: device.certificateAutoSync,
        softwareVersion: device.softwareVersion,
        ipAddress: device.ipAddress || "",
        subnetMask: device.subnetMask || "",
        gateway: device.gateway || ""
      });
    }
  }, [device]);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.deviceModel) newErrors.deviceModel = "Device Model is required";
    if (!formData.serialNumber) newErrors.serialNumber = "Serial Number is required";
    if (!formData.deviceRole) newErrors.deviceRole = "Device Role is required";
    if (!formData.softwareVersion) newErrors.softwareVersion = "Software Version is required";

    // IP validation - if IP is provided, subnet mask is required
    if (formData.ipAddress) {
      if (!isIPv4(formData.ipAddress)) {
        newErrors.ipAddress = "Enter an IPv4 address, e.g. 192.168.1.10";
      }
      if (!formData.subnetMask) {
        newErrors.subnetMask = "Subnet Mask is required when IP address is provided";
      }
    }

    if (formData.gateway && !isIPv4(formData.gateway)) {
      newErrors.gateway = "Enter the gateway as an IPv4 address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      // Clean up empty optional fields
      const cleanedData = {
        ...formData,
        ipAddress: formData.ipAddress || undefined,
        subnetMask: formData.subnetMask || undefined,
        gateway: formData.gateway || undefined
      };
      
      onSave(cleanedData);
      onOpenChange(false);
      setErrors({});
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Device</DialogTitle>
          <DialogDescription>
            Update the device information.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deviceModel">Device Model *</Label>
                <Input
                  id="deviceModel"
                  value={formData.deviceModel}
                  onChange={(e) => handleChange("deviceModel", e.target.value)}
                  placeholder="Dolby IMS3000"
                  className={errors.deviceModel ? "border-destructive" : ""}
                />
                {errors.deviceModel && (
                  <p className="text-sm text-destructive">{errors.deviceModel}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number *</Label>
                <Input
                  id="serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) => handleChange("serialNumber", e.target.value)}
                  placeholder="IMS3K-12345"
                  className={errors.serialNumber ? "border-destructive" : ""}
                />
                {errors.serialNumber && (
                  <p className="text-sm text-destructive">{errors.serialNumber}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deviceRole">Device Role *</Label>
                <Combobox
                  id="deviceRole"
                  value={formData.deviceRole}
                  onChange={(value) => handleChange("deviceRole", value ?? "")}
                  options={deviceRoles.map((role) => ({ value: role, label: role }))}
                  placeholder="Select device role"
                  aria-invalid={!!errors.deviceRole}
                />
                {errors.deviceRole && (
                  <p className="text-sm text-destructive">{errors.deviceRole}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="certificateStatus">Certificate Status</Label>
                <Select
                  value={formData.certificateStatus}
                  onValueChange={(value) => handleChange("certificateStatus", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="softwareVersion">Software Version *</Label>
                <Input
                  id="softwareVersion"
                  value={formData.softwareVersion}
                  onChange={(e) => handleChange("softwareVersion", e.target.value)}
                  placeholder="v2.8.4"
                  className={errors.softwareVersion ? "border-destructive" : ""}
                />
                {errors.softwareVersion && (
                  <p className="text-sm text-destructive">{errors.softwareVersion}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="certificateAutoSync"
                    checked={formData.certificateAutoSync}
                    onCheckedChange={(checked) => handleChange("certificateAutoSync", checked)}
                  />
                  <Label htmlFor="certificateAutoSync">Certificate Auto-Sync</Label>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Network Configuration (Optional)</h4>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ipAddress">IP Address</Label>
                  <Input
                    id="ipAddress"
                    value={formData.ipAddress}
                    onChange={(e) => handleChange("ipAddress", e.target.value)}
                    placeholder="192.168.1.100"
                    className={errors.ipAddress ? "border-destructive" : ""}
                  />
                  {errors.ipAddress && (
                    <p className="text-sm text-destructive">{errors.ipAddress}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="subnetMask">Subnet Mask</Label>
                    <Input
                      id="subnetMask"
                      value={formData.subnetMask}
                      onChange={(e) => handleChange("subnetMask", e.target.value)}
                      placeholder="255.255.255.0"
                      className={errors.subnetMask ? "border-destructive" : ""}
                    />
                    {errors.subnetMask && (
                      <p className="text-sm text-destructive">{errors.subnetMask}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gateway">Gateway</Label>
                    <Input
                      id="gateway"
                      value={formData.gateway}
                      onChange={(e) => handleChange("gateway", e.target.value)}
                      placeholder="192.168.1.1"
                      className={errors.gateway ? "border-destructive" : ""}
                    />
                    {errors.gateway && (
                      <p className="text-sm text-destructive">{errors.gateway}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={handleClose}>{common.cancel}</Button>
            <Button type="submit">{common.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};