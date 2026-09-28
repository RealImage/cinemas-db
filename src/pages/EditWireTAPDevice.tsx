import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, HardDrive, Wifi, Database, Building2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import BasicDetailsForm from "@/components/wiretap/BasicDetailsForm";
import HardwareSpecsForm from "@/components/wiretap/HardwareSpecsForm";
import ConnectivitySpecsForm from "@/components/wiretap/ConnectivitySpecsForm";
import DeviceLogsTable from "@/components/wiretap/DeviceLogsTable";
import { WireTAPDevice } from "@/types/wireTAP";
import { ApiError } from "@/lib/api";
import { fromWireTAPDetails, toWireTAPPayload, useCreateWireTAPDevice, useUpdateWireTAPDevice, useWireTAPDevice } from "@/hooks/api/wiretap";
import { common } from "@/i18n/common";
const EditWireTAPDevice = () => {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("basic-details");
  const [device, setDevice] = useState<WireTAPDevice | null>(null);
  const [isNewDevice, setIsNewDevice] = useState(false);
  const deviceQuery = useWireTAPDevice(id === "new" ? undefined : id);
  const createDevice = useCreateWireTAPDevice();
  const updateDevice = useUpdateWireTAPDevice();
  const saving = createDevice.isPending || updateDevice.isPending;
  // Hydrate the form once per device so background refetches do not discard edits.
  const hydratedId = useRef<string | null>(null);
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
  useEffect(() => {
    if (id === "new") {
      // Handle new device from AddDeviceDialog
      const deviceData = location.state?.deviceData;
      if (deviceData) {
        setIsNewDevice(true);
        // Create a mock device object for display
        setDevice({
          id: "new",
          hardwareSerialNumber: deviceData.hardwareSerialNumber,
          applicationSerialNumber: deviceData.applicationSerialNumber,
          hostName: deviceData.hostName,
          clusterName: deviceData.clusterName,
          wireTapApplianceType: deviceData.wireTapApplianceType,
          activationStatus: "Inactive",
          vpnStatus: "Disabled",
          theatreId: "",
          theatreName: "",
          theatreUUID: "",
          theatreAddress: "",
          storageCapacity: "512 GB",
          bandwidth: "",
          connectivityType: "Fixed Broadband",
          ispName: "",
          mappingStatus: "Unmapped",
          pullOutStatus: "Installed",
          updatedBy: "System",
          updatedAt: new Date().toISOString()
        });
        setFormData(prev => ({
          ...prev,
          hardwareSerialNumber: deviceData.hardwareSerialNumber,
          applicationSerialNumber: deviceData.applicationSerialNumber,
          hostName: deviceData.hostName,
          applianceType: deviceData.wireTapApplianceType
        }));
      } else {
        toast.error("Device data not found");
        navigate("/wiretap-devices");
      }
    } else {
      // Populate the form from the stored device once it has loaded
      if (deviceQuery.error instanceof ApiError && deviceQuery.error.status === 404) {
        toast.error("Device not found");
        navigate("/wiretap-devices");
        return;
      }
      if (deviceQuery.isError) return; // rendered below with Retry
      const currentDevice = deviceQuery.data;
      if (!currentDevice || hydratedId.current === currentDevice.id) return;
      hydratedId.current = currentDevice.id;
      setDevice(currentDevice);
      setFormData(prev => ({
        ...prev,
        // Remaining form fields as last saved (RAM, SIM, ISP billing, …)
        ...fromWireTAPDetails(currentDevice.details),
        // Basic Details
        hardwareSerialNumber: currentDevice.hardwareSerialNumber,
        applicationSerialNumber: currentDevice.applicationSerialNumber,
        hostName: currentDevice.hostName,
        clusterName: currentDevice.clusterName ?? "",
        mappingStatus: currentDevice.mappingStatus === "Mapped" ? "Yes" : "No",
        theatreId: currentDevice.theatreId,
        theatreName: currentDevice.theatreName,
        noMappingReason: currentDevice.noMappingReason ?? (currentDevice.mappingStatus === "Mapped" ? "" : "Not specified"),
        pullOutStatus: currentDevice.pullOutStatus === "Pulled Out",
        pullOutDate: fromWireTAPDetails({ pullOutDate: currentDevice.pullOutDate }).pullOutDate ?? null,
        pullOutReason: currentDevice.pullOutReason ?? "",
        // Hardware / connectivity specifications from the device columns
        storage: currentDevice.storageCapacity,
        theatreBandwidth: currentDevice.bandwidth,
        connectivityType: currentDevice.connectivityType,
        ispCompany: currentDevice.ispName,
      }) as typeof prev);
    }
  }, [id, navigate, location.state, deviceQuery.data, deviceQuery.isError, deviceQuery.error]);
  const handleFormChange = (sectionData: Partial<typeof formData>) => {
    setFormData(prev => ({
      ...prev,
      ...sectionData
    }));
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

    const payload = toWireTAPPayload(formData);
    const done = {
      onSuccess: () => {
        toast.success(isNewDevice ? "WireTAP device added successfully" : "WireTAP device updated successfully");
        navigate("/wiretap-devices");
      },
      onError: (err: Error) => toast.error(`Could not save device: ${err.message}`),
    };
    if (isNewDevice) createDevice.mutate(payload, done);
    else updateDevice.mutate({ id: id!, form: payload }, done);
  };
  const handleNext = () => {
    if (activeTab === "basic-details") {
      setActiveTab("hardware-specs");
    } else if (activeTab === "hardware-specs") {
      setActiveTab("connectivity-specs");
    } else if (activeTab === "connectivity-specs") {
      setActiveTab("device-logs");
    }
  };
  const handlePrevious = () => {
    if (activeTab === "device-logs") {
      setActiveTab("connectivity-specs");
    } else if (activeTab === "connectivity-specs") {
      setActiveTab("hardware-specs");
    } else if (activeTab === "hardware-specs") {
      setActiveTab("basic-details");
    }
  };
  const isLastStep = activeTab === "device-logs";
  const isFirstStep = activeTab === "basic-details";
  if (!device && deviceQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center" role="alert">
        <p className="text-sm text-red-500">Could not load the device: {deviceQuery.error.message}</p>
        <Button variant="outline" onClick={() => deviceQuery.refetch()}>Retry</Button>
      </div>
    );
  }
  if (!device) {
    return <div>Loading...</div>;
  }
  return <motion.div initial={{
    opacity: 0,
    y: 20
  }} animate={{
    opacity: 1,
    y: 0
  }} transition={{
    duration: 0.3
  }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNewDevice ? "Add WireTAP Device" : "Edit WireTAP Device"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isNewDevice ? `Complete registration for ${device.hardwareSerialNumber}` : `Update details for ${device.hardwareSerialNumber}`}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/wiretap-devices")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Devices
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic-details" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Basic Details
          </TabsTrigger>
          <TabsTrigger value="hardware-specs" className="flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Device Specifications
          </TabsTrigger>
          <TabsTrigger value="connectivity-specs" className="flex items-center gap-2">
            <Wifi className="h-4 w-4" /> Connectivity Specifications
          </TabsTrigger>
          <TabsTrigger value="device-logs" className="flex items-center gap-2">
            <Database className="h-4 w-4" /> Device Logs
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
              <Alert className="mb-6">
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  These connectivity specifications are properties of the theatre and cannot be edited from this device page. 
                  To modify these settings, please edit the theatre configuration.{" "}
                  {formData.theatreId ? (
                    <a
                      href={`/theatre/${encodeURIComponent(formData.theatreId)}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:text-primary/80 font-medium"
                    >
                      Click here to access the Theatre Page
                    </a>
                  ) : (
                    <span className="text-muted-foreground">
                      (Theatre must be mapped first)
                    </span>
                  )}.
                </AlertDescription>
              </Alert>
              <div className="opacity-60 pointer-events-none">
                <ConnectivitySpecsForm formData={formData} onChange={handleFormChange} />
              </div>
            </TabsContent>
            
            <TabsContent value="device-logs">
              <DeviceLogsTable deviceId={id} />
            </TabsContent>
          </CardContent>
          
          {activeTab !== "device-logs" && <CardFooter className="flex justify-between border-t p-4">
              <Button variant="outline" onClick={handlePrevious} disabled={isFirstStep}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Previous
              </Button>
              
              <div className="flex gap-2">
                {!isLastStep ? <Button onClick={handleNext}>
                    Next <ArrowRight className="h-4 w-4 ml-2" />
                  </Button> : <Button onClick={handleSubmit} loading={saving} className="min-w-20">
                    {common.save}
                  </Button>}
              </div>
            </CardFooter>}
        </Card>
      </Tabs>
    </motion.div>;
};
export default EditWireTAPDevice;