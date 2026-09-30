
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Edit, Trash2, Eye, RefreshCw, Signal } from "lucide-react";
import { format } from "date-fns";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { WireTAPDevice } from "@/types/wireTAP";
import { useAddWireTAPDevicesToInventory, useNewWireTAPDevices, useSetWireTAPActivation, useWireTAPDevices } from "@/hooks/api/wiretap";
import { QueryState } from "@/components/ui/query-state";
import { getDeviceColumns } from "@/components/wiretap/DeviceColumns";
import { DeviceLogsDialog } from "@/components/wiretap/DeviceLogsDialog";
import { DeactivateDeviceDialog } from "@/components/wiretap/DeactivateDeviceDialog";
import { FetchNewDevicesDialog } from "@/components/wiretap/FetchNewDevicesDialog";
import { ConnectivityStatusOverlay } from "@/components/wiretap/ConnectivityStatusOverlay";
import { WireTAPFilterPanel, AppliedFilterPills, WireTAPFilters, emptyFilters, countWireTAPFilters } from "@/components/wiretap/WireTAPFilterPanel";
import { FilterButton } from "@/components/ui/filter-drawer";

const WireTAPDevices = () => {
  const navigate = useNavigate();
  const devicesQuery = useWireTAPDevices();
  const devices = useMemo(() => devicesQuery.data ?? [], [devicesQuery.data]);
  const setActivation = useSetWireTAPActivation();
  const addToInventory = useAddWireTAPDevicesToInventory();
  // Only fetched when the user asks ("Fetch new devices").
  const newDevicesQuery = useNewWireTAPDevices(false);
  const [filters, setFilters] = useState<WireTAPFilters>({ ...emptyFilters });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isViewLogsDialogOpen, setIsViewLogsDialogOpen] = useState(false);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [isFetchNewDevicesDialogOpen, setIsFetchNewDevicesDialogOpen] = useState(false);
  const [isConnectivityOverlayOpen, setIsConnectivityOverlayOpen] = useState(false);
  const [currentDevice, setCurrentDevice] = useState<WireTAPDevice | null>(null);
  const [lastFetchedDate, setLastFetchedDate] = useState<Date>(new Date());

  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      if (filters.connectivityType.length && !filters.connectivityType.includes(d.connectivityType)) return false;
      if (filters.theatreChain.length && !filters.theatreChain.includes(d.theatreName)) return false;
      if (filters.storageCapacity.length && !filters.storageCapacity.includes(d.storageCapacity)) return false;
      if (filters.applianceType.length && !filters.applianceType.includes(d.wireTapApplianceType)) return false;
      if (filters.activationStatus.length && !filters.activationStatus.includes(d.activationStatus)) return false;
      if (filters.mappingStatus.length && !filters.mappingStatus.includes(d.mappingStatus)) return false;
      if (filters.internetConnectivity.length && !filters.internetConnectivity.includes(d.connectivity?.status || "Unknown")) return false;
      if (filters.vpnStatus.length && !filters.vpnStatus.includes(d.vpnStatus)) return false;
      return true;
    });
  }, [devices, filters]);

  const handleActivateDevice = (device: WireTAPDevice) => {
    setActivation.mutate({ id: device.id, status: "Active" }, {
      onSuccess: () => toast.success(`Device ${device.hardwareSerialNumber} activated successfully`),
      onError: (err) => toast.error(`Could not activate ${device.hardwareSerialNumber}: ${err.message}`),
    });
  };

  const handleDeactivateDevice = (device: WireTAPDevice, reason: string) => {
    setActivation.mutate({ id: device.id, status: "Inactive", reason }, {
      onSuccess: () => toast.success(`Device ${device.hardwareSerialNumber} deactivated successfully`),
      onError: (err) => toast.error(`Could not deactivate ${device.hardwareSerialNumber}: ${err.message}`),
    });
  };

  const handleToggleDeviceActivation = (device: WireTAPDevice) => {
    if (device.activationStatus === "Active") {
      // Show confirmation dialog for deactivation
      setCurrentDevice(device);
      setIsDeactivateDialogOpen(true);
    } else {
      // Activate directly without confirmation
      handleActivateDevice(device);
    }
  };
  
  const handleViewLogs = (device: WireTAPDevice) => {
    setCurrentDevice(device);
    setIsViewLogsDialogOpen(true);
  };

  const handleFetchNewDevices = () => {
    newDevicesQuery.refetch();
    setLastFetchedDate(new Date());
    setIsFetchNewDevicesDialogOpen(true);
  };

  const handleAddNewDevices = (selectedDevices: WireTAPDevice[]) => {
    if (selectedDevices.length === 0) return;
    addToInventory.mutate(selectedDevices.map((d) => d.id), {
      onSuccess: () =>
        toast.success(`${selectedDevices.length} device${selectedDevices.length !== 1 ? 's' : ''} added to inventory`),
      onError: (err) => toast.error(`Could not add devices to inventory: ${err.message}`),
    });
  };

  const columns = getDeviceColumns();

  const handleViewConnectivity = (device: WireTAPDevice) => {
    setCurrentDevice(device);
    setIsConnectivityOverlayOpen(true);
  };

  const getActions = (device: WireTAPDevice) => [
    {
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: (device: WireTAPDevice) => {
        navigate(`/wiretap-devices/${device.id}/edit`);
      }
    },
    {
      label: device.activationStatus === "Active" ? "Deactivate" : "Activate",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: handleToggleDeviceActivation
    },
    {
      label: "View Logs",
      icon: <Eye className="h-4 w-4" />,
      onClick: handleViewLogs
    },
    {
      label: "View Connectivity",
      icon: <Signal className="h-4 w-4" />,
      onClick: handleViewConnectivity
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Manage your WireTAP devices across all theatres
        </p>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button onClick={handleFetchNewDevices} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" /> Fetch new devices
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Last fetched on {format(lastFetchedDate, "dd MMM yyyy hh:mm a")}
          </p>
        </div>
      </div>

      <AppliedFilterPills filters={filters} onFiltersChange={setFilters} />
      
      <QueryState query={devicesQuery} label="WireTAP devices">
        {() => (
          <DataTable
            data={filteredDevices}
            exportName="WireTAP Devices"
            columns={columns}
            searchable={true}
            searchPlaceholder="Search WireTAP devices..."
            actions={getActions}
            onRowClick={handleViewConnectivity}
            showFilters={false}
            toolbar={<FilterButton count={countWireTAPFilters(filters)} onClick={() => setFiltersOpen(true)} />}
          />
        )}
      </QueryState>
      
      <WireTAPFilterPanel
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        devices={devices}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <ConnectivityStatusOverlay
        device={currentDevice}
        isOpen={isConnectivityOverlayOpen}
        onOpenChange={setIsConnectivityOverlayOpen}
      />
      
      <DeviceLogsDialog
        isOpen={isViewLogsDialogOpen}
        onOpenChange={setIsViewLogsDialogOpen}
        device={currentDevice}
      />
      
      <DeactivateDeviceDialog
        isOpen={isDeactivateDialogOpen}
        onOpenChange={setIsDeactivateDialogOpen}
        device={currentDevice}
        onConfirm={handleDeactivateDevice}
      />
      
      <FetchNewDevicesDialog
        isOpen={isFetchNewDevicesDialogOpen}
        onOpenChange={setIsFetchNewDevicesDialogOpen}
        newDevices={newDevicesQuery.data ?? []}
        isLoading={newDevicesQuery.isFetching}
        error={newDevicesQuery.error}
        onAddDevices={handleAddNewDevices}
      />
    </motion.div>
  );
};

export default WireTAPDevices;
