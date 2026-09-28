
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Building2, Monitor, Activity, Eye, EyeOff, Pencil } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/ui/data-table/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScreenFilterPanel, type ScreenFilters } from "@/components/screen-manager/ScreenFilterPanel";
import { FilterButton } from "@/components/ui/filter-drawer";
import { EditScreenDialog } from "@/components/screen-manager/EditScreenDialog";
import type { ScreenRecord } from "@/data/screenManagerData";
import { QueryState } from "@/components/ui/query-state";
import { usePulseScreens } from "@/hooks/api/screenPulse";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";

const defaultFilters: ScreenFilters = { chain: "all", location: "all", pulseStatus: "all", lionisStatus: "all" };

const ScreenManager = () => {
  const screensQuery = usePulseScreens();
  return (
    <QueryState query={screensQuery} label="screens">
      {(data) => <ScreenManagerContent data={data} />}
    </QueryState>
  );
};

const ScreenManagerContent = ({ data }: { data: ScreenRecord[] }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editScreen, setEditScreen] = useState<ScreenRecord | null>(null);
  const [filters, setFilters] = useState<ScreenFilters>(defaultFilters);

  const chains = useMemo(() => [...new Set(data.map((s) => s.chainName))].sort(), [data]);
  const locations = useMemo(() => [...new Set(data.map((s) => `${s.city}, ${s.state}, ${s.country}`))].sort(), [data]);

  const filteredData = useMemo(() => {
    let result = data;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.theatreName.toLowerCase().includes(lower) ||
          s.city.toLowerCase().includes(lower) ||
          s.state.toLowerCase().includes(lower) ||
          s.country.toLowerCase().includes(lower)
      );
    }
    if (filters.chain !== "all") result = result.filter((s) => s.chainName === filters.chain);
    if (filters.location !== "all") result = result.filter((s) => `${s.city}, ${s.state}, ${s.country}` === filters.location);
    if (filters.pulseStatus !== "all") result = result.filter((s) => (filters.pulseStatus === "yes" ? s.pulseInstalled : !s.pulseInstalled));
    if (filters.lionisStatus !== "all") result = result.filter((s) => (filters.lionisStatus === "yes" ? s.lionisInstalled : !s.lionisInstalled));
    return result;
  }, [data, searchTerm, filters]);

  const resetKey = useMemo(() => [searchTerm, filters], [searchTerm, filters]);
  const { page: currentPage, setPage: setCurrentPage, pageSize, setPageSize, totalPages, totalItems, pageItems: paginatedData } =
    usePagination(filteredData, resetKey);

  // Stats
  const theatreCount = new Set(data.map((s) => s.theatreName)).size;
  const totalScreens = data.length;
  const pulseCount = data.filter((s) => s.pulseInstalled).length;
  const lionisCount = data.filter((s) => s.lionisInstalled).length;
  const notTracked = data.filter((s) => !s.pulseInstalled && !s.lionisInstalled).length;

  const activeFilterCount = Object.values(filters).filter((v) => v !== "all").length;

  const handleApplyFilters = (next: ScreenFilters) => {
    setFilters(next);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <p className="text-muted-foreground">Manage screen installations and tracking status</p>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Theatres Monitored" value={theatreCount} icon={<Building2 size={28} />} />
        <StatCard title="Total Screens" value={totalScreens} icon={<Monitor size={28} />} />
        <StatCard title="Pulse Installed" value={pulseCount} icon={<Activity size={28} />} />
        <StatCard title="Lionis Installed" value={lionisCount} icon={<Eye size={28} />} />
        <StatCard title="Not Tracked" value={notTracked} icon={<EyeOff size={28} />} />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search theatre name or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <span className="text-sm text-muted-foreground ml-auto">
          {filteredData.length} screen{filteredData.length !== 1 ? "s" : ""}
        </span>
        <FilterButton count={activeFilterCount} onClick={() => setFiltersOpen(true)} />
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Theatre</TableHead>
                <TableHead>Chain</TableHead>
                <TableHead>Screen</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Pulse</TableHead>
                <TableHead>Lionis</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((screen) => (
                <TableRow key={screen.id}>
                  <TableCell><TheatreNameWithInfo name={screen.theatreName} theatreRef={screen.theatreId} /></TableCell>
                  <TableCell>{screen.chainName}</TableCell>
                  <TableCell>{screen.screenName}</TableCell>
                  <TableCell className="text-muted-foreground">{screen.city}, {screen.state}, {screen.country}</TableCell>
                  <TableCell>
                    {screen.pulseInstalled ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="default">Yes</Badge>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs space-y-1">
                          <div><span className="font-semibold">Serial:</span> {screen.pulseSerialNumber}</div>
                          <div><span className="font-semibold">Installed:</span> {screen.pulseInstalledOn ? format(new Date(screen.pulseInstalledOn), "MMM d, yyyy") : "—"}</div>
                          <div><span className="font-semibold">By:</span> {screen.pulseInstalledBy || "—"}</div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {screen.lionisInstalled ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="default">Yes</Badge>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs space-y-1">
                          <div><span className="font-semibold">Serial:</span> {screen.lionisSerialNumber}</div>
                          <div><span className="font-semibold">Installed:</span> {screen.lionisInstalledOn ? format(new Date(screen.lionisInstalledOn), "MMM d, yyyy") : "—"}</div>
                          <div><span className="font-semibold">By:</span> {screen.lionisInstalledBy || "—"}</div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{format(new Date(screen.updatedOn), "MMM d, yyyy h:mm a")}</div>
                    <div>{screen.updatedBy}</div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setEditScreen(screen)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        rowsPerPage={pageSize}
        handlePageChange={setCurrentPage}
        handleRowsPerPageChange={setPageSize}
      />

      {/* Filter Panel */}
      <ScreenFilterPanel
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        chains={chains}
        locations={locations}
        filters={filters}
        defaultFilters={defaultFilters}
        onApply={handleApplyFilters}
        onClear={() => setFilters(defaultFilters)}
      />

      {/* Edit Dialog */}
      <EditScreenDialog open={!!editScreen} onOpenChange={(o) => !o && setEditScreen(null)} screen={editScreen} />
    </div>
  );
};

export default ScreenManager;
