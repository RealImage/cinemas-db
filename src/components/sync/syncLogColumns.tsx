import { useMemo, useState } from "react";
import type { Column } from "@/components/ui/data-table";
import { formatDateTime } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import type { SyncRunBase } from "@/data/syncStatus";
import { SyncStatusBadge } from "./SyncStatusBadge";

/** "2m 14s", "1h 05m", "48s". */
export const formatDuration = (seconds: number | null) => {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${String(seconds % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
};

/** A sync log row: a page's run plus its duration. */
export type SyncLogRow<T extends SyncRunBase> = T & { durationSec: number | null };

/**
 * The sync log's source and status filters (shared with the source cards: clicking a card toggles its source) and the
 * runs they leave, with durations. `sourceKey` is the run field holding the source's id.
 */
export function useSyncLogFilters<T extends SyncRunBase>(runs: T[] | undefined, sourceKey: keyof T) {
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const rows = useMemo<SyncLogRow<T>[]>(
    () =>
      (runs ?? [])
        .filter((r) => (source === "all" || String(r[sourceKey]) === source) && (status === "all" || r.status === status))
        .map((r) => ({
          ...r,
          durationSec: r.finishedAt ? Math.max(0, Math.round((Date.parse(r.finishedAt) - Date.parse(r.startedAt)) / 1000)) : null,
        })),
    [runs, sourceKey, source, status],
  );
  return {
    source, setSource, status, setStatus, rows,
    toggleSource: (id: string) => setSource((s) => (s === id ? "all" : id)),
    clear: () => { setSource("all"); setStatus("all"); },
  };
}

export type SyncLogFilters = Omit<ReturnType<typeof useSyncLogFilters>, "rows">;

type CountKey<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];

export interface SyncCountColumn<T> {
  header: string;
  key: CountKey<T>;
  /** Highlight non-zero values: red for errors, amber for rejections. */
  tone?: "negative" | "notice";
}

const toneClass = { negative: "font-medium text-red-500", notice: "font-medium text-amber-600" };

/** A sync log's columns: the source, Started, Duration, Status, the page's own counts, Errors, Message, Triggered by. */
export function syncLogColumns<T extends SyncRunBase>(
  source: { header: string; accessor: keyof SyncLogRow<T> },
  counts: SyncCountColumn<SyncLogRow<T>>[],
): Column<SyncLogRow<T>>[] {
  type Row = SyncLogRow<T>;
  const countColumn = ({ header, key, tone }: SyncCountColumn<Row>): Column<Row> => ({
    header,
    accessor: key,
    sortable: true,
    cell: (r) => {
      const n = r[key] as number;
      return <span className={cn("tabular-nums", tone && n > 0 && toneClass[tone])}>{n.toLocaleString()}</span>;
    },
  });
  return [
    { header: source.header, accessor: source.accessor, sortable: true },
    {
      header: "Started",
      accessor: "startedAt",
      sortable: true,
      cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.startedAt)}</span>,
      exportValue: (r) => formatDateTime(r.startedAt),
    },
    {
      header: "Duration",
      accessor: "durationSec",
      sortable: true,
      cell: (r) => <span className="whitespace-nowrap tabular-nums">{formatDuration(r.durationSec)}</span>,
      exportValue: (r) => formatDuration(r.durationSec),
    },
    { header: "Status", accessor: "status", cell: (r) => <SyncStatusBadge status={r.status} /> },
    ...counts.map(countColumn),
    countColumn({ header: "Errors", key: "errors" as CountKey<Row>, tone: "negative" }),
    {
      header: "Message",
      accessor: "message",
      cell: (r) => <span className="block min-w-[240px] max-w-[420px] text-sm">{r.message ?? "—"}</span>,
    },
    { header: "Triggered by", accessor: "triggeredBy", sortable: true, cell: (r) => <span className="whitespace-nowrap">{r.triggeredBy}</span> },
  ];
}
