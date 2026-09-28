import { useMemo, useState } from "react";
import { Plus, Copy, Check, MoreHorizontal, Eye, Pencil } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterButton } from "@/components/ui/filter-drawer";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/ui/data-table/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { EdgeTheatre } from "@/data/edgeData";
import { useApplianceTheatres } from "@/hooks/api/appliances";
import { QueryState } from "@/components/ui/query-state";
import { EdgeFilterPanel, EdgeFilters, emptyEdgeFilters } from "@/components/edge/EdgeFilterPanel";
import { AddEdgeTheatreLookupDialog } from "@/components/edge/AddEdgeTheatreLookupDialog";
import { EdgeDetailSheet } from "@/components/edge/EdgeDetailSheet";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";

const EdgeAppliances = () => {
  const navigate = useNavigate();
  const theatresQuery = useApplianceTheatres("edge");
  const data = useMemo<EdgeTheatre[]>(() => theatresQuery.data ?? [], [theatresQuery.data]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<EdgeFilters>(emptyEdgeFilters);
  const [detailTheatre, setDetailTheatre] = useState<EdgeTheatre | null>(null);

  const openDetails = (t: EdgeTheatre) => setDetailTheatre(t);
  const goEdit = (t: EdgeTheatre) => navigate(`/qube-appliances/edge/${t.id}/edit`);

  const chains = useMemo(() => [...new Set(data.map((t) => t.chainName))].sort(), [data]);
  const locations = useMemo(() => [...new Set(data.map((t) => `${t.city}, ${t.state}, ${t.country}`))].sort(), [data]);

  const filtered = useMemo(() => {
    let r = data;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      r = r.filter((t) =>
        t.theatreName.toLowerCase().includes(q) ||
        t.theatreId.toLowerCase().includes(q) ||
        t.chainName.toLowerCase().includes(q) ||
        `${t.city}, ${t.state}, ${t.country}`.toLowerCase().includes(q)
      );
    }
    if (filters.chain !== "all") r = r.filter((t) => t.chainName === filters.chain);
    if (filters.location !== "all") r = r.filter((t) => `${t.city}, ${t.state}, ${t.country}` === filters.location);
    if (filters.updatedFrom) r = r.filter((t) => new Date(t.updatedAt) >= filters.updatedFrom!);
    if (filters.updatedTo) r = r.filter((t) => new Date(t.updatedAt) <= filters.updatedTo!);
    return r;
  }, [data, searchTerm, filters]);

  const resetKey = useMemo(() => [searchTerm, filters], [searchTerm, filters]);
  const { page, setPage, pageSize, setPageSize, totalPages, totalItems, pageItems: paginated } = usePagination(filtered, resetKey);

  const activeFilterCount =
    (filters.chain !== "all" ? 1 : 0) +
    (filters.location !== "all" ? 1 : 0) +
    (filters.updatedFrom ? 1 : 0) +
    (filters.updatedTo ? 1 : 0);

  const copyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success(`Copied ${id}`);
    setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 1500);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-muted-foreground">Theatres where Edge is enabled</p>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by theatre name, ID, chain or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <FilterButton count={activeFilterCount} onClick={() => setFiltersOpen(true)} />
        <span className="text-sm text-muted-foreground">
          {filtered.length} theatre{filtered.length !== 1 ? "s" : ""}
        </span>
        <Button className="ml-auto" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Theatre
        </Button>
      </div>

      <QueryState query={theatresQuery} label="theatres">
        {() => (
          <>
          <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Theatre Name (ID)</TableHead>
                    <TableHead>Theatre Location</TableHead>
                    <TableHead>Chain Name</TableHead>
                    <TableHead>Screens Installed</TableHead>
                    <TableHead>Updated At</TableHead>
                    <TableHead>Updated By</TableHead>
                    <TableHead className="w-12 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No results found.</TableCell></TableRow>
                  ) : paginated.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => openDetails(t)}>
                      <TableCell>
                        <div className="inline-flex items-center gap-2">
                              <div>
                                <TheatreNameWithInfo name={t.theatreName} theatreRef={t.id} />
                                <div className="text-xs text-muted-foreground">{t.theatreId}</div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => copyId(e, t.theatreId)}
                                aria-label="Copy Theatre ID"
                              >
                                {copiedId === t.theatreId
                                  ? <Check className="h-3.5 w-3.5 text-[hsl(142_76%_36%)]" />
                                  : <Copy className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.city}, {t.state}, {t.country}</TableCell>
                      <TableCell>{t.chainName}</TableCell>
                      <TableCell>{t.enabledScreens} / {t.totalScreens}</TableCell>
                      <TableCell className="text-xs">{format(new Date(t.updatedAt), "dd MMM yyyy hh:mm a")}</TableCell>
                      <TableCell className="text-xs">{t.updatedBy}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetails(t)}>
                              <Eye className="h-4 w-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => goEdit(t)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
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
          </>
        )}
      </QueryState>

      <EdgeFilterPanel
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        chains={chains}
        locations={locations}
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters(emptyEdgeFilters)}
      />

      <AddEdgeTheatreLookupDialog open={addOpen} onOpenChange={setAddOpen} />

      <EdgeDetailSheet
        theatre={detailTheatre}
        open={!!detailTheatre}
        onOpenChange={(o) => !o && setDetailTheatre(null)}
        onEdit={(t) => { setDetailTheatre(null); goEdit(t); }}
      />
    </div>
  );
};

export default EdgeAppliances;
