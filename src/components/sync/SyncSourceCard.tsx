import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/theatres/TheatreInfo";
import { formatDateTime } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import type { SyncSourceState } from "@/data/syncStatus";
import { SyncStatusBadge } from "./SyncStatusBadge";

/** What a source card shows, mapped from a page's own source type. */
export interface SyncSourceCardData extends SyncSourceState {
  id: string;
  name: string;
  /** Where it syncs from (copyable). */
  url: string;
  /** A second line under the URL, e.g. the FTP root directory. */
  urlDetail?: { label: string; value: string };
}

interface CardOptions {
  /** The URL field's label: "Sync URL", "FTP site". */
  urlLabel: string;
  /** What a source is, for the filter tooltips: "provider", "manufacturer". */
  noun: string;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
    <dd className="text-sm">{children}</dd>
  </div>
);

/** One sync source; clicking it shows only its runs in the log (again to show all). */
export function SyncSourceCard({
  source, selected, onSelect, urlLabel, noun,
}: CardOptions & { source: SyncSourceCardData; selected: boolean; onSelect: () => void }) {
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
            title={selected ? `Show every ${noun}'s runs` : `Show only ${source.name} runs`}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className="truncate rounded-sm text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {source.name}
          </button>
        </h3>
        <SyncStatusBadge status={source.enabled ? source.lastStatus : "Disabled"} />
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
        <Field label={urlLabel}>
          {source.url ? (
            <span className="block" onClick={(e) => e.stopPropagation()}>
              <span className="flex items-center gap-1">
                <code className="min-w-0 truncate font-mono text-xs" title={source.url}>{source.url}</code>
                <CopyButton label={urlLabel} value={source.url} />
              </span>
              {source.urlDetail?.value && (
                <span className="block truncate text-xs text-muted-foreground" title={source.urlDetail.value}>
                  {source.urlDetail.label} <code className="font-mono">{source.urlDetail.value}</code>
                </span>
              )}
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

/** Every source's card; clicking one filters the sync log to it. */
export function SyncSourceGrid({
  sources, selected, onSelect, ...options
}: CardOptions & { sources: SyncSourceCardData[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sources.map((s) => (
        <SyncSourceCard key={s.id} source={s} selected={selected === s.id} onSelect={() => onSelect(s.id)} {...options} />
      ))}
    </div>
  );
}
