import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, History, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Archive, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PaginationControls } from "@/components/ui/data-table/pagination";
import { QueryState } from "@/components/ui/query-state";
import { formatDateTime } from "@/lib/dateUtils";
import { common } from "@/i18n/common";
import { cn } from "@/lib/utils";
import NotFound from "./NotFound";
import { useLocationList, useSetLocationDeleted } from "@/hooks/api/locations";
import { entityColumns, entityDescriptions, type LocationColumn } from "@/components/locations/listColumns";
import {
  LOCATION_PAGE_SIZE, LOCATION_REVIEW_PATH, entityFromSlug, entityInfo, locationEditPath, locationLogsPath, locationNewPath,
  type LocationEntity, type LocationRecord,
} from "@/data/locationsData";

type Row = LocationRecord & { name: string; isDeleted?: boolean };

const SortIcon = ({ active, direction }: { active: boolean; direction: "asc" | "desc" }) =>
  !active ? <ArrowUpDown className="h-3.5 w-3.5 opacity-40" /> : direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;

/** One list page for each location entity: search, sort, paging, and Edit / Logs / Deactivate per row. */
const LocationList = () => {
  const entity = entityFromSlug(useParams().entity);
  if (!entity) return <NotFound />;
  // Keyed so switching entities starts from a clean search/sort/page
  return <LocationListView key={entity} entity={entity} />;
};

function LocationListView({ entity }: { entity: LocationEntity }) {
  const info = entityInfo(entity);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [debounced, setDebounced] = useState(search);
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "updatedAt", direction: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LOCATION_PAGE_SIZE);
  const includeDeleted = params.get("deactivated") === "1";
  const needsReview = params.get("review") === "1";
  const [confirm, setConfirm] = useState<Row | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const setFlag = (key: string, on: boolean) => {
    const next = new URLSearchParams(params);
    if (on) next.set(key, "1"); else next.delete(key);
    setParams(next, { replace: true });
    setPage(1);
  };

  const list = useLocationList(entity, {
    search: debounced, sort: sort.key, direction: sort.direction, page, pageSize, includeDeleted, needsReview,
  });
  const setDeleted = useSetLocationDeleted(entity);
  const softDelete = entity !== "timezones";

  const toggleSort = (key: string) => {
    setSort((s) => (s.key === key ? { key, direction: s.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
    setPage(1);
  };

  const columns = [
    { header: "Name", sort: "name", cell: (r: Row) => <NameCell entity={entity} row={r} /> },
    ...(entityColumns[entity] as unknown as LocationColumn<Row>[]),
    { header: "Updated By", sort: "updatedBy", cell: (r: Row) => r.updatedBy || "—" },
    { header: "Updated At", sort: "updatedAt", cell: (r: Row) => <span className="whitespace-nowrap">{formatDateTime(r.updatedAt)}</span> },
  ] as LocationColumn<Row>[];

  const doToggleDeleted = (row: Row) => {
    const deleting = !row.isDeleted;
    setDeleted.mutate({ id: row.id, deleted: deleting }, {
      onSuccess: () => toast.success(`${row.name} ${deleting ? "deactivated" : "restored"}`),
      onError: (err) => toast.error(err.message),
      onSettled: () => setConfirm(null),
    });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">{entityDescriptions[entity]}</p>
        {entity !== "timezones" && (
          <Button onClick={() => navigate(locationNewPath(entity))}>
            <Plus className="mr-2 h-4 w-4" /> New {info.singular}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={entity === "countries" || entity === "provinces" || entity === "cities" ? "Search names, old names, translations" : "Search this list"} className="pl-8"
            aria-label={`Search ${info.label.toLowerCase()}`} />
        </div>
        {entity !== "metro_areas" && (
          <div className="flex items-center gap-2">
            <Switch id="needs-review" checked={needsReview} onCheckedChange={(v) => setFlag("review", v)} />
            <Label htmlFor="needs-review" className="font-normal">Needs review</Label>
          </div>
        )}
        {softDelete && (
          <div className="flex items-center gap-2">
            <Switch id="show-deactivated" checked={includeDeleted} onCheckedChange={(v) => setFlag("deactivated", v)} />
            <Label htmlFor="show-deactivated" className="font-normal">Show deactivated</Label>
          </div>
        )}
      </div>

      <QueryState query={list} label={info.label.toLowerCase()}>
        {(data) => (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col.header} className={cn("bg-muted/30", col.className)}
                        aria-sort={sort.key === col.sort ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
                        {col.sort ? (
                          <button type="button" onClick={() => toggleSort(col.sort!)} className="inline-flex items-center gap-1 hover:text-foreground">
                            {col.header} <SortIcon active={sort.key === col.sort} direction={sort.direction} />
                          </button>
                        ) : col.header}
                      </TableHead>
                    ))}
                    <TableHead className="w-[60px] bg-muted/30"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={columns.length + 1} className="py-10 text-center text-muted-foreground">
                        No {info.label.toLowerCase()} match.
                      </TableCell>
                    </TableRow>
                  )}
                  {(data.rows as Row[]).map((row) => (
                    <TableRow key={row.id} className={cn(row.isDeleted && "text-muted-foreground")}>
                      {columns.map((col) => (
                        <TableCell key={col.header} className={col.className}>{col.cell(row)}</TableCell>
                      ))}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions for ${row.name}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => navigate(locationEditPath(entity, row.id))}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => navigate(locationLogsPath(entity, row.id))}>
                              <History className="mr-2 h-4 w-4" /> Logs
                            </DropdownMenuItem>
                            {softDelete && (
                              <>
                                <DropdownMenuSeparator />
                                {row.isDeleted ? (
                                  <DropdownMenuItem onSelect={() => doToggleDeleted(row)}>
                                    <RotateCcw className="mr-2 h-4 w-4" /> Restore
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onSelect={() => setConfirm(row)}>
                                    <Archive className="mr-2 h-4 w-4" /> Deactivate
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationControls
              currentPage={data.page}
              totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))}
              totalItems={data.total}
              rowsPerPage={pageSize}
              handlePageChange={setPage}
              handleRowsPerPageChange={(size) => { setPageSize(size); setPage(1); }}
            />
          </>
        )}
      </QueryState>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {confirm?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be hidden from lists and pickers, and kept with its history. You can restore it later from
              Show deactivated.
              {entity === "metro_areas" && " Its cities will no longer belong to a metro area."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); if (confirm) doToggleDeleted(confirm); }} disabled={setDeleted.isPending}>
              {common.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NameCell({ entity, row }: { entity: LocationEntity; row: Row }) {
  const reviewCount = (row as { reviewCount?: number }).reviewCount ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link to={locationEditPath(entity, row.id)} className="font-medium text-foreground hover:underline">{row.name}</Link>
      {row.isDeleted && <Badge variant="outline">Deactivated</Badge>}
      {reviewCount > 0 && (
        <Link to={`${LOCATION_REVIEW_PATH}?entity=${entity}`} title="Open Reference sync items for this record">
          <Badge variant="notice"><AlertTriangle className="h-3 w-3" /> Needs review</Badge>
        </Link>
      )}
    </div>
  );
}

export default LocationList;
