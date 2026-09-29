import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { Filter, SortDirection } from "@/components/ui/data-table/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Theatre } from "@/types";
import { useTheatreColumns, useEnhancedColumns, type TheatreListRow } from "./TheatreColumns";
import { getTheatreActions, useTheatreActions, type TheatreDeleteAction } from "./TheatreActions";
import { TagChips } from "./TheatreTags";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { useTheatreFacets, useTheatrePage } from "@/hooks/api/theatres";
import {
  THEATRE_SEARCH_MODES, THEATRE_SEARCH_PLACEHOLDERS, isTheatreSearchMode, sameTag, type TheatreSearchMode, type TheatreTag,
} from "@/data/theatreSearch";

type TheatreTableProps = {
  onViewTheatre: (theatre: Theatre) => void;
  onViewLogs: (theatre: Theatre) => void;
  onViewWtf: (theatre: Theatre) => void;
  onToggleStatus: (theatre: Theatre) => void;
  onDelete: (theatre: Theatre, action: TheatreDeleteAction) => void;
};

/** Column filters and the server parameter each one sets. */
const FILTER_PARAMS: Partial<Record<keyof TheatreListRow, string>> = {
  status: "status",
  listing: "listing",
  chainName: "chain",
  companyName: "company",
};

/** The Theatre List. Search, filters, tags, sorting and paging all run on the server, one page at a time. */
export const TheatreTable = ({ onViewTheatre, onViewLogs, onViewWtf, onToggleStatus, onDelete }: TheatreTableProps) => {
  const [page, setPage] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [searchTerm, setSearchTerm] = useState("");
  const [searchMode, setSearchMode] = useState<TheatreSearchMode>("all");
  const [sort, setSort] = useState<{ key?: string; dir?: "asc" | "desc" }>({});
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<TheatreTag[]>([]);

  const pageQuery = useTheatrePage({
    ...page, q: searchTerm, mode: searchMode, sort: sort.key, dir: sort.dir, filters, tags,
  });
  const facetsQuery = useTheatreFacets();
  const facets = facetsQuery.data;

  // Anything that changes which theatres match starts again from page 1
  const toFirstPage = () => setPage((p) => ({ ...p, page: 1 }));
  const addTag = (tag: TheatreTag) => {
    setTags((current) => (current.some((t) => sameTag(t, tag)) ? current : [...current, tag]));
    toFirstPage();
  };
  const removeTag = (tag: TheatreTag) => { setTags((current) => current.filter((t) => !sameTag(t, tag))); toFirstPage(); };

  const columns = useEnhancedColumns(useTheatreColumns({ onTag: addTag }), facets);
  const { handleEditTheatre } = useTheatreActions();

  const handleFilterChange = (next: Filter<TheatreListRow>[]) => {
    const params: Record<string, string> = {};
    for (const f of next) {
      const name = FILTER_PARAMS[f.column];
      if (name && typeof f.value === "string" && f.value) params[name] = f.value;
    }
    setFilters(params);
    toFirstPage();
  };
  const handleSortChange = (key: keyof TheatreListRow | null, direction: SortDirection) => {
    setSort(key && direction ? { key: String(key), dir: direction } : {});
    toFirstPage();
  };

  if (pageQuery.isPending) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading theatres
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pageQuery.isError && (
        <div className="flex items-center gap-3" role="alert">
          <p className="flex items-center gap-2 text-sm text-red-500">
            <AlertTriangle className="h-4 w-4" /> Could not load theatres: {pageQuery.error.message}
          </p>
          <Button variant="outline" size="sm" onClick={() => pageQuery.refetch()} loading={pageQuery.isFetching}>Retry</Button>
        </div>
      )}
      <DataTable<TheatreListRow>
        data={pageQuery.data?.rows ?? []}
        columns={columns}
        searchPlaceholder={THEATRE_SEARCH_PLACEHOLDERS[searchMode]}
        toolbar={
          <Select
            value={searchMode}
            onValueChange={(v) => { if (isTheatreSearchMode(v)) { setSearchMode(v); toFirstPage(); } }}
          >
            <SelectTrigger className="w-40" aria-label="Search in">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEATRE_SEARCH_MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        subToolbar={
          <TagChips
            tags={tags}
            facets={facets}
            facetsError={facetsQuery.isError ? facetsQuery.error.message : null}
            onRetryFacets={() => facetsQuery.refetch()}
            onAdd={addTag}
            onRemove={removeTag}
            onClear={() => { setTags([]); toFirstPage(); }}
          />
        }
        // DataTable resets its own pager for search and column filters; these are the page's own changes
        pageResetKey={`${searchMode}|${sort.key ?? ""}:${sort.dir ?? ""}|${tags.map((t) => `${t.kind}:${t.value}`).join(",")}`}
        actions={(row) =>
          getTheatreActions({
            theatre: row, onViewDetails: onViewTheatre, onViewLogs, onViewWtf,
            onEdit: handleEditTheatre, onDelete, onToggleStatus,
          })
        }
        onRowClick={onViewTheatre}
        serverSide
        totalCount={pageQuery.data?.total ?? 0}
        onPaginationChange={(p, pageSize) => setPage({ page: p, pageSize })}
        onSearchChange={(term) => { setSearchTerm(term); toFirstPage(); }}
        onSortChange={handleSortChange}
        onFilterChange={handleFilterChange}
        pageSize={DEFAULT_PAGE_SIZE}
      />
    </div>
  );
};
