
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  ArrowRight, 
  HardDrive, 
  Wifi, 
  Database, 
  Building2 
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import BasicDetailsForm from "@/components/wiretap/BasicDetailsForm";
import HardwareSpecsForm from "@/components/wiretap/HardwareSpecsForm";
import ConnectivitySpecsForm from "@/components/wiretap/ConnectivitySpecsForm";
import { toWireTAPPayload, useCreateWireTAPDevice } from "@/hooks/api/wiretap";
import { common } from "@/i18n/common";

const AddWireTAPDevice = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("basic-details");
  const createDevice = useCreateWireTAPDevice();
  const [formData, setFormData] = useState({
    // Basic Details
    hardwareSerialNumber: "",
    applicationSerialNumber: "",
    hostName: "",
    clusterName: "",
    applianceType: "WireTAP",
    mappingStatus: "No",
    theatreId: "",
    theatreName: "",
    noMappingReason: "",
    pullOutStatus: false,
    pullOutDate: null,
    pullOutReason: "",
    
    // Hardware Specifications
    storage: "512 GB",
    ramSize: "",
    ramUnit: "GB",
    mobileNumber: "",
    simNumber: "",
    
    // Connectivity Specifications
    downloadRestrictions: false,
    restrictionDays: [],
    restrictionTimeStart: "",
    restrictionTimeEnd: "",
    theatreNetworkInterface: "eth0",
    theatreBandwidth: "",
    theatreBandwidthUnit: "MBPS",
    proposedBandwidth: "",
    proposedBandwidthUnit: "MBPS",
    connectivityType: "Fixed Broadband",
    ispCompany: "",
    internetInstallationDate: null,
    pricePerGB: "",
    ispEquipmentModel: "",
    ispThirdPartyHandler: "",
    ispCharges: "",
    monthlyFUPLimit: "",
    ispPaymentResponsibility: "",
    billingType: "Postpaid",
    billingCycle: "Monthly",
    billingDate: "1",
    planStartDate: null,
    internetIPType: "DHCP",
    ingestIPType: "DHCP",
    ingestIPAddress: "",
    ingestIPMask: "",
    ingestIPGateway: ""
  });

  const handleFormChange = (sectionData: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...sectionData }));
  };

  const handleSubmit = () => {
    // Validate the form data
    if (!formData.hardwareSerialNumber) {
      toast.error("Hardware Serial Number is required");
      setActiveTab("basic-details");
      return;
    }
    
    if (!formData.applicationSerialNumber) {
      toast.error("Application Serial Number is required");
      setActiveTab("basic-details");
      return;
    }

    if (formData.mappingStatus === "Yes" && !formData.theatreId) {
      toast.error("Theatre selection is required when mapping status is Yes");
      setActiveTab("basic-details");
      return;
    }

    if (formData.mappingStatus === "No" && !formData.noMappingReason) {
      toast.error("Reason for no mapping is required");
      setActiveTab("basic-details");
      return;
    }

    if (formData.pullOutStatus && !formData.pullOutDate) {
      toast.error("Pull out date is required when pull out status is enabled");
      setActiveTab("basic-details");
      return;
    }

    createDevice.mutate(toWireTAPPayload(formData), {
      onSuccess: () => {
        toast.success("WireTAP device added successfully");
        navigate("/wiretap-devices");
      },
      onError: (err) => toast.error(`Could not add device: ${err.message}`),
    });
  };

  const handleNext = () => {
    if (activeTab === "basic-details") {
      setActiveTab("hardware-specs");
    } else if (activeTab === "hardware-specs") {
      setActiveTab("connectivity-specs");
    }
  };

  const handlePrevious = () => {
    if (activeTab === "connectivity-specs") {
      setActiveTab("hardware-specs");
    } else if (activeTab === "hardware-specs") {
      setActiveTab("basic-details");
    }
  };

  const isLastStep = activeTab === "connectivity-specs";
  const isFirstStep = activeTab === "basic-details";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add WireTAP Device</h1>
          <p className="text-muted-foreground mt-1">
            Fill in the details to add a new WireTAP device
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/wiretap-devices")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Devices
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic-details" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Basic Details
          </TabsTrigger>
          <TabsTrigger value="hardware-specs" className="flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Device Specifications
          </TabsTrigger>
          <TabsTrigger value="connectivity-specs" className="flex items-center gap-2">
            <Wifi className="h-4 w-4" /> Connectivity Specifications
          </TabsTrigger>
        </TabsList>
        
        <Card className="mt-4">
          <CardContent className="pt-6">
            <TabsContent value="basic-details">
              <BasicDetailsForm formData={formData} onChange={handleFormChange} />
            </TabsContent>
            
            <TabsContent value="hardware-specs">
              <HardwareSpecsForm formData={formData} onChange={handleFormChange} />
            </TabsContent>
            
            <TabsContent value="connectivity-specs">
              <ConnectivitySpecsForm formData={formData} onChange={handleFormChange} />
            </TabsContent>
          </CardContent>
          
          <CardFooter className="flex justify-between border-t p-4">
            <Button 
              variant="outline" 
              onClick={handlePrevious}
              disabled={isFirstStep}
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Previous
            </Button>
            
            <div className="flex gap-2">
              {!isLastStep ? (
                <Button onClick={handleNext}>
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} loading={createDevice.isPending} className="min-w-20">
                  {common.save}
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </Tabs>
    </motion.div>
  );
};

export default AddWireTAPDevice;
