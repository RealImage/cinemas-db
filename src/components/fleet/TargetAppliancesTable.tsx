import { useState, useMemo } from "react";
import { formatDateTime } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Search, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskAppliance } from "@/pages/FleetTaskEdit";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";

interface TargetAppliancesTableProps {
  appliances: TaskAppliance[];
  onRemoveAppliance: (id: string) => void;
}

const getStatusColor = (status: TaskAppliance["updateStatus"]) => {
  switch (status) {
    case "Completed":
      return "bg-green-500/10 text-green-600 border-green-500/20";
    case "In Progress":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "Pending":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    case "Failed":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    case "Cancelled":
      return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    default:
      return "";
  }
};

const formatLocation = (loc: { city: string; state: string; country: string }) => {
  return `${loc.city}, ${loc.state}, ${loc.country}`;
};

export const TargetAppliancesTable = ({
  appliances,
  onRemoveAppliance,
}: TargetAppliancesTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [chainFilter, setChainFilter] = useState<string[]>([]);
  const [clusterFilter, setClusterFilter] = useState<string[]>([]);

  // Get unique values for filters
  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>();
    appliances.forEach((a) => locations.add(formatLocation(a.theatreLocation)));
    return Array.from(locations).sort();
  }, [appliances]);

  const uniqueChains = useMemo(() => {
    const chains = new Set<string>();
    appliances.forEach((a) => chains.add(a.chainName));
    return Array.from(chains).sort();
  }, [appliances]);

  const uniqueClusters = useMemo(() => {
    const clusters = new Set<string>();
    appliances.forEach((a) => clusters.add(a.clusterName));
    return Array.from(clusters).sort();
  }, [appliances]);

  // Filter appliances
  const filteredAppliances = useMemo(() => {
    return appliances.filter((appliance) => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        appliance.applianceSerialNumber.toLowerCase().includes(searchLower) ||
        appliance.hardwareSerialNumber.toLowerCase().includes(searchLower) ||
        appliance.theatreName.toLowerCase().includes(searchLower);

      // Location filter
      const matchesLocation =
        locationFilter.length === 0 ||
        locationFilter.includes(formatLocation(appliance.theatreLocation));

      // Chain filter
      const matchesChain =
        chainFilter.length === 0 || chainFilter.includes(appliance.chainName);

      // Cluster filter
      const matchesCluster =
        clusterFilter.length === 0 || clusterFilter.includes(appliance.clusterName);

      return matchesSearch && matchesLocation && matchesChain && matchesCluster;
    });
  }, [appliances, searchTerm, locationFilter, chainFilter, clusterFilter]);

  const activeFiltersCount =
    locationFilter.length + chainFilter.length + clusterFilter.length;

  const clearAllFilters = () => {
    setLocationFilter([]);
    setChainFilter([]);
    setClusterFilter([]);
  };

  const toggleFilterValue = (
    currentValues: string[],
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (currentValues.includes(value)) {
      setter(currentValues.filter((v) => v !== value));
    } else {
      setter([...currentValues, value]);
    }
  };

  const SearchableFilterPopover = ({
    label,
    values,
    selectedValues,
    onToggle,
  }: {
    label: string;
    values: string[];
    selectedValues: string[];
    onToggle: (value: string) => void;
  }) => {
    const [filterSearch, setFilterSearch] = useState("");

    const filteredValues = useMemo(() => {
      if (!filterSearch) return values;
      const searchLower = filterSearch.toLowerCase();
      return values.filter((v) => v.toLowerCase().includes(searchLower));
    }, [values, filterSearch]);

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={selectedValues.length > 0 ? "border-primary" : ""}
          >
            {label}
            {selectedValues.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                {selectedValues.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0 bg-popover z-50" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${label.toLowerCase()}...`}
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredValues.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 text-center">
                {values.length === 0 ? "No options available" : "No matches found"}
              </p>
            ) : (
              filteredValues.map((value) => (
                <div
                  key={value}
                  className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
                  onClick={() => onToggle(value)}
                >
                  <Checkbox
                    checked={selectedValues.includes(value)}
                    onCheckedChange={() => onToggle(value)}
                  />
                  <span className="text-sm truncate flex-1">{value}</span>
                </div>
              ))
            )}
          </div>
          {selectedValues.length > 0 && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={() => selectedValues.forEach((v) => onToggle(v))}
              >
                Clear selection ({selectedValues.length})
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search serial number, theatre name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SearchableFilterPopover
            label="Location"
            values={uniqueLocations}
            selectedValues={locationFilter}
            onToggle={(v) => toggleFilterValue(locationFilter, v, setLocationFilter)}
          />
          <SearchableFilterPopover
            label="Chain"
            values={uniqueChains}
            selectedValues={chainFilter}
            onToggle={(v) => toggleFilterValue(chainFilter, v, setChainFilter)}
          />
          <SearchableFilterPopover
            label="Cluster"
            values={uniqueClusters}
            selectedValues={clusterFilter}
            onToggle={(v) => toggleFilterValue(clusterFilter, v, setClusterFilter)}
          />
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Results count */}
      {(searchTerm || activeFiltersCount > 0) && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredAppliances.length} of {appliances.length} appliances
        </p>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Appliance Serial Number</TableHead>
              <TableHead>Node ID</TableHead>
              <TableHead>Theatre Name</TableHead>
              <TableHead>Chain Name</TableHead>
              <TableHead>Update Status</TableHead>
              <TableHead>Updated On</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAppliances.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {appliances.length === 0
                    ? 'No appliances added. Click "Add Appliance" to add appliances to this task.'
                    : "No appliances match your search or filters."}
                </TableCell>
              </TableRow>
            ) : (
              filteredAppliances.map((appliance) => (
                <TableRow key={appliance.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{appliance.applianceSerialNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        {appliance.hardwareSerialNumber}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{appliance.nodeId}</div>
                      <div className="text-sm text-muted-foreground">
                        {appliance.clusterName}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium"><TheatreNameWithInfo name={appliance.theatreName} theatreRef={appliance.theatreId || appliance.theatreName} nameClassName="" /></div>
                      <div className="text-sm text-muted-foreground">
                        {formatLocation(appliance.theatreLocation)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{appliance.chainName}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatLocation(appliance.chainAddress)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={getStatusColor(appliance.updateStatus)}
                    >
                      {appliance.updateStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(appliance.updatedOn)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveAppliance(appliance.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
