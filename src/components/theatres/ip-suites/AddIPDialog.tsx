import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { common } from "@/i18n/common";
import { isIPv4 } from "@/lib/ip";

interface AddIPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (ipData: { ipAddress: string; subnetMask: string; gateway: string }) => void;
}

const commonSubnetMasks = [
  "255.255.255.0",
  "255.255.0.0", 
  "255.0.0.0",
  "255.255.255.128",
  "255.255.255.192",
  "255.255.255.224",
  "255.255.255.240",
  "255.255.255.248",
  "255.255.255.252"
];

export const AddIPDialog = ({ open, onOpenChange, onSave }: AddIPDialogProps) => {
  const [formData, setFormData] = useState({
    ipAddress: "",
    subnetMask: "",
    gateway: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.ipAddress) {
      newErrors.ipAddress = "IP Address is required";
    } else if (!isIPv4(formData.ipAddress)) {
      newErrors.ipAddress = "Enter an IPv4 address, e.g. 192.168.1.10";
    }

    if (!formData.subnetMask) {
      newErrors.subnetMask = "Subnet Mask is required";
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
      onSave(formData);
      onOpenChange(false);
      setFormData({ ipAddress: "", subnetMask: "", gateway: "" });
      setErrors({});
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData({ ipAddress: "", subnetMask: "", gateway: "" });
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add IP Configuration</DialogTitle>
          <DialogDescription>
            Add a new IP configuration for this screen.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ipAddress">IP Address *</Label>
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

            <div className="space-y-2">
              <Label htmlFor="subnetMask">Subnet Mask *</Label>
              <Combobox
                id="subnetMask"
                value={formData.subnetMask}
                onChange={(value) => handleChange("subnetMask", value ?? "")}
                options={commonSubnetMasks.map((mask) => ({ value: mask, label: mask }))}
                placeholder="Select subnet mask"
                aria-invalid={!!errors.subnetMask}
              />
              {errors.subnetMask && (
                <p className="text-sm text-destructive">{errors.subnetMask}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gateway">Gateway (Optional)</Label>
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

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={handleClose}>{common.cancel}</Button>
            <Button type="submit">{common.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};