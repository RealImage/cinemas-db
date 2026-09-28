import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, CheckCircle2, Search } from "lucide-react";
import { FlmFeed } from "@/data/flmFeedsData";
import { useCreateTheatreFromFlmFeed, useFlmFeed, useMapFlmFeed } from "@/hooks/api/flm";
import { useTheatres } from "@/hooks/api/theatres";
import { QueryState } from "@/components/ui/query-state";
import { ApiError } from "@/lib/api";
import { Theatre } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { common } from "@/i18n/common";

type FieldKey = "sourceTheatreId" | "theatreUuid" | "name" | "displayName" | "address" | "city" | "state" | "country" | "postalCode" | "chain" | "timezone" | "contactName" | "phone" | "email";
type ComparisonField = { key: FieldKey; label: string; incoming: string; current: string };

const getLocationParts = (feed: FlmFeed) => {
  const parts = feed.location.split(",").map((part) => part.trim());
  return { city: parts[0] ?? "—", state: parts[1] ?? "—", country: parts[2] ?? "—" };
};

const buildFields = (feed: FlmFeed, theatre: Theatre): ComparisonField[] => {
  const location = getLocationParts(feed);
  const details = feed.details;
  return [
    { key: "sourceTheatreId", label: "Source Theatre ID", incoming: feed.theatreIdFeed, current: theatre.thirdPartyId || "Not provided" },
    { key: "theatreUuid", label: "Theatre UUID", incoming: feed.theatreUuid, current: theatre.uuid },
    { key: "name", label: "Theatre Name", incoming: feed.theatreName, current: theatre.name },
    { key: "displayName", label: "Display Name", incoming: feed.theatreDisplayName, current: theatre.displayName },
    { key: "address", label: "Address", incoming: feed.address, current: theatre.address },
    { key: "city", label: "City", incoming: details?.city ?? location.city, current: theatre.city },
    { key: "state", label: "State / Province", incoming: details?.state ?? location.state, current: theatre.state },
    { key: "country", label: "Country", incoming: details?.country ?? location.country, current: theatre.country },
    { key: "postalCode", label: "Postal Code", incoming: details?.postalCode ?? "Not provided", current: theatre.postalCode },
    { key: "chain", label: "Chain / Circuit", incoming: feed.chain, current: theatre.chainName },
    { key: "timezone", label: "Time Zone", incoming: details?.timezone ?? "Not provided", current: theatre.timezone ?? "Not provided" },
    { key: "contactName", label: "Contact Name", incoming: details?.contact.name ?? "Not provided", current: "Not provided" },
    { key: "phone", label: "Contact Phone", incoming: details?.contact.phone ?? "Not provided", current: theatre.phoneNumber || "Not provided" },
    { key: "email", label: "Contact Email", incoming: details?.contact.email ?? "Not provided", current: theatre.email || "Not provided" },
  ];
};

const ReadonlyRow = ({ label, value }: { label: string; value: string }) => (
  <div className="border-b border-border py-3 last:border-b-0">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-sm font-medium break-words">{value || "—"}</p>
  </div>
);

const IncomingSummary = ({ feed }: { feed: FlmFeed }) => {
  const location = getLocationParts(feed);
  const details = feed.details;
  return (
    <div className="space-y-0">
      <ReadonlyRow label="Theatre Name" value={feed.theatreName} />
      <ReadonlyRow label="Display Name" value={feed.theatreDisplayName} />
      <ReadonlyRow label="Source Theatre ID" value={feed.theatreIdFeed} />
      <ReadonlyRow label="Theatre UUID" value={feed.theatreUuid} />
      <ReadonlyRow label="Address" value={feed.address} />
      <ReadonlyRow label="Location" value={`${details?.city ?? location.city}, ${details?.state ?? location.state}, ${details?.country ?? location.country}`} />
      <ReadonlyRow label="Postal Code" value={details?.postalCode ?? "Not provided"} />
      <ReadonlyRow label="Chain / Circuit" value={feed.chain} />
      <ReadonlyRow label="Time Zone" value={details?.timezone ?? "Not provided"} />
      <ReadonlyRow label="Contact" value={details ? `${details.contact.name} · ${details.contact.phone} · ${details.contact.email}` : "Not provided"} />
      {details?.alternateIds && <ReadonlyRow label="Alternate IDs" value={details.alternateIds.join(" · ")} />}
    </div>
  );
};

const IncomingIdentifiers = ({ feed }: { feed: FlmFeed }) => {
  const details = feed.details;
  if (!details?.alternateIds?.length) return null;
  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <p className="font-semibold">FLM Feed Identifiers</p>
        <p className="text-sm text-muted-foreground">Additional identifiers supplied by {feed.source}</p>
      </div>
      <div className="p-5">
        <ReadonlyRow label="Alternate IDs" value={details.alternateIds.join(" · ")} />
      </div>
    </section>
  );
};

const ScreensSummary = ({ feed }: { feed: FlmFeed }) => {
  const screens = feed.details?.auditoriums ?? [];
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Screens ({screens.length})</p>
        <span className="text-xs text-muted-foreground">Reference only</span>
      </div>
      {screens.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">No screen details were included in this feed.</p>
      ) : (
        <Accordion type="multiple" className="rounded-md border border-border px-3">
          {screens.map((screen) => (
            <AccordionItem key={screen.id} value={screen.id}>
              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                <span>{screen.name} · {screen.seatingCapacity} seats · {screen.devices.length} devices</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>Suites: {screen.suiteCount}</p>
                  {screen.devices.map((device) => (
                    <p key={device.serialNumber}>{device.manufacturer} {device.model} · {device.serialNumber}</p>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};

type ComparisonTableProps = {
  feed: FlmFeed;
  theatre: Theatre;
  fields: ComparisonField[];
  differences: ComparisonField[];
  selectedFields: Set<FieldKey>;
  setSelectedFields: React.Dispatch<React.SetStateAction<Set<FieldKey>>>;
  isActionable: boolean;
};

const ComparisonTable = ({ feed, theatre, fields, differences, selectedFields, setSelectedFields, isActionable }: ComparisonTableProps) => {
  const toggleField = (key: FieldKey, checked: boolean) => {
    setSelectedFields((previous) => {
      const next = new Set(previous);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="grid grid-cols-1 border-b border-border md:grid-cols-2">
        <div className="border-b border-border px-5 py-4 md:border-b-0 md:border-r">
          <p className="font-semibold">Incoming FLM Feed</p>
          <p className="text-sm text-muted-foreground">Read-only details received from {feed.source}</p>
        </div>
        <div className="flex items-start justify-between px-5 py-4">
          <div>
            <p className="font-semibold">Mapped Theatre (current)</p>
            <p className="text-sm text-muted-foreground">{theatre.name}</p>
          </div>
          {isActionable && differences.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedFields(new Set())}>
              Clear all
            </Button>
          )}
        </div>
      </div>

      {fields.map((field, index) => {
        const isLast = index === fields.length - 1;
        const differs = differences.some((item) => item.key === field.key);
        const selected = selectedFields.has(field.key);
        return (
          <div key={field.key} className="grid grid-cols-1 md:grid-cols-2">
            <div className={cn("border-r border-border px-5 py-3", !isLast && "border-b")}>
              <p className="text-xs text-muted-foreground">{field.label}</p>
              <p className="mt-1 text-sm font-medium break-words">{field.incoming || "—"}</p>
            </div>
            <div className={cn("px-5 py-3", !isLast && "border-b", differs && selected && "bg-accent/50")}>
              <div className="grid grid-cols-[24px_1fr] gap-2">
                <div className="pt-4">
                  {differs && isActionable ? (
                    <Checkbox
                      checked={selected}
                      onCheckedChange={(checked) => toggleField(field.key, checked === true)}
                      aria-label={`Copy ${field.label}`}
                    />
                  ) : null}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {field.label}
                    {differs && <span className="ml-2 text-primary">Different</span>}
                  </p>
                  <p className="mt-1 text-sm font-medium break-words">{field.current || "—"}</p>
                  {differs && <p className="mt-1 text-xs text-muted-foreground">Incoming: {field.incoming}</p>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
};

const FlmFeedDetails = () => {
  const { id } = useParams();
  const feedQuery = useFlmFeed(id);
  const theatresQuery = useTheatres();
  const navigate = useNavigate();

  if (feedQuery.error instanceof ApiError && feedQuery.error.status === 404) {
    return <div className="py-16 text-center"><p className="text-muted-foreground">FLM feed record not found.</p><Button className="mt-4" onClick={() => navigate("/theatres/flm-feeds")}>Back to FLM Feeds</Button></div>;
  }
  return (
    <QueryState query={feedQuery} label="FLM feed">
      {(feed) => (
        <QueryState query={theatresQuery} label="theatres">
          {(theatres) => <FlmFeedDetailsView key={feed.id} feed={feed} theatres={theatres} />}
        </QueryState>
      )}
    </QueryState>
  );
};

const FlmFeedDetailsView = ({ feed, theatres }: { feed: FlmFeed; theatres: Theatre[] }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const mapFeed = useMapFlmFeed();
  const createTheatre = useCreateTheatreFromFlmFeed();
  const initialTheatre = feed.mappedTheatreId ? theatres.find((item) => item.id === feed.mappedTheatreId) : undefined;
  const [selectedTheatre, setSelectedTheatre] = useState<Theatre | undefined>(initialTheatre);
  const [search, setSearch] = useState("");
  const [selectedFields, setSelectedFields] = useState<Set<FieldKey>>(new Set());
  const [selectionReady, setSelectionReady] = useState(false);
  const [createMode, setCreateMode] = useState(
    !initialTheatre && feed.status === "Manual" && (location.state as { createMode?: boolean } | null)?.createMode === true,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fields = useMemo(() => selectedTheatre ? buildFields(feed, selectedTheatre) : [], [feed, selectedTheatre]);
  const differences = useMemo(() => fields.filter((field) => field.incoming.trim().toLowerCase() !== field.current.trim().toLowerCase()), [fields]);
  useEffect(() => {
    if (!selectionReady && differences.length > 0) {
      setSelectedFields(new Set(differences.map((field) => field.key)));
      setSelectionReady(true);
    }
  }, [differences, selectionReady]);

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return theatres.filter((theatre) => [theatre.name, theatre.displayName, theatre.uuid, theatre.thirdPartyId, theatre.chainName, theatre.city, theatre.state, theatre.country].join(" ").toLowerCase().includes(query)).slice(0, 6);
  }, [search, theatres]);

  const isActionable = feed.status === "Manual";
  const selectedChanges = differences.filter((field) => selectedFields.has(field.key));
  const chooseTheatre = (theatre: Theatre) => {
    setSelectedTheatre(theatre);
    setCreateMode(false);
    setSelectionReady(false);
  };
  const saving = mapFeed.isPending || createTheatre.isPending;
  const finish = async () => {
    try {
      if (createMode) await createTheatre.mutateAsync(feed.id);
      else if (selectedTheatre) {
        await mapFeed.mutateAsync({ feedId: feed.id, theatreId: selectedTheatre.id, fields: selectedChanges.map((f) => f.key) });
      }
    } catch (err) {
      toast({ title: createMode ? "Could not create theatre" : "Could not update theatre", description: (err as Error).message, variant: "destructive" });
      return;
    }
    setConfirmOpen(false);
    toast({ title: createMode ? "Theatre created" : "Theatre updated", description: `${feed.theatreName} was mapped successfully.` });
    navigate("/theatres/flm-feeds");
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Back to FLM Feeds" onClick={() => navigate("/theatres/flm-feeds")}><ArrowLeft className="h-4 w-4" /></Button>
          <div><p className="font-semibold">{feed.theatreName}</p><p className="text-sm text-muted-foreground">{feed.source} · {feed.theatreIdFeed}</p></div>
        </div>
        <div className="flex gap-2"><Badge variant="outline">{feed.status}</Badge><Badge variant={feed.isNewTheatre ? "default" : "secondary"}>{feed.isNewTheatre ? "New Theatre" : "Existing Theatre"}</Badge></div>
      </div>

      {!isActionable && <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">This feed was processed automatically. Details are read-only.</div>}

      {selectedTheatre ? (
        <div className="space-y-4">
          <ComparisonTable
            feed={feed}
            theatre={selectedTheatre}
            fields={fields}
            differences={differences}
            selectedFields={selectedFields}
            setSelectedFields={setSelectedFields}
            isActionable={isActionable}
          />
          <IncomingIdentifiers feed={feed} />
          <section className="rounded-md border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <p className="font-semibold">Screens from FLM Feed</p>
              <p className="text-sm text-muted-foreground">Auditorium and device summary for reference</p>
            </div>
            <div className="p-5">
              <ScreensSummary feed={feed} />
            </div>
          </section>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-md border border-border bg-card">
            <div className="border-b border-border px-5 py-4"><p className="font-semibold">Incoming FLM Feed</p><p className="text-sm text-muted-foreground">Read-only details received from {feed.source}</p></div>
            <div className="p-5"><IncomingSummary feed={feed} /><div className="mt-4"><ScreensSummary feed={feed} /></div></div>
          </section>

          <section className="rounded-md border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div><p className="font-semibold">{createMode ? "New Theatre Preview" : "Select a Target Theatre"}</p><p className="text-sm text-muted-foreground">{createMode ? "Theatre will use the incoming values" : "Map this feed or create a new theatre"}</p></div>
            </div>

            {!selectedTheatre && !createMode && (
              <div className="space-y-5 p-5">
                <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, ID, chain, or location" className="pl-9" /></div>
                {matches.length > 0 && <div className="divide-y divide-border rounded-md border border-border">{matches.map((theatre) => <button key={theatre.id} type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={() => chooseTheatre(theatre)}><span><span className="block text-sm font-medium">{theatre.name}</span><span className="block text-xs text-muted-foreground">{theatre.chainName} · {theatre.city}, {theatre.state}, {theatre.country}</span></span><span className="font-mono text-xs text-muted-foreground">{theatre.uuid}</span></button>)}</div>}
                {search && matches.length === 0 && <p className="text-center text-sm text-muted-foreground">No matching theatres found.</p>}
                <div className="flex items-center gap-3 py-2"><div className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">OR</span><div className="h-px flex-1 bg-border" /></div>
                <Button variant="outline" className="w-full" onClick={() => setCreateMode(true)}><Building2 className="mr-2 h-4 w-4" />Create New Theatre</Button>
              </div>
            )}

            {createMode && <div className="p-5"><div className="mb-4 flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" /><div><p className="text-sm font-medium">Ready to create from incoming details</p><p className="text-xs text-muted-foreground">Review the read-only feed details on the left before confirming.</p></div></div><IncomingSummary feed={feed} /><Button variant="ghost" size="sm" className="mt-3" onClick={() => setCreateMode(false)}>Choose an existing theatre instead</Button></div>}
          </section>
        </div>
      )}

      {isActionable && (selectedTheatre || createMode) && <div className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-end gap-3 border-t border-border bg-card px-6 py-4 shadow-xl md:left-64"><Button variant="outline" onClick={() => navigate("/theatres/flm-feeds")}>{common.cancel}</Button><Button disabled={!createMode && selectedChanges.length === 0} onClick={() => setConfirmOpen(true)}>{createMode ? "Create New Theatre" : feed.isNewTheatre ? "Map & Update Theatre" : "Update Theatre"}</Button></div>}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{createMode ? "Create new theatre?" : "Confirm theatre update"}</DialogTitle><DialogDescription>{createMode ? "The theatre will be created using the incoming FLM details." : `These ${selectedChanges.length} selected fields will be copied to ${selectedTheatre?.name}.`}</DialogDescription></DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border">
            {createMode ? <div className="p-4"><IncomingSummary feed={feed} /></div> : selectedChanges.map((field) => <div key={field.key} className="grid gap-1 border-b border-border p-3 last:border-b-0 sm:grid-cols-[140px_1fr_24px_1fr]"><p className="text-xs font-medium">{field.label}</p><p className="text-xs text-muted-foreground line-through">{field.current}</p><span className="text-xs text-muted-foreground">→</span><p className="text-xs font-medium">{field.incoming}</p></div>)}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>{common.cancel}</Button><Button onClick={finish} loading={saving}>{common.confirm}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FlmFeedDetails;
