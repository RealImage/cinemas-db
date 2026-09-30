import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { QueryState } from "@/components/ui/query-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChainBasicInformation, ChainContactInformation, type ChainForm } from "@/components/chains/ChainDetailsForm";
import { ChainSystemsTab } from "@/components/chains/ChainSystemsTab";
import { ChainDeviceCredentialsTab } from "@/components/chains/ChainDeviceCredentialsTab";
import { ChainTheatresTab } from "@/components/chains/ChainTheatresTab";
import { ChainLogsTab } from "@/components/chains/ChainLogsTab";
import { useCallingCodes, useChain, useUpdateChain } from "@/hooks/api/chains";
import { ApiError } from "@/lib/api";
import { common } from "@/i18n/common";
import { chainFormErrors, type ChainDetails } from "@/data/chainDetails";

const TABS = [
  { id: "basic", label: "Basic Information" },
  { id: "contact", label: "Contact Information" },
  { id: "systems", label: "Theatre Systems" },
  { id: "device-credentials", label: "Device Credentials" },
  { id: "theatres", label: "Theatre List" },
  { id: "logs", label: "Logs" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const toForm = (c: ChainDetails): ChainForm => ({
  name: c.name,
  displayName: c.displayName,
  cityId: c.cityId,
  cityLabel: c.cityLabel,
  postalCode: c.postalCode,
  area: c.area,
  headOfficeAddress: c.headOfficeAddress,
  emails: c.emails,
  phones: c.phones,
  owners: c.owners,
});

/** Which of the two form tabs an error key belongs to. */
const tabOf = (key: string): TabId => (/^(emails|phones|owners)\./.test(key) ? "contact" : "basic");

/** The Edit Chain page's tabs, for a loaded chain. Basic and Contact Information share one Save / Cancel. */
function ChainEditor({ chain, tab, setTab }: { chain: ChainDetails; tab: TabId; setTab: (t: TabId) => void }) {
  const initial = useMemo(() => toForm(chain), [chain]);
  const [form, setForm] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const callingCodes = useCallingCodes();
  const save = useUpdateChain();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  // Leaving the page with unsaved edits asks first: a reload or closed tab through the browser, and a click on any
  // in-app link (the Back link, the sidebar) through a confirm. The app's BrowserRouter has no navigation blocker,
  // so the browser's own Back button within the app isn't covered.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const to = new URL(link.href, window.location.href);
      if (to.origin !== window.location.origin || to.pathname === window.location.pathname) return;
      if (!window.confirm("Discard your unsaved changes to this chain?")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  // Country codes are only checked here once they've loaded; the server checks them regardless
  const codes = callingCodes.data
    ? callingCodes.data.map((c) => c.code)
    : [...form.phones.map((p) => p.countryCode), ...form.owners.map((o) => o.countryCode)].map((c) => c.replace(/^\+/, ""));
  const errors = submitted ? { ...chainFormErrors(form, codes), ...serverErrors } : serverErrors;

  const onChange = (patch: Partial<ChainForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    if ("name" in patch) setServerErrors({});
  };

  const handleCancel = () => {
    setForm(initial);
    setSubmitted(false);
    setServerErrors({});
  };

  const handleSave = () => {
    setSubmitted(true);
    const found = Object.keys(chainFormErrors(form, codes));
    if (found.length) {
      // Show the first error's tab when it's the other one
      if (!found.some((k) => tabOf(k) === tab)) setTab(tabOf(found[0]));
      return;
    }
    const { cityLabel: _label, ...input } = form;
    save.mutate({ id: chain.id, ...input }, {
      onSuccess: (saved) => {
        toast.success(`Saved ${saved.name}`);
        setForm(toForm(saved));
        setSubmitted(false);
      },
      onError: (err) => {
        // 409 on the name: another chain has it
        if (err instanceof ApiError && err.status === 409 && /named/.test(err.message)) {
          setServerErrors({ name: err.message });
          setTab("basic");
        }
        toast.error(`Could not save ${chain.name}: ${err.message}`);
      },
    });
  };

  const formTab = tab === "basic" || tab === "contact";
  const errorTabs = new Set(Object.keys(errors).map(tabOf));

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <TabsList className="flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-2">
              {t.label}
              {t.id === "theatres" && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{chain.theatreCount}</Badge>}
              {errorTabs.has(t.id) && <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-label="has errors" />}
            </TabsTrigger>
          ))}
        </TabsList>
        {formTab && (
          <FormActions className="ml-auto pb-2">
            <Button variant="outline" onClick={handleCancel} disabled={!dirty || save.isPending}>{common.cancel}</Button>
            <Button onClick={handleSave} loading={save.isPending} disabled={!dirty}>{common.save}</Button>
          </FormActions>
        )}
      </div>
      <TabsContent value="basic" className="mt-4">
        <ChainBasicInformation form={form} onChange={onChange} errors={errors} companyName={chain.companyName ?? ""} />
      </TabsContent>
      <TabsContent value="contact" className="mt-4">
        {callingCodes.isError && (
          <p className="mb-3 text-sm text-red-500" role="alert">
            Could not load country codes: {callingCodes.error.message}{" "}
            <button type="button" className="underline" onClick={() => callingCodes.refetch()}>Retry</button>
          </p>
        )}
        <ChainContactInformation
          form={form} onChange={onChange} errors={errors} callingCodes={callingCodes.data} codesUnavailable={callingCodes.isError}
        />
      </TabsContent>
      <TabsContent value="systems" className="mt-4"><ChainSystemsTab chain={chain} /></TabsContent>
      <TabsContent value="device-credentials" className="mt-4"><ChainDeviceCredentialsTab chain={chain} /></TabsContent>
      <TabsContent value="theatres" className="mt-4"><ChainTheatresTab chain={chain} /></TabsContent>
      <TabsContent value="logs" className="mt-4"><ChainLogsTab chain={chain} /></TabsContent>
    </Tabs>
  );
}

/** /chains/:id — edit a chain. `?tab=` keeps the open tab across reloads. */
const ChainEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const chainQuery = useChain(id);
  const tab: TabId = TABS.find((t) => t.id === params.get("tab"))?.id ?? "basic";
  const setTab = (t: TabId) => setParams(t === "basic" ? {} : { tab: t }, { replace: true });

  useEffect(() => {
    if (chainQuery.error instanceof ApiError && chainQuery.error.status === 404) {
      toast.error("Chain not found");
      navigate("/chains");
    }
  }, [chainQuery.error, navigate]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button asChild variant="outline" size="icon">
          <Link to="/chains" aria-label="Back to Chains"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{chainQuery.data ? `Edit ${chainQuery.data.name}` : "Edit Chain"}</h1>
          <p className="mt-1 text-muted-foreground">Update chain details, systems and credentials</p>
        </div>
      </div>
      <QueryState query={chainQuery} label="chain">
        {(chain) => <ChainEditor key={chain.id} chain={chain} tab={tab} setTab={setTab} />}
      </QueryState>
    </motion.div>
  );
};

export default ChainEdit;
