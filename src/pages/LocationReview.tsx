import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, Play, Search, Settings2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaginationControls } from "@/components/ui/data-table/pagination";
import { QueryState } from "@/components/ui/query-state";
import { formatDateTime } from "@/lib/dateUtils";
import { common } from "@/i18n/common";
import { cn } from "@/lib/utils";
import { LocationMultiPicker, LocationPicker, type PickedLocation } from "@/components/locations/LocationPicker";
import {
  useDecideReviewItem, useReviewDecisions, useReviewItems, useReviewSummary, useRunSync, useSaveSyncSettings,
} from "@/hooks/api/locations";
import {
  entityInfo, locationEditPath, locationNewPath, referenceSourceLabel, reviewEntities, reviewFlags,
  type ReviewAction, type ReviewEntity, type ReviewFlag, type ReviewItem, type ReviewStatus, type ReviewSummary, type SyncSettings,
} from "@/data/locationsData";

const flagVariant: Record<ReviewFlag, "positive" | "negative" | "notice" | "violet"> = {
  new: "positive", missing: "negative", mismatch: "notice", duplicate: "violet",
};
const flagLabel = (f: ReviewFlag) => reviewFlags.find((x) => x.id === f)!.label;

const isEntity = (v: string | null): v is ReviewEntity => reviewEntities.includes(v as ReviewEntity);

/** Reference sync and gap review: the nightly comparison with GeoNames and IANA, and a decision per difference. */
const LocationReview = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get("entity") ?? "cities";
  const summary = useReviewSummary();
  const setTab = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("entity", value);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-muted-foreground">
        Every night CinemaDB is compared with GeoNames and the IANA tz database. Each difference waits here for a decision;
        nothing is changed automatically.
      </p>
      <QueryState query={summary} label="reference sync">
        {(s) => (
          <>
            <RunCard summary={s} />
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-auto flex-wrap">
                {reviewEntities.map((e) => {
                  const total = Object.values(s.counts[e]).reduce((a, b) => a + b, 0);
                  return (
                    <TabsTrigger key={e} value={e} className="gap-2">
                      {entityInfo(e).label}
                      <Badge variant={total ? "notice" : "secondary"} className="tabular-nums">{total.toLocaleString()}</Badge>
                    </TabsTrigger>
                  );
                })}
                <TabsTrigger value="decisions">Decisions</TabsTrigger>
              </TabsList>
            </Tabs>
            {isEntity(tab) ? <ItemsPanel key={tab} entity={tab} counts={s.counts[tab]} /> : <DecisionsPanel />}
          </>
        )}
      </QueryState>
      <p className="text-xs text-muted-foreground">
        Reference data: <a className="underline" href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> (CC BY 4.0)
        and the <a className="underline" href="https://www.iana.org/time-zones" target="_blank" rel="noreferrer">IANA tz database</a>.
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Last run, Run now, scope settings
// ---------------------------------------------------------------------------

function RunCard({ summary }: { summary: ReviewSummary }) {
  const run = summary.lastRun;
  const runSync = useRunSync();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const totals = reviewFlags.map((f) => ({
    ...f, n: reviewEntities.reduce((sum, e) => sum + summary.counts[e][f.id], 0),
  }));
  const status = summary.running ? (
    <span className="inline-flex items-center gap-1.5 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Running…</span>
  ) : run?.status === "failed" ? (
    <span className="inline-flex items-center gap-1.5 text-sm text-red-500"><XCircle className="h-4 w-4" /> Failed</span>
  ) : run ? (
    <span className="inline-flex items-center gap-1.5 text-sm text-green-600"><CheckCircle2 className="h-4 w-4" /> Succeeded</span>
  ) : null;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-4 pt-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Last run</span>
            <span className="font-medium">{run ? formatDateTime(run.finishedAt ?? run.startedAt) : "Never"}</span>
            {run && <Badge variant="outline">{run.trigger === "nightly" ? "Nightly" : `Manual, ${run.startedBy}`}</Badge>}
            {status}
          </div>
          {run?.error && <p className="text-sm text-red-500">{run.error}</p>}
          {run?.summary.sources && (
            <p className="text-xs text-muted-foreground">
              GeoNames {run.summary.sources.geonames} · IANA tz {run.summary.sources.iana}
              {run.summary.sources.runtimeTz && ` · offsets from runtime tz ${run.summary.sources.runtimeTz}`}
              {run.summary.detected != null && ` · ${run.summary.opened ?? 0} new, ${run.summary.reopened ?? 0} reopened, ${run.summary.closed ?? 0} cleared, ${run.summary.linked ?? 0} linked`}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {totals.map((t) => (
              <Badge key={t.id} variant={t.n ? flagVariant[t.id] : "secondary"} title={t.description} className="tabular-nums">
                {t.label} {t.n.toLocaleString()}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Scope: new provinces and cities in {summary.settings.trackedCountryIds ? "" : "countries with theatres: "}
            {summary.settings.trackedCountries.map((c) => c.name).join(", ") || "no countries"}; cities with a population of at least{" "}
            {summary.settings.populationThreshold.toLocaleString()}. Nightly runs are {summary.settings.nightlyEnabled ? "on" : "off"}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSettingsOpen(true)}><Settings2 className="mr-2 h-4 w-4" /> Scope settings</Button>
          <Button disabled={summary.running || runSync.isPending}
            onClick={() => runSync.mutate(undefined, {
              onSuccess: () => toast.success("Reference sync started"),
              onError: (err) => toast.error(err.message),
            })}>
            {summary.running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Run now
          </Button>
        </div>
      </CardContent>
      {settingsOpen && <SettingsDialog settings={summary.settings} onClose={() => setSettingsOpen(false)} />}
    </Card>
  );
}

function SettingsDialog({ settings, onClose }: { settings: SyncSettings; onClose: () => void }) {
  const [mode, setMode] = useState<"theatres" | "custom">(settings.trackedCountryIds ? "custom" : "theatres");
  const [countries, setCountries] = useState<PickedLocation[]>(settings.trackedCountries.map((c) => ({ id: c.id, label: c.name })));
  const [threshold, setThreshold] = useState(String(settings.populationThreshold));
  const [nightly, setNightly] = useState(settings.nightlyEnabled);
  const save = useSaveSyncSettings();
  const valid = /^\d+$/.test(threshold);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Scope settings</DialogTitle>
          <DialogDescription>Which reference records Reference sync flags as New. Changes apply from the next run.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Tracked countries</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="gap-2">
              <div className="flex items-center gap-2"><RadioGroupItem id="scope-theatres" value="theatres" />
                <Label htmlFor="scope-theatres" className="font-normal">Countries that have theatres</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem id="scope-custom" value="custom" />
                <Label htmlFor="scope-custom" className="font-normal">Choose countries</Label></div>
            </RadioGroup>
            {mode === "custom" && (
              <LocationMultiPicker entity="countries" value={countries} onChange={setCountries} placeholder="Search for a country" aria-label="Tracked countries" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scope-threshold">Population threshold</Label>
            <Input id="scope-threshold" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} aria-invalid={!valid} />
            <p className={cn("text-xs", valid ? "text-muted-foreground" : "text-red-500")}>
              {valid ? "New cities below this population aren't flagged. GeoNames' feed stops at 5,000." : "Enter a whole number"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="scope-nightly" checked={nightly} onCheckedChange={setNightly} />
            <Label htmlFor="scope-nightly" className="font-normal">Run every night</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{common.cancel}</Button>
          <Button disabled={!valid} loading={save.isPending}
            onClick={() => save.mutate(
              { trackedCountryIds: mode === "custom" ? countries.map((c) => c.id) : null, populationThreshold: Number(threshold), nightlyEnabled: nightly },
              { onSuccess: () => { toast.success("Scope settings saved"); onClose(); }, onError: (err) => toast.error(err.message) },
            )}>
            {common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

function ItemsPanel({ entity, counts }: { entity: ReviewEntity; counts: Record<ReviewFlag, number> }) {
  const [flag, setFlag] = useState<ReviewFlag | "all">("all");
  const [status, setStatus] = useState<ReviewStatus>("open");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const items = useReviewItems({ entity, flag: flag === "all" ? undefined : flag, status, search: debounced, page, pageSize });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {([{ id: "all", label: "All", n: total }, ...reviewFlags.map((f) => ({ id: f.id, label: f.label, n: counts[f.id] }))] as const).map((f) => (
          <Button key={f.id} size="sm" variant={flag === f.id ? "default" : "outline"} onClick={() => { setFlag(f.id as ReviewFlag | "all"); setPage(1); }}
            title={reviewFlags.find((x) => x.id === f.id)?.description}>
            {f.label} <span className="ml-1.5 tabular-nums opacity-70">{status === "open" ? f.n.toLocaleString() : ""}</span>
          </Button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items" className="w-56 pl-8" aria-label="Search review items" />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v as ReviewStatus); setPage(1); }}>
            <SelectTrigger className="w-32" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="ignored">Ignored</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <QueryState query={items} label="review items">
        {(data) => (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px] bg-muted/30">Flag</TableHead>
                    <TableHead className="bg-muted/30">CinemaDB</TableHead>
                    <TableHead className="bg-muted/30">Reference</TableHead>
                    <TableHead className="bg-muted/30">Differences</TableHead>
                    <TableHead className="w-[1%] bg-muted/30"><span className="sr-only">Decision</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        {status === "open" ? "Nothing to review." : `No ${status} items.`}
                      </TableCell>
                    </TableRow>
                  )}
                  {data.rows.map((item) => <ItemRow key={item.id} item={item} />)}
                </TableBody>
              </Table>
            </div>
            <PaginationControls
              currentPage={data.page} totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))} totalItems={data.total}
              rowsPerPage={pageSize} handlePageChange={setPage} handleRowsPerPageChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </>
        )}
      </QueryState>
    </div>
  );
}

const num = (v: unknown) => (typeof v === "number" ? v.toLocaleString() : String(v ?? ""));

function referenceText(item: ReviewItem) {
  const r = item.reference;
  if (!r) return <span className="text-muted-foreground">Not in {referenceSourceLabel[item.source]}</span>;
  const id = <span className="text-xs text-muted-foreground">{referenceSourceLabel[item.source]} {item.sourceRef}</span>;
  switch (item.entity) {
    case "countries":
      return <div><div>{String(r.name)} ({String(r.iso2)} / {String(r.iso3)})</div>{id}</div>;
    case "provinces":
      return <div><div>{String(r.name)}, {String(r.country)}</div>{id}</div>;
    case "cities":
      return (
        <div>
          <div>{String(r.name)}, {String(r.provinceName)}, {String(r.country)}</div>
          <div className="text-xs text-muted-foreground">Population {num(r.population)} · {String(r.timezone)} · {referenceSourceLabel[item.source]} {item.sourceRef}</div>
        </div>
      );
    default:
      return <div><div>{String(r.name)}</div>{id}</div>;
  }
}

function localText(item: ReviewItem) {
  if (item.flag === "duplicate") {
    const records = (item.local?.records ?? []) as { id: string; name: string }[];
    return (
      <div className="flex flex-col gap-0.5">
        {records.map((r) => <Link key={r.id} to={locationEditPath(item.entity, r.id)} className="hover:underline">{r.name}</Link>)}
      </div>
    );
  }
  if (!item.recordId) return <span className="text-muted-foreground">Not in CinemaDB</span>;
  const l = item.local ?? {};
  const detail = item.entity === "cities" ? `${l.province ?? ""}${l.code ? ` · ${l.code}` : ""}`
    : item.entity === "provinces" ? `${l.isoCode ?? ""} · ${l.country ?? ""}` : item.entity === "countries" ? String(l.iso2 ?? "") : "";
  return (
    <div>
      <Link to={locationEditPath(item.entity, item.recordId)} className="font-medium hover:underline">{item.recordLabel ?? String(l.name ?? item.recordId)}</Link>
      {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
    </div>
  );
}

function ItemRow({ item }: { item: ReviewItem }) {
  return (
    <TableRow>
      <TableCell><Badge variant={flagVariant[item.flag]}>{flagLabel(item.flag)}</Badge></TableCell>
      <TableCell>{localText(item)}</TableCell>
      <TableCell>{referenceText(item)}</TableCell>
      <TableCell>
        {item.differences.length === 0 ? <span className="text-muted-foreground">—</span> : (
          <ul className="space-y-0.5 text-sm">
            {item.differences.map((d) => (
              <li key={d.field}>
                <span className="text-muted-foreground">{d.field}:</span> {d.local ?? "—"} <span className="text-muted-foreground">→</span> {d.reference ?? "—"}
              </li>
            ))}
          </ul>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {item.status === "open" ? <ItemActions item={item} /> : (
          <div className="text-xs text-muted-foreground">
            <div className="font-medium capitalize text-foreground">{item.resolution}</div>
            {item.resolvedBy} · {item.resolvedAt && formatDateTime(item.resolvedAt)}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function ItemActions({ item }: { item: ReviewItem }) {
  const navigate = useNavigate();
  const decide = useDecideReviewItem();
  const [linkOpen, setLinkOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; body: string; action: ReviewAction | { action: "add" } } | null>(null);
  const run = (action: ReviewAction | { action: "add" }, done: string) =>
    decide.mutate({ id: item.id, action }, {
      onSuccess: () => { toast.success(done); setConfirm(null); setLinkOpen(false); },
      onError: (err) => toast.error(err.message),
    });
  const ignore = <Button size="sm" variant="ghost" disabled={decide.isPending} onClick={() => run({ action: "ignore" }, "Ignored")}>Ignore</Button>;
  const edit = item.recordId && (
    <Button size="sm" variant="outline" onClick={() => navigate(`${locationEditPath(item.entity, item.recordId!)}?reviewItem=${item.id}`)}>Edit</Button>
  );

  let main: React.ReactNode = null;
  if (item.flag === "new") {
    main = (
      <>
        <Button size="sm" disabled={decide.isPending}
          onClick={() => (item.entity === "timezones" ? run({ action: "add" }, `Added ${item.sourceRef}`) : navigate(locationNewPath(item.entity, item.id)))}>
          Add
        </Button>
        <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>Link</Button>
      </>
    );
  } else if (item.flag === "mismatch") {
    main = (
      <>
        {item.autoFix && (
          <Button size="sm" disabled={decide.isPending} title={item.autoFix}
            onClick={() => setConfirm({ title: "Link or fix", body: item.autoFix!, action: { action: "fix" } })}>
            Fix
          </Button>
        )}
        {edit}
      </>
    );
  } else if (item.flag === "missing") {
    main = (
      <>
        <Button size="sm" variant="outline" disabled={decide.isPending}
          onClick={() => setConfirm({
            title: `Deactivate ${item.recordLabel}?`,
            body: item.entity === "timezones" ? "The timezone is set inactive; its cities keep it." : "The record is deactivated (not deleted) and can be restored later.",
            action: { action: "deactivate" },
          })}>
          Deactivate
        </Button>
        {edit}
      </>
    );
  } else if (item.flag === "duplicate") {
    const records = (item.local?.records ?? []) as { id: string; name: string }[];
    main = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="sm" variant="outline">Keep…</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Keep the link on one; the others are unlinked</DropdownMenuLabel>
          {records.map((r) => (
            <DropdownMenuItem key={r.id} onSelect={() => run({ action: "keep", recordId: r.id }, `Kept the link on ${r.name}`)}>{r.name}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {main}
      {ignore}
      {linkOpen && <LinkDialog item={item} pending={decide.isPending} onClose={() => setLinkOpen(false)}
        onLink={(recordId) => run({ action: "link", recordId }, "Linked")} />}
      <Dialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>{common.cancel}</Button>
            <Button disabled={decide.isPending} onClick={() => confirm && run(confirm.action, "Done")}>{common.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LinkDialog({ item, pending, onClose, onLink }: { item: ReviewItem; pending: boolean; onClose: () => void; onLink: (id: string) => void }) {
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const info = entityInfo(item.entity);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link to an existing {info.singular.toLowerCase()}</DialogTitle>
          <DialogDescription>
            {item.entity === "timezones"
              ? `The chosen timezone is renamed to ${item.sourceRef}.`
              : `The chosen record is linked to ${referenceSourceLabel[item.source]} ${item.sourceRef} (${String(item.reference?.name ?? "")}); its values are not changed.`}
          </DialogDescription>
        </DialogHeader>
        <LocationPicker entity={item.entity} value={picked} onChange={setPicked} placeholder={`Search for a ${info.singular.toLowerCase()}`}
          aria-label={info.singular} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{common.cancel}</Button>
          <Button disabled={!picked || pending} onClick={() => picked && onLink(picked.id)}>{common.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Decisions log
// ---------------------------------------------------------------------------

function DecisionsPanel() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const decisions = useReviewDecisions(page, pageSize);
  return (
    <QueryState query={decisions} label="decisions">
      {(data) => (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-muted/30">When</TableHead>
                  <TableHead className="bg-muted/30">Who</TableHead>
                  <TableHead className="bg-muted/30">Decision</TableHead>
                  <TableHead className="bg-muted/30">Record</TableHead>
                  <TableHead className="bg-muted/30">Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No decisions yet.</TableCell></TableRow>
                )}
                {data.rows.map((d) => {
                  const name = String((d.current ?? d.previous)?.name ?? "");
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(d.createdAt)}</TableCell>
                      <TableCell>{d.updatedBy}</TableCell>
                      <TableCell><Badge variant="outline">{d.action}</Badge></TableCell>
                      <TableCell>
                        {d.recordId ? <Link className="hover:underline" to={locationEditPath(d.entity, d.recordId)}>{name || d.recordId}</Link>
                          : <span className="text-muted-foreground">{entityInfo(d.entity).singular} not in CinemaDB</span>}
                      </TableCell>
                      <TableCell>{d.source && referenceSourceLabel[d.source]} {d.sourceRef}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={data.page} totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))} totalItems={data.total}
            rowsPerPage={pageSize} handlePageChange={setPage} handleRowsPerPageChange={(s) => { setPageSize(s); setPage(1); }} />
        </>
      )}
    </QueryState>
  );
}

export default LocationReview;
