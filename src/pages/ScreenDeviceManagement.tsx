import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Eye, Pencil, History } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterButton } from "@/components/ui/filter-drawer";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/ui/data-table/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTheatres } from "@/hooks/api/theatres";
import { QueryState } from "@/components/ui/query-state";
import { Theatre } from "@/types";
import { TheatreLogsDialog } from "@/components/TheatreLogsDialog";
import { ScreenDeviceFilterPanel, ScreenDeviceFilters } from "@/components/screen-device-management/ScreenDeviceFilterPanel";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";

const defaultFilters: ScreenDeviceFilters = {
  location: "all",
  chain: "all",
  nameContains: "",
  suiteAvailability: "all",
  screenExperience: "all",
};

const ScreenDeviceManagement = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<ScreenDeviceFilters>(defaultFilters);
  const [logsTheatre, setLogsTheatre] = useState<Theatre | undefined>(undefined);

  const theatresQuery = useTheatres({ withScreens: true });
  const allTheatres = useMemo(() => theatresQuery.data ?? [], [theatresQuery.data]);
  const chains = useMemo(() => [...new Set(allTheatres.map((t) => t.chainName).filter(Boolean))].sort(), [allTheatres]);
  const locations = useMemo(
    () => [...new Set(allTheatres.map((t) => `${t.city}, ${t.state}, ${t.country}`))].sort(),
    [allTheatres]
  );

  const filtered = useMemo(() => {
    let r = allTheatres;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      r = r.filter((t) => {
        const idMatch =
          t.id.toLowerCase().includes(q) ||
          t.uuid.toLowerCase().includes(q) ||
          (t.thirdPartyId || "").toLowerCase().includes(q);
        const nameMatch =
          t.name.toLowerCase().includes(q) || (t.displayName || "").toLowerCase().includes(q);
        const screenMatch = (t.screens || []).some(
          (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
        );
        return idMatch || nameMatch || screenMatch;
      });
    }
    if (filters.location !== "all")
      r = r.filter((t) => `${t.city}, ${t.state}, ${t.country}` === filters.location);
    if (filters.chain !== "all") r = r.filter((t) => t.chainName === filters.chain);
    if (filters.nameContains.trim())
      r = r.filter((t) => t.name.toLowerCase().includes(filters.nameContains.trim().toLowerCase()));
    if (filters.suiteAvailability !== "all") {
      r = r.filter((t) => {
        const screens = t.screens || [];
        switch (filters.suiteAvailability) {
          case "valid":
            return screens.some((s) => s.suites?.some((su) => su.status === "Valid"));
          case "invalid":
            return screens.some((s) => s.suites?.some((su) => su.status === "Invalid"));
          case "multiple":
            return screens.some((s) => (s.suites?.length || 0) > 1);
          case "none":
            return screens.some((s) => !s.suites || s.suites.length === 0);
          default:
            return true;
        }
      });
    }
    if (filters.screenExperience !== "all") {
      r = r.filter((t) =>
        (t.screens || []).some((s) => {
          const proj = s.projection?.type || "";
          const sound = s.sound?.processor || "";
          if (filters.screenExperience === "IAB") return s.sound?.iabSupported;
          if (filters.screenExperience === "Atmos") return /atmos/i.test(sound);
          if (filters.screenExperience === "IMAX") return /imax/i.test(t.type) || /imax/i.test(proj);
          if (filters.screenExperience === "PLF") return /laser|plf/i.test(proj);
          return true;
        })
      );
    }
    return r;
  }, [allTheatres, searchTerm, filters]);

  const resetKey = useMemo(() => [searchTerm, filters], [searchTerm, filters]);
  const { page, setPage, pageSize, setPageSize, totalPages, totalItems, pageItems: paginated } = usePagination(filtered, resetKey);

  const activeFilterCount =
    (filters.location !== "all" ? 1 : 0) +
    (filters.chain !== "all" ? 1 : 0) +
    (filters.nameContains ? 1 : 0) +
    (filters.suiteAvailability !== "all" ? 1 : 0) +
    (filters.screenExperience !== "all" ? 1 : 0);

  const goEdit = (t: Theatre) => navigate(`/theatre-device-management/screen-devices/${t.id}/edit`);
  const goView = (t: Theatre) => navigate(`/theatre-device-management/screen-devices/${t.id}/edit`);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <p className="text-muted-foreground">Manage screen device configurations across all theatres</p>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by Theatre ID, Third Party ID, Theatre Name, Screen Name or Screen ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} theatre{filtered.length !== 1 ? "s" : ""}
        </span>
        <FilterButton count={activeFilterCount} onClick={() => setFiltersOpen(true)} />
      </div>

      <QueryState query={theatresQuery} label="theatres">
      {() => (<>
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Theatre Name</TableHead>
                <TableHead>Chain Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Screens</TableHead>
                <TableHead>Updated On</TableHead>
                <TableHead>Updated By</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                    No results found.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((t) => (
                  <TableRow
                    key={t.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => goView(t)}
                  >
                    <TableCell>
                      <TheatreNameWithInfo name={t.name} theatreRef={t.id} />
                    </TableCell>
                    <TableCell>{t.chainName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.city}, {t.state}, {t.country}
                    </TableCell>
                    <TableCell>{t.screenCount}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(t.updatedAt), "dd MMM yyyy hh:mm a")}
                    </TableCell>
                    <TableCell className="text-xs">{t.updatedBy || "—"}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => goView(t)}>
                            <Eye className="h-4 w-4 mr-2" /> View Screen Device List
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => goEdit(t)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit Screen Device List
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setLogsTheatre(t)}>
                            <History className="h-4 w-4 mr-2" /> View Logs
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <PaginationControls
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        rowsPerPage={pageSize}
        handlePageChange={setPage}
        handleRowsPerPageChange={setPageSize}
      />
      </>)}
      </QueryState>

      <ScreenDeviceFilterPanel
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        chains={chains}
        locations={locations}
        filters={filters}
        defaultFilters={defaultFilters}
        onApply={setFilters}
        onClear={() => setFilters(defaultFilters)}
      />

      <TheatreLogsDialog
        open={!!logsTheatre}
        onOpenChange={(o) => !o && setLogsTheatre(undefined)}
        theatre={logsTheatre}
      />
    </motion.div>
  );
};

export default ScreenDeviceManagement;