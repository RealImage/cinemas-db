
import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { LocationPicker } from "@/components/locations/LocationPicker";
import type { City } from "@/data/locationsData";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { TheatreSystemsFields } from "@/components/theatres/TheatreSystemsFields";
import { LiveWireSettings } from "@/components/theatres/LiveWireSettings";
import { 
  Screen, 
  Theatre, 
  WireTAPDevice, 
  DeliveryTimeSlot,
  DCPPhysicalDeliveryMethod,
  DCPNetworkDeliveryMethod,
  DCPModemDeliveryMethod,
  Contact,
  DeliveryAddress,
  TheatreMapping,
  DownloadRestrictions,
  THEATRE_LISTINGS
} from "@/types";
import { IPSuitesTabContent } from "./theatres/ip-suites/IPSuitesTabContent";
import { DataTable, Column } from "@/components/ui/data-table";
import { ScreenDialog } from "@/components/screens/ScreenDialog";
import { EditTheatreMappingDialog } from "./EditTheatreMappingDialog";
import { 
  Plus, 
  Edit, 
  Trash2, 
  MapPin, 
  Building, 
  Bike, 
  Car, 
  Monitor, 
  Server, 
  Ticket, 
  Cable, 
  Network,
  Clock,
  Truck,
  FileText,
  Globe,
  Phone,
  Mail,
  Key,
  Upload,
  Wifi
} from "lucide-react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useChains } from "@/hooks/api/chains";
import { useAddWireTAPToTheatre, useCompanies, usePullOutWireTAP, useTheatreWireTAPDevices } from "@/hooks/api/theatres";
import { WireTAPDevice as WireTAPDeviceType } from "@/types/wireTAP";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/dateUtils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { AddWireTAPToTheatreDialog } from "./theatres/AddWireTAPToTheatreDialog";
import { PullOutDeviceDialog } from "./theatres/PullOutDeviceDialog";
import { TimeSlotsEditor } from "./theatres/TimeSlotsEditor";
import { contentTypeOptions } from "@/data/contentTypes";
import { screenLabel } from "@/data/screenRules";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, LogOut } from "lucide-react";
import { FormActions } from "@/components/ui/form-actions";
import { common } from "@/i18n/common";

// WireTAP Appliances Section Component
const theatreTypeOptions = [
  "Amusement Park",
  "Cemetery",
  "Church",
  "College / University",
  "Complex",
  "Conference / Exhibition",
  "Cruise Shop",
  "Dine-in",
  "Drive-in",
  "Film Festival",
  "Home / Residence",
  "Hotel",
  "Karaoke",
  "Lab",
  "Multiplex",
  "Multipurpose Facility",
  "Needs Review",
  "Offices",
  "Open Air Theatre",
  "Pop-up",
  "Screening Room",
  "Single Screen",
  "VR Zone",
  "Yacht",
].map((t) => ({ value: t, label: t }));

const weekDayOptions = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => ({ value: d, label: d }));

const WireTAPAppliancesSection = ({ theatreId }: { theatreId?: string }) => {
  const [showPulledOut, setShowPulledOut] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [pullOutDialogOpen, setPullOutDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<WireTAPDeviceType | null>(null);
  
  // Devices mapped to this theatre
  const devicesQuery = useTheatreWireTAPDevices(theatreId);
  const addWireTAP = useAddWireTAPToTheatre(theatreId ?? "");
  const pullOutWireTAP = usePullOutWireTAP(theatreId ?? "");
  const theatreDevices = useMemo(() => devicesQuery.data ?? [], [devicesQuery.data]);
  
  // Separate active and pulled out devices
  const activeDevices = useMemo(() => 
    theatreDevices.filter(device => device.pullOutStatus !== "Pulled Out"),
    [theatreDevices]
  );
  
  const pulledOutDevices = useMemo(() => 
    theatreDevices.filter(device => device.pullOutStatus === "Pulled Out"),
    [theatreDevices]
  );

  const getActivationStatusBadge = (status: string) => {
    return status === "Active" ? (
      <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>
    ) : (
      <Badge variant="secondary" className="bg-gray-500/10 text-gray-600 border-gray-500/20">Inactive</Badge>
    );
  };

  const handleAddWireTAP = async (device: WireTAPDeviceType) => {
    try {
      await addWireTAP.mutateAsync(device.id);
      toast.success(`WireTAP ${device.applicationSerialNumber} added to theatre successfully`);
    } catch (err) {
      toast.error(`Could not add WireTAP: ${(err as Error).message}`);
    }
  };

  const handleViewDetails = (device: WireTAPDeviceType) => {
    window.location.href = `/wiretap/${device.id}`;
  };

  const handleEditDetails = (device: WireTAPDeviceType) => {
    window.location.href = `/wiretap/${device.id}/edit`;
  };

  const handlePullOutClick = (device: WireTAPDeviceType) => {
    setSelectedDevice(device);
    setPullOutDialogOpen(true);
  };

  const handlePullOutConfirm = async (device: WireTAPDeviceType, reason: string, comments: string) => {
    setPullOutDialogOpen(false);
    setSelectedDevice(null);
    try {
      await pullOutWireTAP.mutateAsync({ deviceId: device.id, reason, comments });
      toast.success(`Device ${device.applicationSerialNumber} pulled out successfully. Reason: ${reason}`);
    } catch (err) {
      toast.error(`Could not pull out device: ${(err as Error).message}`);
    }
  };

  const DeviceTable = ({ devices, showActions = true }: { devices: WireTAPDeviceType[], showActions?: boolean }) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Appliance Serial Number</TableHead>
            <TableHead>Connectivity Type</TableHead>
            <TableHead>Storage Capacity</TableHead>
            <TableHead>Appliance Type</TableHead>
            <TableHead>Activation Status</TableHead>
            <TableHead>Updated At</TableHead>
            {showActions && <TableHead className="w-[50px]"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {devices.map((device) => (
            <TableRow key={device.id}>
              <TableCell className="font-medium">{device.applicationSerialNumber}</TableCell>
              <TableCell>{device.connectivityType}</TableCell>
              <TableCell>{device.storageCapacity}</TableCell>
              <TableCell>
                <Badge variant="outline">{device.wireTapApplianceType}</Badge>
              </TableCell>
              <TableCell>{getActivationStatusBadge(device.activationStatus)}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(device.updatedAt)}
              </TableCell>
              {showActions && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background border z-50">
                      <DropdownMenuItem onClick={() => handleViewDetails(device)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditDetails(device)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePullOutClick(device)}>
                        <LogOut className="h-4 w-4 mr-2" />
                        Pull Out Device
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Server className="h-5 w-5" />
          WireTAP
        </h3>
        <Button type="button" size="sm" className="gap-1" onClick={() => setAddDialogOpen(true)} disabled={!theatreId}>
          <Plus className="h-4 w-4" />
          Add WireTAP
        </Button>
      </div>
      
      <AddWireTAPToTheatreDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        theatreId={theatreId || ""}
        onConfirm={handleAddWireTAP}
      />

      <PullOutDeviceDialog
        open={pullOutDialogOpen}
        onOpenChange={setPullOutDialogOpen}
        device={selectedDevice}
        onConfirm={handlePullOutConfirm}
      />
      
      {devicesQuery.isPending && theatreId ? (
        <div className="rounded-lg border p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground">Loading WireTAP devices…</p>
        </div>
      ) : devicesQuery.isError ? (
        <div className="rounded-lg border p-4 bg-muted/30 flex items-center justify-between">
          <p className="text-sm text-red-500">Could not load WireTAP devices: {devicesQuery.error.message}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => devicesQuery.refetch()}>Retry</Button>
        </div>
      ) : activeDevices.length > 0 ? (
        <DeviceTable devices={activeDevices} />
      ) : (
        <div className="rounded-lg border p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground">
            No active WireTAP devices configured for this theatre.
          </p>
        </div>
      )}
      
      {pulledOutDevices.length > 0 && (
        <Collapsible open={showPulledOut} onOpenChange={setShowPulledOut}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground">
              {showPulledOut ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Pulled Out Devices ({pulledOutDevices.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <DeviceTable devices={pulledOutDevices} showActions={false} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

interface TheatreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theatre?: Theatre;
  /** May return a promise; the form stays open (and shows no success toast) if it rejects. */
  onSave: (theatre: Partial<Theatre>) => void | Promise<void>;
  isFullPage?: boolean;
}

export const TheatreDialog = ({
  open,
  onOpenChange,
  theatre,
  onSave,
  isFullPage = false,
}: TheatreDialogProps) => {
  const isEditing = !!theatre;
  
  // Initialize with proper types to match DeliveryAddress in the type definition
  const [formData, setFormData] = useState<Partial<Theatre>>(
    theatre ? JSON.parse(JSON.stringify(theatre)) : {
      name: "",
      displayName: "",
      alternateNames: [],
      uuid: crypto.randomUUID(),
      chainId: "",
      chainName: "",
      companyId: "",
      companyName: "",
      exhibitorIntegratorCompanies: [],
      theatreMappings: [],
      listing: "Listed - Public",
      type: "",
      address: "",
      status: "Active",
      screenCount: 0,
      locationType: "",
      bikeParkingAvailable: false,
      bikeParkingCapacity: 0,
      carParkingAvailable: false,
      carParkingCapacity: 0,
      theatreManagementSystem: "",
      ticketingSystem: "",
      deliveryTimeSlots: [],
      // Fix: Ensure useTheatreAddress is required
      deliveryAddress: { 
        useTheatreAddress: true,
        address: "",
        city: "",
        state: "",
        postalCode: "",
        country: ""
      },
      dcpPhysicalDeliveryMethods: [],
      dcpNetworkDeliveryMethods: [],
      dcpModemDeliveryMethods: [],
      dcpDeliveryContacts: [],
      sendEmailsForDCPDelivery: false,
      dcpContentTypesForEmail: [],
      keyDeliveryContacts: [],
      kdmDeliveryEmailsInFLMX: "useDropbox",
      autoIngestOfContentEnabled: false,
      autoIngestContentTypes: [],
      qcnTheatreIPAddressRange: "",
    }
  );
  
  const [screens, setScreens] = useState<Screen[]>(theatre?.screens || []);
  const [screenDialogOpen, setScreenDialogOpen] = useState(false);
  const [editingScreen, setEditingScreen] = useState<Screen | undefined>(undefined);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<TheatreMapping | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const chainsQuery = useChains();
  const companiesQuery = useCompanies();
  
  useEffect(() => {
    if (theatre) {
      setFormData(JSON.parse(JSON.stringify(theatre)));
      setScreens(theatre.screens || []);
    }
  }, [theatre]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSystemChange = useCallback((key: "tmsId" | "ticketingSystemId", value: string | null) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };
  
  // Fix: Ensure DeliveryAddress has all required properties with proper types
  const handleDeliveryAddressChange = (field: keyof DeliveryAddress, value: string | boolean) => {
    setFormData((prev) => {
      // Make sure we have a valid delivery address object with all required fields
      const currentAddress = prev.deliveryAddress || { 
        useTheatreAddress: true,
        address: "",
        city: "",
        state: "",
        postalCode: "",
        country: ""
      };
      
      return {
        ...prev,
        deliveryAddress: {
          ...currentAddress,
          [field]: value
        }
      };
    });
  };
  
  // Delivery Time Slots
  const handleAddDeliveryTimeSlot = () => {
    const newSlot: DeliveryTimeSlot = {
      id: crypto.randomUUID(),
      day: "Monday",
      startTime: "09:00",
      endTime: "17:00",
    };
    setFormData((prev) => ({
      ...prev,
      deliveryTimeSlots: [...(prev.deliveryTimeSlots || []), newSlot],
    }));
  };
  
  const handleDeleteDeliveryTimeSlot = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      deliveryTimeSlots: (prev.deliveryTimeSlots || []).filter((slot) => slot.id !== id),
    }));
  };
  
  const handleDeliveryTimeSlotChange = (id: string, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      deliveryTimeSlots: (prev.deliveryTimeSlots || []).map((slot) =>
        slot.id === id ? { ...slot, [field]: value } : slot
      ),
    }));
  };
  
  const handleCopyToAllDays = (slotId: string) => {
    const slotToCopy = formData.deliveryTimeSlots?.find(slot => slot.id === slotId);
    
    if (slotToCopy) {
      const updatedTimeSlots = (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const).map(day => ({
        ...slotToCopy,
        id: crypto.randomUUID(),
        day: day,
      }));
      
      setFormData(prev => ({
        ...prev,
        deliveryTimeSlots: updatedTimeSlots,
      }));
    }
  };
  
  // DCP Physical Delivery Methods
  const handleAddPhysicalDeliveryMethod = () => {
    const newMethod: DCPPhysicalDeliveryMethod = {
      id: crypto.randomUUID(),
      mediaType: "",
      details: "",
    };
    setFormData((prev) => ({
      ...prev,
      dcpPhysicalDeliveryMethods: [...(prev.dcpPhysicalDeliveryMethods || []), newMethod],
    }));
  };
  
  const handleDeletePhysicalDeliveryMethod = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      dcpPhysicalDeliveryMethods: (prev.dcpPhysicalDeliveryMethods || []).filter((method) => method.id !== id),
    }));
  };
  
  const handlePhysicalDeliveryMethodChange = (id: string, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      dcpPhysicalDeliveryMethods: (prev.dcpPhysicalDeliveryMethods || []).map((method) =>
        method.id === id ? { ...method, [field]: value } : method
      ),
    }));
  };
  
  // DCP Network Delivery Methods
  const handleAddNetworkDeliveryMethod = () => {
    const newMethod: DCPNetworkDeliveryMethod = {
      id: crypto.randomUUID(),
      networkURL: "",
    };
    setFormData((prev) => ({
      ...prev,
      dcpNetworkDeliveryMethods: [...(prev.dcpNetworkDeliveryMethods || []), newMethod],
    }));
  };
  
  const handleDeleteNetworkDeliveryMethod = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      dcpNetworkDeliveryMethods: (prev.dcpNetworkDeliveryMethods || []).filter((method) => method.id !== id),
    }));
  };
  
  const handleNetworkDeliveryMethodChange = (id: string, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      dcpNetworkDeliveryMethods: (prev.dcpNetworkDeliveryMethods || []).map((method) =>
        method.id === id ? { ...method, [field]: value } : method
      ),
    }));
  };
  
  // DCP Modem Delivery Methods
  const handleAddModemDeliveryMethod = () => {
    const newMethod: DCPModemDeliveryMethod = {
      id: crypto.randomUUID(),
      modemPhoneNumber: "",
    };
    setFormData((prev) => ({
      ...prev,
      dcpModemDeliveryMethods: [...(prev.dcpModemDeliveryMethods || []), newMethod],
    }));
  };
  
  const handleDeleteModemDeliveryMethod = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      dcpModemDeliveryMethods: (prev.dcpModemDeliveryMethods || []).filter((method) => method.id !== id),
    }));
  };
  
  const handleModemDeliveryMethodChange = (id: string, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      dcpModemDeliveryMethods: (prev.dcpModemDeliveryMethods || []).map((method) =>
        method.id === id ? { ...method, [field]: value } : method
      ),
    }));
  };
  
  // DCP Delivery Contacts
  const handleAddDCPDeliveryContact = () => {
    const newContact: Contact = {
      id: crypto.randomUUID(),
      email: "",
    };
    setFormData((prev) => ({
      ...prev,
      dcpDeliveryContacts: [...(prev.dcpDeliveryContacts || []), newContact],
    }));
  };
  
  const handleDeleteDCPDeliveryContact = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      dcpDeliveryContacts: (prev.dcpDeliveryContacts || []).filter((contact) => contact.id !== id),
    }));
  };
  
  const handleDCPDeliveryContactChange = (id: string, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      dcpDeliveryContacts: (prev.dcpDeliveryContacts || []).map((contact) =>
        contact.id === id ? { ...contact, [field]: value } : contact
      ),
    }));
  };
  
  // Key Delivery Contacts
  const handleAddKeyDeliveryContact = () => {
    const newContact: Contact = {
      id: crypto.randomUUID(),
      email: "",
    };
    setFormData((prev) => ({
      ...prev,
      keyDeliveryContacts: [...(prev.keyDeliveryContacts || []), newContact],
    }));
  };
  
  const handleDeleteKeyDeliveryContact = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      keyDeliveryContacts: (prev.keyDeliveryContacts || []).filter((contact) => contact.id !== id),
    }));
  };
  
  const handleKeyDeliveryContactChange = (id: string, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      keyDeliveryContacts: (prev.keyDeliveryContacts || []).map((contact) =>
        contact.id === id ? { ...contact, [field]: value } : contact
      ),
    }));
  };
  
  // Content Type
  const handleContentTypeChange = (contentType: string) => {
    setFormData((prev) => {
      const currentTypes = prev.dcpContentTypesForEmail || [];
      const updatedTypes = currentTypes.includes(contentType)
        ? currentTypes.filter((type) => type !== contentType)
        : [...currentTypes, contentType];
      
      return { ...prev, dcpContentTypesForEmail: updatedTypes };
    });
  };
  
  const handleAutoIngestContentTypeChange = (contentType: string) => {
    setFormData((prev) => {
      const currentTypes = prev.autoIngestContentTypes || [];
      const updatedTypes = currentTypes.includes(contentType)
        ? currentTypes.filter((type) => type !== contentType)
        : [...currentTypes, contentType];
      
      return { ...prev, autoIngestContentTypes: updatedTypes };
    });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Screens (incl. their devices, IPs and suites) are saved with the theatre.
      await onSave({ ...formData, screens });
    } catch {
      return; // the caller reported the error; keep the form open
    } finally {
      setSaving(false);
    }
    onOpenChange(false);
    
    toast.success(
      isEditing 
        ? `Theatre "${formData.name}" updated successfully` 
        : `Theatre "${formData.name}" created successfully`
    );
  };
  
  // Screen Management
  const handleCreateScreen = () => {
    setEditingScreen(undefined);
    setScreenDialogOpen(true);
  };
  
  const handleEditScreen = (screen: Screen) => {
    setEditingScreen(screen);
    setScreenDialogOpen(true);
  };
  
  const handleDeleteScreen = (screen: Screen) => {
    setScreens(screens.filter((s) => s.id !== screen.id));
    toast.success(`${screenLabel(screen)} removed. Update the theatre to save the change.`);
  };
  
  const handleSaveScreen = (screenData: Partial<Screen>) => {
    if (editingScreen) {
      setScreens(
        screens.map((s) => 
          s.id === editingScreen.id ? { ...s, ...screenData } as Screen : s
        )
      );
    } else {
      const newScreen: Screen = {
        id: crypto.randomUUID(),
        theatreId: formData.id || "",
        ...screenData,
      } as Screen;
      
      setScreens([newScreen, ...screens]);
    }
    
    setScreenDialogOpen(false);
  };
  
  const screenColumns: Column<Screen>[] = [
    {
      header: "Screen Number",
      accessor: "number" as keyof Screen
    },
    {
      header: "Screen Name",
      accessor: "name" as keyof Screen
    },
    {
      header: "Status",
      accessor: "status" as keyof Screen,
      cell: (row: Screen) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          row.status === "Active" 
            ? "bg-green-100 text-green-800" 
            : row.status === "Inactive" 
              ? "bg-yellow-100 text-yellow-800" 
              : "bg-red-100 text-red-800"
        }`}>
          {row.status}
        </span>
      )
    }
  ];
  
  const screenActions = [
    {
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: handleEditScreen
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: handleDeleteScreen
    }
  ];
  

  
  // Define the renderDialogContent function before using it
  const renderDialogContent = () => {
    return (
      <div className={isFullPage ? "container mx-auto max-w-5xl py-6" : ""}>
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
              <TabsTrigger value="general">General Information</TabsTrigger>
              <TabsTrigger value="location">Location & Systems</TabsTrigger>
              <TabsTrigger value="integration">Connectivity Details</TabsTrigger>
              <TabsTrigger value="appliances">Qube Appliances</TabsTrigger>
              <TabsTrigger value="delivery">Content & Key Delivery</TabsTrigger>
              <TabsTrigger value="screens">Screen Management</TabsTrigger>
              <TabsTrigger value="ip-suites">IP & Suites</TabsTrigger>
            </TabsList>
            
            {/* General Information Tab */}
            <TabsContent value="general" className="mt-4 space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Theatre Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name || ""}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      name="displayName"
                      value={formData.displayName || ""}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="alternateNames">Alternate Names</Label>
                  <Input
                    id="alternateNames"
                    name="alternateNames"
                    value={formData.alternateNames?.join(", ") || ""}
                    onChange={(e) => {
                      const names = e.target.value.split(",").map(n => n.trim()).filter(n => n);
                      setFormData(prev => ({ ...prev, alternateNames: names }));
                    }}
                    placeholder="Comma-separated names"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="uuid">UUID</Label>
                    <Input
                      id="uuid"
                      name="uuid"
                      value={formData.uuid || ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Theatre Location</Label>
                    <Input
                      id="address"
                      name="address"
                      value={formData.address || ""}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="theatreType">Theatre Type</Label>
                  <Combobox
                    id="theatreType"
                    value={formData.type || ""}
                    onChange={(value) => handleSelectChange("type", value ?? "")}
                    options={theatreTypeOptions}
                    placeholder="Select theatre type"
                  />
                </div>
              </div>

              {/* Chain / Company Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Chain / Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="chainName">Chain Name</Label>
                    <Combobox
                      id="chainName"
                      value={formData.chainId || ""}
                      onChange={(value) => {
                        const chain = chainsQuery.data?.find((c) => c.id === value);
                        handleSelectChange("chainId", value ?? "");
                        handleSelectChange("chainName", chain?.name ?? "");
                      }}
                      options={(chainsQuery.data ?? []).map((chain) => ({ value: chain.id, label: chain.name }))}
                      placeholder="Select chain"
                      searchPlaceholder="Search chains…"
                      loading={chainsQuery.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chainId">Chain ID</Label>
                    <Input
                      id="chainId"
                      name="chainId"
                      value={formData.chainId || ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Combobox
                      id="companyName"
                      value={formData.companyId || ""}
                      onChange={(value) => {
                        const company = companiesQuery.data?.find((c) => c.id === value);
                        handleSelectChange("companyId", value ?? "");
                        handleSelectChange("companyName", company?.name ?? "");
                      }}
                      options={(companiesQuery.data ?? []).map((company) => ({ value: company.id, label: company.name }))}
                      placeholder="Select company"
                      searchPlaceholder="Search companies…"
                      loading={companiesQuery.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyId">Company ID</Label>
                    <Input
                      id="companyId"
                      name="companyId"
                      value={formData.companyId || ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exhibitorIntegratorCompanies">Exhibitor / Integrator Companies</Label>
                  <Input
                    id="exhibitorIntegratorCompanies"
                    name="exhibitorIntegratorCompanies"
                    value={formData.exhibitorIntegratorCompanies?.join(", ") || ""}
                    disabled
                    className="bg-muted"
                    placeholder="Read-only: Comma-separated companies"
                  />
                </div>
              </div>

              {/* Thirdparty Identifiers Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold border-b pb-2 flex-1">Thirdparty Identifiers</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newMapping: TheatreMapping = {
                        id: crypto.randomUUID(),
                        domain: "",
                        theatreId: ""
                      };
                      setFormData(prev => ({
                        ...prev,
                        theatreMappings: [...(prev.theatreMappings || []), newMapping]
                      }));
                      setEditingMapping(newMapping);
                      setMappingDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Identifier
                  </Button>
                </div>
                
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(formData.theatreMappings || [])
                        .sort((a, b) => a.domain.localeCompare(b.domain))
                        .map((mapping) => {
                          const isReadOnly = mapping.domain === "cinemadb.io" || mapping.domain === "cinemark.com";
                          
                          return (
                            <TableRow key={mapping.id}>
                              <TableCell className="font-medium">{mapping.domain}</TableCell>
                              <TableCell>{mapping.theatreId}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingMapping(mapping);
                                      setMappingDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  {!isReadOnly && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setFormData(prev => ({
                                          ...prev,
                                          theatreMappings: (prev.theatreMappings || []).filter(m => m.id !== mapping.id)
                                        }));
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      {(!formData.theatreMappings || formData.theatreMappings.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            No thirdparty identifiers added. Click "Add Identifier" to create one.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Company Status Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Company Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status || ""}
                      onValueChange={(value) => handleSelectChange("status", value)}
                    >
                      <SelectTrigger id="status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Deleted">Deleted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="listing">Listing</Label>
                    <Select
                      value={formData.listing || ""}
                      onValueChange={(value) => handleSelectChange("listing", value)}
                    >
                      <SelectTrigger id="listing">
                        <SelectValue placeholder="Select listing type" />
                      </SelectTrigger>
                      <SelectContent>
                        {THEATRE_LISTINGS.map((listing) => (
                          <SelectItem key={listing} value={listing}>{listing}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            {/* Location & Systems Tab */}
            <TabsContent value="location" className="mt-4">
              <div className="space-y-6">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-medium">Location Information</h3>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address || ""}
                    onChange={handleChange}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="theatre-city">City</Label>
                    <LocationPicker
                      id="theatre-city"
                      entity="cities"
                      value={formData.cityId ? { id: formData.cityId, label: [formData.city, formData.state, formData.country].filter(Boolean).join(", ") } : null}
                      onChange={(picked, record) => {
                        const city = record as City | undefined;
                        setFormData((prev) => ({
                          ...prev,
                          cityId: picked?.id ?? null,
                          ...(city ? { city: city.name, state: city.provinceName, country: city.countryName, timezone: city.timezoneName } : {}),
                        }));
                      }}
                      placeholder={formData.city ? `${formData.city} (not linked to Locations)` : "Search for a city"}
                      searchPlaceholder="Search for a city"
                      clearable
                      aria-label="City"
                    />
                    <p className="text-xs text-muted-foreground">Province, country and timezone follow the city</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Province, Country · Timezone</Label>
                    <Input
                      value={[[formData.state, formData.country].filter(Boolean).join(", "), formData.timezone].filter(Boolean).join(" · ") || "—"}
                      disabled
                      readOnly
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      name="latitude"
                      type="number"
                      value={formData.latitude || ""}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      name="longitude"
                      type="number"
                      value={formData.longitude || ""}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      value={formData.startDate || ""}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      name="website"
                      type="url"
                      value={formData.website || ""}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contact">Contact</Label>
                  <Input
                    id="contact"
                    name="contact"
                    value={formData.contact || ""}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status || ""}
                    onValueChange={(value) => handleSelectChange("status", value)}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Deleted">Deleted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {formData.status !== "Active" && (
                  <div className="space-y-2">
                    <Label htmlFor="closureDetails">Closure Details</Label>
                    <Textarea
                      id="closureDetails"
                      name="closureDetails"
                      value={formData.closureDetails || ""}
                      onChange={handleChange}
                    />
                  </div>
                )}
                
                <div className="flex items-center space-x-2 pt-4 border-t">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-medium">Additional Details</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="screenCount">Screen Count</Label>
                    <Input
                      id="screenCount"
                      name="screenCount"
                      type="number"
                      value={formData.screenCount || ""}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locationType">Location Type</Label>
                    <Input
                      id="locationType"
                      name="locationType"
                      value={formData.locationType || ""}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Bike className="h-4 w-4" />
                    <Label htmlFor="bikeParkingAvailable">Bike Parking Available</Label>
                    <Switch
                      id="bikeParkingAvailable"
                      checked={formData.bikeParkingAvailable || false}
                      onCheckedChange={(checked) => handleSwitchChange("bikeParkingAvailable", checked)}
                    />
                  </div>
                  {formData.bikeParkingAvailable && (
                    <div className="space-y-2">
                      <Label htmlFor="bikeParkingCapacity">Bike Parking Capacity</Label>
                      <Input
                        id="bikeParkingCapacity"
                        name="bikeParkingCapacity"
                        type="number"
                        value={formData.bikeParkingCapacity || ""}
                        onChange={handleChange}
                      />
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Car className="h-4 w-4" />
                    <Label htmlFor="carParkingAvailable">Car Parking Available</Label>
                    <Switch
                      id="carParkingAvailable"
                      checked={formData.carParkingAvailable || false}
                      onCheckedChange={(checked) => handleSwitchChange("carParkingAvailable", checked)}
                    />
                  </div>
                  {formData.carParkingAvailable && (
                    <div className="space-y-2">
                      <Label htmlFor="carParkingCapacity">Car Parking Capacity</Label>
                      <Input
                        id="carParkingCapacity"
                        name="carParkingCapacity"
                        type="number"
                        value={formData.carParkingCapacity || ""}
                        onChange={handleChange}
                      />
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2 pt-4 border-t">
                  <Monitor className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-medium">System Information</h3>
                </div>
                
                <TheatreSystemsFields
                  chainId={formData.chainId}
                  chainName={formData.chainName}
                  tmsId={formData.tmsId}
                  tmsName={formData.theatreManagementSystem}
                  ticketingSystemId={formData.ticketingSystemId}
                  ticketingSystemName={formData.ticketingSystem}
                  onChange={handleSystemChange}
                />
              </div>
            </TabsContent>
            
            {/* Connectivity Details Tab */}
            <TabsContent value="integration" className="mt-4">
              <div className="space-y-6">
                {/* Download Restrictions Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Network className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Download Restrictions</h3>
                  </div>
                  
                  <div className="border rounded-md p-4 space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="enableDownloadRestrictions"
                        checked={formData.downloadRestrictionsEnabled || false}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            downloadRestrictionsEnabled: checked as boolean,
                            downloadRestrictions: checked ? (formData.downloadRestrictions || {
                              sunday: { startTime: "", endTime: "" },
                              monday: { startTime: "", endTime: "" },
                              tuesday: { startTime: "", endTime: "" },
                              wednesday: { startTime: "", endTime: "" },
                              thursday: { startTime: "", endTime: "" },
                              friday: { startTime: "", endTime: "" },
                              saturday: { startTime: "", endTime: "" }
                            }) : undefined
                          });
                        }}
                      />
                      <Label htmlFor="enableDownloadRestrictions" className="cursor-pointer">
                        Enable Download Restrictions
                      </Label>
                    </div>

                    {formData.downloadRestrictionsEnabled && (
                      <div className="space-y-3 pt-2">
                        {/* Column Headers */}
                        <div className="grid grid-cols-[120px_1fr_1fr] gap-4 items-center">
                          <div></div>
                          <Label className="text-xs text-muted-foreground font-semibold">Start Time</Label>
                          <Label className="text-xs text-muted-foreground font-semibold">End Time</Label>
                        </div>
                        
                        {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => {
                          const dayKey = day.toLowerCase() as keyof DownloadRestrictions;
                          const restrictions = formData.downloadRestrictions || {
                            sunday: { startTime: "", endTime: "" },
                            monday: { startTime: "", endTime: "" },
                            tuesday: { startTime: "", endTime: "" },
                            wednesday: { startTime: "", endTime: "" },
                            thursday: { startTime: "", endTime: "" },
                            friday: { startTime: "", endTime: "" },
                            saturday: { startTime: "", endTime: "" }
                          };
                          const dayRestriction = restrictions[dayKey];
                          
                          return (
                            <div key={day} className="grid grid-cols-[120px_1fr_1fr] gap-4 items-center">
                              <Label className="font-medium">{day}</Label>
                              <Input
                                type="time"
                                value={dayRestriction.startTime}
                                onChange={(e) => {
                                  setFormData({
                                    ...formData,
                                    downloadRestrictions: {
                                      ...restrictions,
                                      [dayKey]: {
                                        ...dayRestriction,
                                        startTime: e.target.value
                                      }
                                    }
                                  });
                                }}
                              />
                              <Input
                                type="time"
                                value={dayRestriction.endTime}
                                onChange={(e) => {
                                  setFormData({
                                    ...formData,
                                    downloadRestrictions: {
                                      ...restrictions,
                                      [dayKey]: {
                                        ...dayRestriction,
                                        endTime: e.target.value
                                      }
                                    }
                                  });
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* ISP Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 pt-4 border-t">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">ISP Information</h3>
                  </div>
                  <div className="border rounded-md p-4 text-center">
                    <p className="text-muted-foreground">ISP information configuration coming soon</p>
                  </div>
                </div>

                {/* Billing Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 pt-4 border-t">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Billing Information</h3>
                  </div>
                  <div className="border rounded-md p-4 text-center">
                    <p className="text-muted-foreground">Billing information configuration coming soon</p>
                  </div>
                </div>

                {/* IP Configuration Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 pt-4 border-t">
                    <Cable className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">IP Configuration</h3>
                  </div>
                  <div className="border rounded-md p-4 text-center">
                    <p className="text-muted-foreground">IP configuration coming soon</p>
                  </div>
                </div>

                {/* Live Wire Configuration Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 pt-4 border-t">
                    <Cable className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Live Wire Configuration</h3>
                  </div>
                  <LiveWireSettings theatreId={theatre?.id} theatreName={theatre?.name ?? formData.name ?? ""} />
                </div>

                {/* Configuration Notes Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 pt-4 border-t">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Configuration Notes</h3>
                  </div>
                  <div className="space-y-2">
                    <RichTextEditor
                      value={formData.configurationNotes || ""}
                      onChange={(value) =>
                        setFormData({ ...formData, configurationNotes: value })
                      }
                      placeholder="Add configuration notes, instructions, or any important information..."
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            {/* Content & Key Delivery Tab */}
            <TabsContent value="delivery" className="mt-4">
              <div className="space-y-6">
                {/* PART 1: CONTENT DELIVERY */}
                <div className="flex items-center space-x-2">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-medium">Content Delivery</h3>
                </div>
                
                {/* Delivery Time Slots */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Delivery Time Slots</Label>
                    <Button 
                      type="button" 
                      onClick={handleAddDeliveryTimeSlot} 
                      size="sm" 
                      variant="outline"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Time Slot
                    </Button>
                  </div>
                  
                  {formData.deliveryTimeSlots && formData.deliveryTimeSlots.length > 0 ? (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Day</TableHead>
                            <TableHead>Start Time</TableHead>
                            <TableHead>End Time</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {formData.deliveryTimeSlots.map((slot) => (
                            <TableRow key={slot.id}>
                              <TableCell>
                                <Combobox
                                  aria-label="Day"
                                  value={slot.day}
                                  onChange={(value) => handleDeliveryTimeSlotChange(
                                    slot.id, 
                                    "day", 
                                    value ?? ""
                                  )}
                                  options={weekDayOptions}
                                  placeholder="Select day"
                                />
                              </TableCell>
                              <TableCell>
                                <Input 
                                  type="time" 
                                  value={slot.startTime} 
                                  onChange={(e) => handleDeliveryTimeSlotChange(slot.id, "startTime", e.target.value)} 
                                />
                              </TableCell>
                              <TableCell>
                                <Input 
                                  type="time" 
                                  value={slot.endTime} 
                                  onChange={(e) => handleDeliveryTimeSlotChange(slot.id, "endTime", e.target.value)} 
                                />
                              </TableCell>
                              <TableCell className="flex items-center space-x-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCopyToAllDays(slot.id)}
                                  title="Copy to all days"
                                >
                                  <Clock className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteDeliveryTimeSlot(slot.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="border rounded-md p-8 text-center">
                      <p className="text-muted-foreground mb-4">No delivery time slots have been added yet</p>
                      <Button 
                        type="button" 
                        onClick={handleAddDeliveryTimeSlot} 
                        variant="outline"
                      >
                        <Plus className="h-4 w-4 mr-2" /> Add Time Slot
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Delivery Address */}
                <div className="space-y-4">
                  <Label>Delivery Address</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="useTheatreAddress"
                      checked={formData.deliveryAddress?.useTheatreAddress || false}
                      onCheckedChange={(checked) => handleDeliveryAddressChange("useTheatreAddress", checked)}
                    />
                    <Label htmlFor="useTheatreAddress">Use Theatre Address</Label>
                  </div>
                  
                  {!formData.deliveryAddress?.useTheatreAddress && (
                    <div className="space-y-4 mt-2">
                      <div className="space-y-2">
                        <Label htmlFor="deliveryAddress">Address</Label>
                        <Input
                          id="deliveryAddress"
                          value={formData.deliveryAddress?.address || ""}
                          onChange={(e) => handleDeliveryAddressChange("address", e.target.value)}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="deliveryCity">City</Label>
                          <Input
                            id="deliveryCity"
                            value={formData.deliveryAddress?.city || ""}
                            onChange={(e) => handleDeliveryAddressChange("city", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="deliveryState">State</Label>
                          <Input
                            id="deliveryState"
                            value={formData.deliveryAddress?.state || ""}
                            onChange={(e) => handleDeliveryAddressChange("state", e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="deliveryPostalCode">Postal Code</Label>
                          <Input
                            id="deliveryPostalCode"
                            value={formData.deliveryAddress?.postalCode || ""}
                            onChange={(e) => handleDeliveryAddressChange("postalCode", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="deliveryCountry">Country</Label>
                          <Input
                            id="deliveryCountry"
                            value={formData.deliveryAddress?.country || ""}
                            onChange={(e) => handleDeliveryAddressChange("country", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Delivery Instructions */}
                <div className="space-y-2">
                  <Label htmlFor="deliveryInstructions">Delivery Instructions / Notes</Label>
                  <Textarea
                    id="deliveryInstructions"
                    name="deliveryInstructions"
                    value={formData.deliveryInstructions || ""}
                    onChange={handleChange}
                    placeholder="Add any special instructions for delivery"
                  />
                </div>
                
                {/* DCP Physical Delivery Methods */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>DCP Physical Delivery Methods</Label>
                    <Button 
                      type="button" 
                      onClick={handleAddPhysicalDeliveryMethod} 
                      size="sm" 
                      variant="outline"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Method
                    </Button>
                  </div>
                  
                  {formData.dcpPhysicalDeliveryMethods && formData.dcpPhysicalDeliveryMethods.length > 0 ? (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Media Type</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {formData.dcpPhysicalDeliveryMethods.map((method) => (
                            <TableRow key={method.id}>
                              <TableCell>
                                <Input 
                                  value={method.mediaType || ""} 
                                  onChange={(e) => handlePhysicalDeliveryMethodChange(method.id, "mediaType", e.target.value)} 
                                  placeholder="e.g. Hard Drive, USB"
                                />
                              </TableCell>
                              <TableCell>
                                <Input 
                                  value={method.details || ""} 
                                  onChange={(e) => handlePhysicalDeliveryMethodChange(method.id, "details", e.target.value)} 
                                  placeholder="Additional details"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeletePhysicalDeliveryMethod(method.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="border rounded-md p-4 text-center">
                      <p className="text-muted-foreground mb-4">No physical delivery methods have been added yet</p>
                      <Button 
                        type="button" 
                        onClick={handleAddPhysicalDeliveryMethod} 
                        variant="outline"
                      >
                        <Plus className="h-4 w-4 mr-2" /> Add Method
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* DCP Network Delivery Methods */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>DCP Network Delivery Methods</Label>
                    <Button 
                      type="button" 
                      onClick={handleAddNetworkDeliveryMethod} 
                      size="sm" 
                      variant="outline"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Method
                    </Button>
                  </div>
                  
                  {formData.dcpNetworkDeliveryMethods && formData.dcpNetworkDeliveryMethods.length > 0 ? (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Network URL</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {formData.dcpNetworkDeliveryMethods.map((method) => (
                            <TableRow key={method.id}>
                              <TableCell>
                                <Input 
                                  value={method.networkURL || ""} 
                                  onChange={(e) => handleNetworkDeliveryMethodChange(method.id, "networkURL", e.target.value)} 
                                  placeholder="Enter network URL"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteNetworkDeliveryMethod(method.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="border rounded-md p-4 text-center">
                      <p className="text-muted-foreground mb-4">No network delivery methods have been added yet</p>
                      <Button 
                        type="button" 
                        onClick={handleAddNetworkDeliveryMethod} 
                        variant="outline"
                      >
                        <Plus className="h-4 w-4 mr-2" /> Add Method
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* DCP Modem Delivery Methods */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>DCP Modem Delivery Methods</Label>
                    <Button 
                      type="button" 
                      onClick={handleAddModemDeliveryMethod} 
                      size="sm" 
                      variant="outline"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Method
                    </Button>
                  </div>
                  
                  {formData.dcpModemDeliveryMethods && formData.dcpModemDeliveryMethods.length > 0 ? (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Modem Phone Number</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {formData.dcpModemDeliveryMethods.map((method) => (
                            <TableRow key={method.id}>
                              <TableCell>
                                <Input 
                                  value={method.modemPhoneNumber || ""} 
                                  onChange={(e) => handleModemDeliveryMethodChange(method.id, "modemPhoneNumber", e.target.value)} 
                                  placeholder="Enter modem phone number"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteModemDeliveryMethod(method.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="border rounded-md p-4 text-center">
                      <p className="text-muted-foreground mb-4">No modem delivery methods have been added yet</p>
                      <Button 
                        type="button" 
                        onClick={handleAddModemDeliveryMethod} 
                        variant="outline"
                      >
                        <Plus className="h-4 w-4 mr-2" /> Add Method
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* DCP Delivery Contacts */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>DCP Delivery Contacts</Label>
                    <Button 
                      type="button" 
                      onClick={handleAddDCPDeliveryContact} 
                      size="sm" 
                      variant="outline"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Contact
                    </Button>
                  </div>
                  
                  {formData.dcpDeliveryContacts && formData.dcpDeliveryContacts.length > 0 ? (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name (Optional)</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {formData.dcpDeliveryContacts.map((contact) => (
                            <TableRow key={contact.id}>
                              <TableCell>
                                <Input 
                                  value={contact.name || ""} 
                                  onChange={(e) => handleDCPDeliveryContactChange(contact.id, "name", e.target.value)} 
                                  placeholder="Contact name"
                                />
                              </TableCell>
                              <TableCell>
                                <Input 
                                  value={contact.email || ""} 
                                  onChange={(e) => handleDCPDeliveryContactChange(contact.id, "email", e.target.value)} 
                                  placeholder="Email address"
                                  type="email"
                                  required
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteDCPDeliveryContact(contact.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="border rounded-md p-4 text-center">
                      <p className="text-muted-foreground mb-4">No DCP delivery contacts have been added yet</p>
                      <Button 
                        type="button" 
                        onClick={handleAddDCPDeliveryContact} 
                        variant="outline"
                      >
                        <Plus className="h-4 w-4 mr-2" /> Add Contact
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Send Emails for DCP Delivery */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="sendEmailsForDCPDelivery"
                      checked={formData.sendEmailsForDCPDelivery || false}
                      onCheckedChange={(checked) => handleSwitchChange("sendEmailsForDCPDelivery", checked)}
                    />
                    <Label htmlFor="sendEmailsForDCPDelivery">Send Emails for DCP Delivery</Label>
                  </div>
                </div>
                
                {/* DCP Content Type for Email */}
                {formData.sendEmailsForDCPDelivery && (
                  <div className="space-y-2">
                    <Label>Send Emails for DCP Content Type</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {contentTypeOptions.map((option) => (
                        <div key={option.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`content-type-${option.id}`}
                            checked={(formData.dcpContentTypesForEmail || []).includes(option.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                handleContentTypeChange(option.id);
                              } else {
                                handleContentTypeChange(option.id);
                              }
                            }}
                          />
                          <Label htmlFor={`content-type-${option.id}`} className="text-sm">
                            {option.label} ({option.id})
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* PART 2: KEY DELIVERY */}
                <div className="flex items-center space-x-2 pt-6 border-t mt-6">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-medium">Key Delivery</h3>
                </div>
                
                {/* Key Delivery Contacts */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Key Delivery Contacts</Label>
                    <Button 
                      type="button" 
                      onClick={handleAddKeyDeliveryContact} 
                      size="sm" 
                      variant="outline"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Contact
                    </Button>
                  </div>
                  
                  {formData.keyDeliveryContacts && formData.keyDeliveryContacts.length > 0 ? (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name (Optional)</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {formData.keyDeliveryContacts.map((contact) => (
                            <TableRow key={contact.id}>
                              <TableCell>
                                <Input 
                                  value={contact.name || ""} 
                                  onChange={(e) => handleKeyDeliveryContactChange(contact.id, "name", e.target.value)} 
                                  placeholder="Contact name"
                                />
                              </TableCell>
                              <TableCell>
                                <Input 
                                  value={contact.email || ""} 
                                  onChange={(e) => handleKeyDeliveryContactChange(contact.id, "email", e.target.value)} 
                                  placeholder="Email address"
                                  type="email"
                                  required
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteKeyDeliveryContact(contact.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="border rounded-md p-4 text-center">
                      <p className="text-muted-foreground mb-4">No key delivery contacts have been added yet</p>
                      <Button 
                        type="button" 
                        onClick={handleAddKeyDeliveryContact} 
                        variant="outline"
                      >
                        <Plus className="h-4 w-4 mr-2" /> Add Contact
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* KDM Delivery Emails in FLM-X */}
                <div className="space-y-4">
                  <Label>KDM Delivery Emails in FLM-X</Label>
                  <RadioGroup 
                    value={formData.kdmDeliveryEmailsInFLMX || "useDropbox"}
                    onValueChange={(value) => handleSelectChange("kdmDeliveryEmailsInFLMX", value)}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="useDropbox" id="kdm-dropbox" />
                      <Label htmlFor="kdm-dropbox">Use dropbox@qubewire.com</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="useKeyDeliveryContacts" id="kdm-contacts" />
                      <Label htmlFor="kdm-contacts">Use above emails from Key Delivery Contacts</Label>
                    </div>
                  </RadioGroup>
                </div>

                <TimeSlotsEditor
                  label="KDM Auto-Ingestion Time Slots"
                  slots={formData.kdmAutoIngestTimeSlots || []}
                  onChange={(kdmAutoIngestTimeSlots) => setFormData((prev) => ({ ...prev, kdmAutoIngestTimeSlots }))}
                  emptyText="No KDM auto-ingestion time slots. KDMs are ingested as soon as they arrive."
                />
                
                {/* PART 3: INGEST SETTINGS */}
                <div className="flex items-center space-x-2 pt-6 border-t mt-6">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-medium">Ingest Settings</h3>
                </div>
                
                {/* Auto Ingest of Content */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="autoIngestOfContentEnabled"
                      checked={formData.autoIngestOfContentEnabled || false}
                      onCheckedChange={(checked) => handleSwitchChange("autoIngestOfContentEnabled", checked)}
                    />
                    <Label htmlFor="autoIngestOfContentEnabled">Auto Ingest of Content Enabled</Label>
                  </div>
                </div>
                
                {/* Auto Ingest Content Types */}
                {formData.autoIngestOfContentEnabled && (
                  <div className="space-y-2">
                    <Label>Select Content Type enabled for auto Ingest</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {contentTypeOptions.map((option) => (
                        <div key={option.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`autoingest-content-type-${option.id}`}
                            checked={(formData.autoIngestContentTypes || []).includes(option.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                handleAutoIngestContentTypeChange(option.id);
                              } else {
                                handleAutoIngestContentTypeChange(option.id);
                              }
                            }}
                          />
                          <Label htmlFor={`autoingest-content-type-${option.id}`} className="text-sm">
                            {option.label} ({option.id})
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {formData.autoIngestOfContentEnabled && (
                  <TimeSlotsEditor
                    label="Auto-Ingestion Time Slots"
                    slots={formData.autoIngestTimeSlots || []}
                    onChange={(autoIngestTimeSlots) => setFormData((prev) => ({ ...prev, autoIngestTimeSlots }))}
                    emptyText="No auto-ingestion time slots. Content is ingested as soon as it arrives."
                  />
                )}
                
                {/* QCN Theatre IP Address Range */}
                <div className="space-y-2">
                  <Label htmlFor="qcnTheatreIPAddressRange">QCN Theatre IP Address Range</Label>
                  <Input
                    id="qcnTheatreIPAddressRange"
                    name="qcnTheatreIPAddressRange"
                    value={formData.qcnTheatreIPAddressRange || ""}
                    onChange={handleChange}
                    placeholder="e.g. 192.168.0.0/24"
                  />
                </div>
              </div>
            </TabsContent>
            
            {/* Screen Management Tab */}
            <TabsContent value="screens" className="mt-4">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-medium">Screens</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage screens associated with this theatre
                    </p>
                  </div>
                  <Button onClick={handleCreateScreen} type="button">
                    <Plus className="h-4 w-4 mr-2" /> Add Screen
                  </Button>
                </div>
                
                {screens.length > 0 ? (
                  <DataTable
                    data={screens}
                    columns={screenColumns}
                    searchPlaceholder="Search screens..."
                    actions={screenActions}
                  />
                ) : (
                  <div className="border rounded-md p-8 text-center">
                    <p className="text-muted-foreground mb-4">No screens have been added yet</p>
                    <Button onClick={handleCreateScreen} type="button">
                      <Plus className="h-4 w-4 mr-2" /> Add Screen
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
            
            {/* Qube Appliances Tab */}
            <TabsContent value="appliances" className="mt-4 space-y-6">
              {/* WireTAP Section */}
              <WireTAPAppliancesSection theatreId={formData.id} />

              {/* Moviebuff Access Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Moviebuff Access
                </h3>
                <div className="rounded-lg border p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    No Moviebuff Access devices configured for this theatre.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* IP & Suites Tab */}
            <TabsContent value="ip-suites" className="mt-4">
              <IPSuitesTabContent 
                screens={screens}
                onScreenDataChange={(screenId, dataType, data) => {
                  setScreens((prev) => prev.map((s) => (s.id === screenId ? { ...s, [dataType]: data } : s)));
                }}
              />
            </TabsContent>
          </Tabs>
          
          <FormActions className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {common.cancel}
            </Button>
            <Button type="submit" loading={saving}>
              {common.save}
            </Button>
          </FormActions>
        </form>
      </div>
    );
  };

  return (
    <>
      {isFullPage ? (
        renderDialogContent()
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>{isEditing ? `Edit ${formData.name}` : 'Add New Theatre'}</DialogTitle>
              <DialogDescription>
                {isEditing ? 'Update the details of an existing theatre' : 'Enter the details to create a new theatre'}
              </DialogDescription>
            </DialogHeader>
            {renderDialogContent()}
          </DialogContent>
        </Dialog>
      )}
      
      <ScreenDialog
        key={`${editingScreen?.id ?? "new"}-${screenDialogOpen}`}
        open={screenDialogOpen}
        onOpenChange={setScreenDialogOpen}
        theatreId={formData.id || ""}
        screen={editingScreen}
        otherScreens={screens.filter((s) => s.id !== editingScreen?.id)}
        onSave={handleSaveScreen}
      />
      
      {editingMapping && (
        <EditTheatreMappingDialog
          open={mappingDialogOpen}
          onOpenChange={setMappingDialogOpen}
          mapping={editingMapping}
          onSave={(updatedMapping) => {
            setFormData(prev => ({
              ...prev,
              theatreMappings: (prev.theatreMappings || []).map(m =>
                m.id === updatedMapping.id ? updatedMapping : m
              )
            }));
          }}
          isReadOnly={editingMapping.domain === "cinemadb.io" || editingMapping.domain === "cinemark.com"}
        />
      )}
    </>
  );
};
