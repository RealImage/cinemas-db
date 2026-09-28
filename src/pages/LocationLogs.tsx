import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QueryState } from "@/components/ui/query-state";
import { formatDateTime } from "@/lib/dateUtils";
import NotFound from "./NotFound";
import { useLocationLogs, useLocationRecord } from "@/hooks/api/locations";
import {
  entityFromSlug, entityInfo, locationEditPath, locationListPath, referenceSourceLabel,
  type LocationEntity, type LocationLogAction, type LocationLogEntry,
} from "@/data/locationsData";

const actionVariant: Record<LocationLogAction, "default" | "secondary" | "positive" | "notice" | "negative" | "product"> = {
  CREATE: "positive", UPDATE: "secondary", DEACTIVATE: "negative", RESTORE: "positive", LINK: "product", IGNORE: "notice",
};

const show = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === "object" && x ? (x as { name?: string }).name ?? JSON.stringify(x) : String(x))).join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

/** Fields whose value differs between the two snapshots. */
function changes(entry: LocationLogEntry) {
  const keys = new Set([...Object.keys(entry.previous ?? {}), ...Object.keys(entry.current ?? {})]);
  keys.delete("updatedAt");
  keys.delete("updatedBy");
  return [...keys]
    .filter((k) => JSON.stringify(entry.previous?.[k] ?? null) !== JSON.stringify(entry.current?.[k] ?? null))
    .map((k) => ({ field: k, previous: entry.previous?.[k], current: entry.current?.[k] }));
}

const fieldLabel = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).replace(/\bIso\b/g, "ISO");

/** Audit log for one location record, newest first. */
const LocationLogs = () => {
  const params = useParams();
  const entity = entityFromSlug(params.entity);
  const record = useLocationRecord(entity ?? "countries", entity ? params.id : undefined);
  const logs = useLocationLogs(entity ?? "countries", entity ? params.id : undefined);
  if (!entity || !params.id) return <NotFound />;
  const info = entityInfo(entity);
  const name = (record.data as { name?: string } | undefined)?.name;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={locationListPath(entity)} aria-label={`Back to ${info.label}`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{name ? `${name}: logs` : "Logs"}</h2>
            <p className="font-mono text-xs text-muted-foreground">/{entity}/{params.id}</p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link to={locationEditPath(entity, params.id)}><Pencil className="mr-2 h-4 w-4" /> Edit</Link>
        </Button>
      </div>
      <QueryState query={logs} label="logs">
        {(entries) =>
          entries.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">No changes have been logged for this record yet.</p>
          ) : (
            <div className="space-y-3">{entries.map((e) => <LogEntry key={e.id} entity={entity} entry={e} />)}</div>
          )
        }
      </QueryState>
    </div>
  );
};

function LogEntry({ entity, entry }: { entity: LocationEntity; entry: LocationLogEntry }) {
  const [open, setOpen] = useState(false);
  const changed = changes(entry);
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Badge variant={actionVariant[entry.action]}>{entry.action}</Badge>
          <span className="font-medium">{formatDateTime(entry.createdAt)}</span>
          <span className="text-muted-foreground">by {entry.updatedBy || "—"}</span>
          {entry.source && (
            <Badge variant="outline">{referenceSourceLabel[entry.source]}{entry.sourceRef ? ` ${entry.sourceRef}` : ""}</Badge>
          )}
          <span className="font-mono text-xs text-muted-foreground">/{entity}/{entry.recordId}</span>
        </div>
        {entry.action === "CREATE" ? (
          <p className="text-sm text-muted-foreground">Record created.</p>
        ) : changed.length === 0 ? (
          <p className="text-sm text-muted-foreground">{entry.action === "IGNORE" ? "Review item ignored; no fields changed." : "No field changes."}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/4">Field</TableHead>
                <TableHead>Previous</TableHead>
                <TableHead>Current</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changed.map((c) => (
                <TableRow key={c.field}>
                  <TableCell className="font-medium">{fieldLabel(c.field)}</TableCell>
                  <TableCell className="text-muted-foreground line-through decoration-muted-foreground/50">{show(c.previous)}</TableCell>
                  <TableCell>{show(c.current)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          aria-expanded={open}>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} Full snapshots
        </button>
        {open && (
          <div className="grid gap-3 md:grid-cols-2">
            {(["current", "previous"] as const).map((k) => (
              <div key={k} className="min-w-0">
                <p className="mb-1 text-xs font-medium capitalize text-muted-foreground">{k}</p>
                <pre className="max-h-80 overflow-auto rounded-md bg-muted/40 p-3 text-xs">{entry[k] ? JSON.stringify(entry[k], null, 2) : "—"}</pre>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LocationLogs;
