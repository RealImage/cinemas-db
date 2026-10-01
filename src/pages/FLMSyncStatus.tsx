import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { QueryState } from "@/components/ui/query-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyButton } from "@/components/theatres/TheatreInfo";
import { useFlmSyncRuns, useFlmSyncStatus } from "@/hooks/api/flm";
import { formatDateTime } from "@/lib/dateUtils";
import { common } from "@/i18n/common";
import { cn } from "@/lib/utils";
import { FLM_SYNC_RUN_STATUSES, type FlmSyncRun, type FlmSyncSource, type FlmSyncStatusValue } from "@/data/flmSync";

const STATUS_VARIANT: Record<FlmSyncStatusValue | "Disabled", BadgeProps["variant"]> = {
  Success: "positive",
  Partial: "notice",
  Failed: "negative",
  Running: "product",
  Never: "secondary",
  Disabled: "secondary",
};

const StatusBadge = ({ status }: { status: FlmSyncStatusValue | "Disabled" }) => (
  <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
);

/** "2m 14s", "1h 05m", "48s". */
const formatDuration = (seconds: number | null) => {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${String(seconds % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
};

type LogRow = FlmSyncRun & { durationSec: number | null };

const numberCell = (key: "theatresReceived" | "theatresUpdated" | "theatresNew") => (r: LogRow) =>
  <span className="tabular-nums">{r[key].toLocaleString()}</span>;

const columns: Column<LogRow>[] = [
  { header: "Provider", accessor: "providerName", sortable: true },
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
  { header: "Status", accessor: "status", cell: (r) => <StatusBadge status={r.status} /> },
  { header: "Received", accessor: "theatresReceived", sortable: true, cell: numberCell("theatresReceived") },
  { header: "Updated", accessor: "theatresUpdated", sortable: true, cell: numberCell("theatresUpdated") },
  { header: "New", accessor: "theatresNew", sortable: true, cell: numberCell("theatresNew") },
  {
    header: "Errors",
    accessor: "errors",
    sortable: true,
    cell: (r) => <span className={cn("tabular-nums", r.errors > 0 && "font-medium text-red-500")}>{r.errors.toLocaleString()}</span>,
  },
  {
    header: "Message",
    accessor: "message",
    cell: (r) => <span className="block min-w-[240px] max-w-[420px] text-sm">{r.message ?? "—"}</span>,
  },
  { header: "Triggered by", accessor: "triggeredBy", sortable: true, cell: (r) => <span className="whitespace-nowrap">{r.triggeredBy}</span> },
];

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
    <dd className="text-sm">{children}</dd>
  </div>
);

/** One provider's sync source; clicking it shows only its runs in the log (again to show all). */
function SourceCard({ source, selected, onSelect }: { source: FlmSyncSource; selected: boolean; onSelect: () => void }) {
  const last = source.lastSyncedAt ? new Date(source.lastSyncedAt) : null;
  return (
    <Card
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer flex-col gap-3 p-4 transition-colors hover:border-primary/60",
        selected && "border-primary ring-1 ring-primary",
        !source.enabled && "bg-muted/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 font-semibold">
          <button
            type="button"
            aria-pressed={selected}
            title={selected ? "Show every provider's runs" : `Show only ${source.providerName} runs`}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className="truncate rounded-sm text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {source.providerName}
          </button>
        </h3>
        <StatusBadge status={source.enabled ? source.lastStatus : "Disabled"} />
      </div>
      <dl className="grid gap-2">
        <Field label="Last sync">
          {last ? (
            <>
              <span>{formatDistanceToNow(last, { addSuffix: true })}</span>
              <span className="ml-1.5 text-xs text-muted-foreground">{formatDateTime(last)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Never synced</span>
          )}
        </Field>
        <Field label="Sync URL">
          {source.syncUrl ? (
            <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <code className="min-w-0 truncate font-mono text-xs" title={source.syncUrl}>{source.syncUrl}</code>
              <CopyButton label="Sync URL" value={source.syncUrl} />
            </span>
          ) : (
            <span className="text-muted-foreground">Not configured</span>
          )}
        </Field>
        <Field label="Schedule">
          {source.schedule || <span className="text-muted-foreground">—</span>}
          {!source.enabled && <span className="text-muted-foreground"> (disabled)</span>}
        </Field>
        <Field label="Last message">
          <span className={cn("line-clamp-2", !source.lastMessage && "text-muted-foreground")} title={source.lastMessage ?? undefined}>
            {source.lastMessage ?? "—"}
          </span>
        </Field>
      </dl>
      <p className="mt-auto border-t border-border pt-2 text-xs text-muted-foreground">
        {source.runs24h} {source.runs24h === 1 ? "run" : "runs"} in 24 hours · {source.runs7d} in 7 days
        {source.failed7d > 0 && <span className="text-red-500"> · {source.failed7d} failed</span>}
      </p>
    </Card>
  );
}

const FLMSyncStatus = () => {
  const statusQuery = useFlmSyncStatus();
  const runsQuery = useFlmSyncRuns();
  const [provider, setProvider] = useState("all");
  const [status, setStatus] = useState("all");

  const providers = statusQuery.data ?? [];
  const rows = useMemo<LogRow[]>(
    () =>
      (runsQuery.data ?? [])
        .filter((r) => (provider === "all" || r.providerId === provider) && (status === "all" || r.status === status))
        .map((r) => ({
          ...r,
          durationSec: r.finishedAt ? Math.max(0, Math.round((Date.parse(r.finishedAt) - Date.parse(r.startedAt)) / 1000)) : null,
        })),
    [runsQuery.data, provider, status],
  );

  const logFilters = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={provider} onValueChange={setProvider}>
        <SelectTrigger className="w-[160px]" aria-label="Provider"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All providers</SelectItem>
          {providers.map((p) => <SelectItem key={p.providerId} value={p.providerId}>{p.providerName}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-[140px]" aria-label="Status"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {FLM_SYNC_RUN_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
      {(provider !== "all" || status !== "all") && (
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setProvider("all"); setStatus("all"); }}>
          {common.clearAll}
        </Button>
      )}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Back to FLM Feeds" asChild>
          <Link to="/theatres/flm-feeds"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          Each FLM provider's feed: where it syncs from, its schedule and how its recent syncs went.
        </p>
      </div>

      <QueryState query={statusQuery} label="sync status">
        {(sources) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sources.map((s) => (
              <SourceCard
                key={s.providerId}
                source={s}
                selected={provider === s.providerId}
                onSelect={() => setProvider((p) => (p === s.providerId ? "all" : s.providerId))}
              />
            ))}
          </div>
        )}
      </QueryState>

      <section className="space-y-3" aria-labelledby="flm-sync-log">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="flm-sync-log" className="text-base font-semibold">Sync log</h2>
          {logFilters}
        </div>
        <QueryState query={runsQuery} label="sync log">
          {() => (
            <DataTable
              data={rows}
              columns={columns}
              searchPlaceholder="Search messages, providers..."
              pageResetKey={`${provider}|${status}`}
              exportName="FLM sync log"
            />
          )}
        </QueryState>
      </section>
    </motion.div>
  );
};

export default FLMSyncStatus;
