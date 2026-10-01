import type { UseQueryResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { QueryState } from "@/components/ui/query-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { common } from "@/i18n/common";
import { SYNC_RUN_STATUSES, type SyncRunBase } from "@/data/syncStatus";
import type { SyncLogFilters, SyncLogRow } from "./syncLogColumns";

interface SyncLogProps<T extends SyncRunBase> {
  /** The heading's id, for aria-labelledby. */
  id: string;
  query: UseQueryResult<T[]>;
  filters: SyncLogFilters;
  rows: SyncLogRow<T>[];
  columns: Column<SyncLogRow<T>>[];
  /** The source filter's options. */
  sources: { id: string; name: string }[];
  /** Plural noun for the source filter: "providers", "manufacturers". */
  sourcesLabel: string;
  /** The source filter's accessible name: "Provider", "Manufacturer". */
  sourceLabel: string;
  searchPlaceholder: string;
  exportName: string;
}

/** The "Sync log" section: source and status filters over a searchable, exportable table of runs. */
export function SyncLog<T extends SyncRunBase>({
  id, query, filters, rows, columns, sources, sourcesLabel, sourceLabel, searchPlaceholder, exportName,
}: SyncLogProps<T>) {
  const { source, setSource, status, setStatus, clear } = filters;
  return (
    <section className="space-y-3" aria-labelledby={id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-base font-semibold">Sync log</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-[160px]" aria-label={sourceLabel}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {sourcesLabel}</SelectItem>
              {sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px]" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {SYNC_RUN_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {(source !== "all" || status !== "all") && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clear}>
              {common.clearAll}
            </Button>
          )}
        </div>
      </div>
      <QueryState query={query} label="sync log">
        {() => (
          <DataTable
            data={rows}
            columns={columns}
            searchPlaceholder={searchPlaceholder}
            pageResetKey={`${source}|${status}`}
            exportName={exportName}
          />
        )}
      </QueryState>
    </section>
  );
}
