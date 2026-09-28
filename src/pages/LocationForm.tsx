import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, History, Info } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormActions } from "@/components/ui/form-actions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { QueryState } from "@/components/ui/query-state";
import { common } from "@/i18n/common";
import { ApiError } from "@/lib/api";
import NotFound from "./NotFound";
import { FormField, entityForms, type Errors } from "@/components/locations/entityForms";
import { useLocationRecord, useReviewPrefill, useSaveLocation } from "@/hooks/api/locations";
import {
  entityFromSlug, entityInfo, locationListPath, locationLogsPath, LOCATION_REVIEW_PATH,
  type LocationEntity, type LocationRecordMap, type ReviewPrefill,
} from "@/data/locationsData";

/** Create or edit one location record: /locations/:entity/new and /locations/:entity/:id/edit. */
const LocationForm = () => {
  const params = useParams();
  const entity = entityFromSlug(params.entity);
  const [search] = useSearchParams();
  const reviewItemId = search.get("reviewItem") ? Number(search.get("reviewItem")) : null;
  const record = useLocationRecord(entity ?? "countries", entity ? params.id : undefined);
  const prefill = useReviewPrefill(!params.id ? reviewItemId : null);

  if (!entity || (!params.id && entity === "timezones")) return <NotFound />;
  if (record.error instanceof ApiError && record.error.status === 404) return <NotFound />;

  if (params.id) {
    return (
      <QueryState query={record} label={entityInfo(entity).singular.toLowerCase()}>
        {(r) => <FormView key={`${r.id}:${r.updatedAt}`} entity={entity} record={r} reviewItemId={reviewItemId} />}
      </QueryState>
    );
  }
  if (reviewItemId != null) {
    return (
      <QueryState query={prefill} label="reference values">
        {(p) => <FormView entity={entity} prefill={p} reviewItemId={reviewItemId} />}
      </QueryState>
    );
  }
  return <FormView entity={entity} reviewItemId={null} />;
};

function FormView({ entity, record, prefill, reviewItemId }: {
  entity: LocationEntity;
  record?: LocationRecordMap[LocationEntity];
  prefill?: ReviewPrefill;
  reviewItemId: number | null;
}) {
  const navigate = useNavigate();
  const info = entityInfo(entity);
  const def = entityForms[entity];
  const initial = useMemo(() => def.init(record as never, prefill), [def, record, prefill]);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [confirmLeave, setConfirmLeave] = useState(false);
  const save = useSaveLocation(entity);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const backTo = reviewItemId != null ? `${LOCATION_REVIEW_PATH}?entity=${entity}` : locationListPath(entity);

  // Leaving the page with unsaved edits (reload, close tab) asks the browser to confirm
  useEffect(() => {
    if (!dirty || save.isSuccess) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, save.isSuccess]);

  const set = (patch: object) => {
    setForm((f: object) => ({ ...f, ...patch }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in patch))));
  };

  const cancel = () => (dirty ? setConfirmLeave(true) : navigate(backTo));

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const found = def.validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error("Fix the highlighted fields");
      return;
    }
    save.mutate(
      { id: record?.id, input: { ...def.toInput(form), ...(reviewItemId != null ? { reviewItemId } : {}) } },
      {
        onSuccess: (saved) => {
          toast.success(`${record ? "Saved" : "Created"} ${(saved as { name: string }).name}`);
          navigate(backTo);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const title = record ? `Edit ${info.singular}: ${(record as { name: string }).name}` : `New ${info.singular}`;
  const actions = (
    <FormActions>
      <Button type="button" variant="outline" onClick={cancel} disabled={save.isPending}>{common.cancel}</Button>
      <Button type="submit" loading={save.isPending}>{common.save}</Button>
    </FormActions>
  );
  const Fields = def.Fields;

  return (
    <form onSubmit={submit} className="space-y-5 animate-fade-in" noValidate>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={cancel} aria-label={`Back to ${info.label}`}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">Fields marked <span className="text-red-500">*</span> are required</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {record && (
            <Button type="button" variant="ghost" asChild>
              <Link to={locationLogsPath(entity, record.id)}><History className="mr-2 h-4 w-4" /> Logs</Link>
            </Button>
          )}
          {actions}
        </div>
      </div>

      {reviewItemId != null && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {record
              ? "Saving resolves the Reference sync item for this record."
              : "Prefilled from the reference. Saving adds the record and links it to the reference, which resolves the review item."}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="grid grid-cols-1 gap-x-6 gap-y-4 pt-6 md:grid-cols-2">
          <Fields form={form} set={set} errors={errors} record={record} />
          <FormField label="UUID" htmlFor="loc-uuid" hint={record ? "Generated by CinemaDB" : "Generated when you save"}>
            <Input id="loc-uuid" value={record?.id ?? ""} placeholder="—" disabled readOnly className="font-mono text-xs" />
          </FormField>
        </CardContent>
      </Card>

      {actions}

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have changes that have not been saved onto CinemaDB. Leave this page and discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(backTo)}>{common.confirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

export default LocationForm;
