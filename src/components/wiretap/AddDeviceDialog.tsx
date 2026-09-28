import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { common } from "@/i18n/common";

interface AddDeviceDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDeviceRegister?: (deviceData: any) => void;
}

interface DeviceDetails {
  hostName?: string;
  clusterName?: string;
  applianceType?: string;
}

const AddDeviceDialog = ({ isOpen, onOpenChange, onDeviceRegister }: AddDeviceDialogProps) => {
  const [hardwareSerialNumber, setHardwareSerialNumber] = useState("");
  const [osSerialNumber, setOsSerialNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedDetails, setFetchedDetails] = useState<DeviceDetails | null>(null);
  const [showManualRegistration, setShowManualRegistration] = useState(false);

  const handleFetchDetails = async () => {
    if (!hardwareSerialNumber.trim() || !osSerialNumber.trim()) {
      toast.error("Please enter both serial numbers");
      return;
    }

    setIsLoading(true);
    try {
      // Simulate API call to fetch device details
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock logic: if serial numbers match certain patterns, return details
      const isValidDevice = hardwareSerialNumber.includes("WT") && osSerialNumber.includes("OS");
      
      if (isValidDevice) {
        setFetchedDetails({
          hostName: `host-${hardwareSerialNumber.slice(-4)}`,
          clusterName: `cluster-${osSerialNumber.slice(-3)}`,
          applianceType: "Standard"
        });
        setShowManualRegistration(false);
      } else {
        setFetchedDetails(null);
        setShowManualRegistration(true);
      }
    } catch (error) {
      toast.error("Failed to fetch device details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = () => {
    if (fetchedDetails) {
      const deviceData = {
        hardwareSerialNumber,
        applicationSerialNumber: osSerialNumber,
        hostName: fetchedDetails.hostName,
        clusterName: fetchedDetails.clusterName,
        wireTapApplianceType: fetchedDetails.applianceType,
      };
      
      toast.success("Device details found! Redirecting to complete registration...");
      onDeviceRegister?.(deviceData);
      handleClose();
    } else {
      toast.info("Device registration will require manual configuration");
      handleClose();
    }
  };

  const handleClose = () => {
    setHardwareSerialNumber("");
    setOsSerialNumber("");
    setFetchedDetails(null);
    setShowManualRegistration(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add WireTAP Device
          </DialogTitle>
          <DialogDescription>
            Enter the device serial numbers to automatically fetch device details from CinemasDB.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hardwareSerial">Hardware Serial Number *</Label>
              <Input
                id="hardwareSerial"
                value={hardwareSerialNumber}
                onChange={(e) => setHardwareSerialNumber(e.target.value)}
                placeholder="Enter hardware serial number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="osSerial">Appliance (OS) Serial Number *</Label>
              <Input
                id="osSerial"
                value={osSerialNumber}
                onChange={(e) => setOsSerialNumber(e.target.value)}
                placeholder="Enter OS serial number"
              />
            </div>
          </div>

          <Button 
            onClick={handleFetchDetails} 
            disabled={isLoading || !hardwareSerialNumber.trim() || !osSerialNumber.trim()}
            className="w-full"
            variant="outline"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fetching Device Details...
              </>
            ) : (
              "Fetch Device Details"
            )}
          </Button>

          {fetchedDetails && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800">Device Details Found</CardTitle>
                <CardDescription className="text-green-600">
                  The following details were automatically retrieved from CinemasDB:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Host Name:</span>
                    <p className="text-muted-foreground">{fetchedDetails.hostName}</p>
                  </div>
                  <div>
                    <span className="font-medium">Cluster Name:</span>
                    <p className="text-muted-foreground">{fetchedDetails.clusterName}</p>
                  </div>
                  <div>
                    <span className="font-medium">Appliance Type:</span>
                    <p className="text-muted-foreground">{fetchedDetails.applianceType}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {showManualRegistration && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="text-yellow-800">Manual Registration Required</CardTitle>
                <CardDescription className="text-yellow-600">
                  Device details could not be found in CinemasDB. The device registration must be completed manually with all required information.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{common.cancel}</Button>
          <Button 
            onClick={handleRegister}
            disabled={!fetchedDetails && !showManualRegistration}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddDeviceDialog;