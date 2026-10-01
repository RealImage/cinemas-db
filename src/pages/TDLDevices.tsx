import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { DataTable, Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterButton } from "@/components/ui/filter-drawer";
import { Link } from "react-router-dom";
import { Plus, Edit, Search, Upload, Archive, RefreshCw } from "lucide-react";
import { useRetireTDLDevice, useTDLDevices } from "@/hooks/api/tdl";
import { QueryState } from "@/components/ui/query-state";
import { TDLDevice } from "@/types";
import { toast } from "sonner";
import { formatDate } from "@/lib/dateUtils";
import { TDLFilterPanel, TDLFilterBadges, TDLFilters } from "@/components/tdl/TDLFilterPanel";

const TDLDevices = () => {
  const devicesQuery = useTDLDevices();
  const retireDevice = useRetireTDLDevice();
  const devices = useMemo(() => devicesQuery.data ?? [], [devicesQuery.data]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<TDLFilters>({});
  const [filterOpen, setFilterOpen] = useState(false);

  const handleCreateDevice = () => {
    toast.info("Device creation will be implemented in a future update");
  };

  const handleUploadCertificate = (device: TDLDevice) => {
    toast.info(`Upload certificate for: ${device.manufacturer} ${device.model} (${device.serialNumber})`);
  };

  const handleEditDevice = (device: TDLDevice) => {
    toast.info(`Editing device: ${device.manufacturer} ${device.model} (${device.serialNumber})`);
  };

  const handleRetireDevice = async (device: TDLDevice) => {
    if (device.retired) {
      toast.info(`${device.manufacturer} ${device.model} (${device.serialNumber}) is already retired`);
      return;
    }
    try {
      await retireDevice.mutateAsync(device.id);
      toast.success(`Retired device: ${device.manufacturer} ${device.model} (${device.serialNumber})`);
    } catch (err) {
      toast.error(`Could not retire device: ${(err as Error).message}`);
    }
  };

  // Custom search: Model, Serial Number, Public Key Thumbprint, Issuer Thumbprint
  const searchFiltered = useMemo(() => {
    if (!searchTerm) return devices;
    const term = searchTerm.toLowerCase();
    return devices.filter(
      (d) =>
        d.model.toLowerCase().includes(term) ||
        d.serialNumber.toLowerCase().includes(term) ||
        d.publicKeyThumbprint.toLowerCase().includes(term) ||
        d.issuerThumbprint.toLowerCase().includes(term)
    );
  }, [devices, searchTerm]);

  // Apply filters
  const filteredDevices = useMemo(() => {
    let result = searchFiltered;

    if (filters.manufacturer) {
      result = result.filter((d) => d.manufacturer === filters.manufacturer);
    }
    if (filters.deviceRole) {
      result = result.filter((d) => d.deviceRole === filters.deviceRole);
    }
    if (filters.certificateAutoSync !== undefined) {
      const syncVal = filters.certificateAutoSync === "true";
      result = result.filter((d) => d.certificateAutoSync === syncVal);
    }
    if (filters.source) {
      result = result.filter((d) => d.source === filters.source);
    }
    if (filters.retired !== undefined) {
      const retiredVal = filters.retired === "true";
      result = result.filter((d) => d.retired === retiredVal);
    }
    if (filters.validTillFrom) {
      result = result.filter((d) => new Date(d.validTill) >= filters.validTillFrom!);
    }
    if (filters.validTillTo) {
      result = result.filter((d) => new Date(d.validTill) <= filters.validTillTo!);
    }
    if (filters.updatedFrom) {
      result = result.filter((d) => new Date(d.updatedOn) >= filters.updatedFrom!);
    }
    if (filters.updatedTo) {
      result = result.filter((d) => new Date(d.updatedOn) <= filters.updatedTo!);
    }

    return result;
  }, [searchFiltered, filters]);

  const activeCount = Object.keys(filters).length;

  const removeFilter = (key: keyof TDLFilters) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const clearAll = () => setFilters({});

  const columns: Column<TDLDevice>[] = [
    { header: "Manufacturer / Make", accessor: "manufacturer" as keyof TDLDevice },
    { header: "Model", accessor: "model" as keyof TDLDevice },
    { header: "Serial Number", accessor: "serialNumber" as keyof TDLDevice },
    { header: "Software Version", accessor: "softwareVersion" as keyof TDLDevice },
    { header: "Device Role", accessor: "deviceRole" as keyof TDLDevice },
    {
      header: "Certificate Auto-Sync",
      accessor: "certificateAutoSync" as keyof TDLDevice,
      cell: (row: TDLDevice) => (
        <span className={row.certificateAutoSync ? "text-green-600" : "text-muted-foreground"}>
          {row.certificateAutoSync ? "Yes" : "No"}
        </span>
      ),
    },
    {
      header: "Valid Till",
      accessor: "validTill" as keyof TDLDevice,
      cell: (row: TDLDevice) => {
        const isExpired = new Date(row.validTill) < new Date();
        return <span className={isExpired ? "text-destructive" : ""}>{formatDate(row.validTill)}</span>;
      },
    },
    { header: "Public Key Thumbprint", accessor: "publicKeyThumbprint" as keyof TDLDevice },
    { header: "Issuer Thumbprint", accessor: "issuerThumbprint" as keyof TDLDevice },
    { header: "Source", accessor: "source" as keyof TDLDevice },
    {
      header: "Retired?",
      accessor: "retired" as keyof TDLDevice,
      cell: (row: TDLDevice) => (
        <span className={row.retired ? "text-destructive font-medium" : "text-muted-foreground"}>
          {row.retired ? "Yes" : "No"}
        </span>
      ),
    },
    { header: "Updated By", accessor: "updatedBy" as keyof TDLDevice },
    {
      header: "Updated On",
      accessor: "updatedOn" as keyof TDLDevice,
      cell: (row: TDLDevice) => formatDate(row.updatedOn),
    },
  ];

  const actions = [
    {
      label: "Upload Certificate",
      icon: <Upload className="h-4 w-4" />,
      onClick: handleUploadCertificate,
    },
    {
      label: "Edit Device",
      icon: <Edit className="h-4 w-4" />,
      onClick: handleEditDevice,
    },
    {
      label: "Retire Device",
      icon: <Archive className="h-4 w-4" />,
      onClick: handleRetireDevice,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground">
          Manage Trusted Device List (TDL) devices across all theatres
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/theatre-device-management/tdl-devices/sync-status">
              <RefreshCw className="h-4 w-4" />
              Sync Status
            </Link>
          </Button>
          <Button onClick={handleCreateDevice}>
            <Plus className="h-4 w-4 mr-2" /> Add Device
          </Button>
        </div>
      </div>

      {/* Search + Filter trigger */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Model, Serial Number, Public Key or Issuer Thumbprint..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <FilterButton count={activeCount} onClick={() => setFilterOpen(true)} />
      </div>

      {/* Applied filter badges */}
      <TDLFilterBadges filters={filters} onRemove={removeFilter} onClearAll={clearAll} />

      <TDLFilterPanel
        open={filterOpen}
        onOpenChange={setFilterOpen}
        devices={devices}
        filters={filters}
        onApply={setFilters}
        onClear={clearAll}
      />

      <QueryState query={devicesQuery} label="TDL devices">
        {() => (
          <DataTable
            data={filteredDevices}
            columns={columns}
            searchable={false}
            actions={actions}
          />
        )}
      </QueryState>
    </motion.div>
  );
};

export default TDLDevices;
