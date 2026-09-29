import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useStatusReasons } from "@/hooks/api/screens";
import { SCREEN_STATUS_REASON_TYPES, type Screen, type StatusReasonType } from "@/types";

/** A reason (required) from one of the status reason lists, plus optional comments. */
export function ReasonFields({ reasonType, label, reasonId, comments, onChange, error, idPrefix = "status", stacked = false }: {
  reasonType: StatusReasonType;
  label: string;
  reasonId: string | null | undefined;
  comments: string | null | undefined;
  onChange: (patch: { reasonId: string | null; comments: string }) => void;
  error?: string;
  idPrefix?: string;
  /** One field per row (in a narrow dialog) instead of side by side. */
  stacked?: boolean;
}) {
  const reasonsQuery = useStatusReasons();
  const options = (reasonsQuery.data ?? []).filter((r) => r.reasonType === reasonType);

  return (
    <div className={cn("grid grid-cols-1 gap-4", !stacked && "md:grid-cols-2")}>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-reason`}>{label}</Label>
        <Select
          value={options.some((o) => o.id === reasonId) ? reasonId! : ""}
          onValueChange={(v) => onChange({ reasonId: v, comments: comments ?? "" })}
          disabled={!reasonsQuery.data}
        >
          <SelectTrigger id={`${idPrefix}-reason`} aria-invalid={!!error}>
            <SelectValue placeholder={
              reasonsQuery.isError ? "Could not load reasons" : reasonsQuery.data ? "Select reason" : "Loading reasons…"
            } />
          </SelectTrigger>
          <SelectContent>
            {options.map((r) => <SelectItem key={r.id} value={r.id}>{r.reason}</SelectItem>)}
          </SelectContent>
        </Select>
        {reasonsQuery.isError && (
          <p className="text-xs text-red-500">
            Could not load reasons: {reasonsQuery.error.message}{" "}
            <button type="button" className="underline" onClick={() => reasonsQuery.refetch()}>Retry</button>
          </p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-comments`}>Additional Comments</Label>
        <Input
          id={`${idPrefix}-comments`}
          value={comments ?? ""}
          onChange={(e) => onChange({ reasonId: reasonId ?? null, comments: e.target.value })}
        />
      </div>
    </div>
  );
}

/** Reason (required) and comments for an Inactive or Deleted screen; renders nothing for an Active one. */
export function StatusReasonFields({ status, reasonId, comments, onChange, error, idPrefix = "status" }: {
  status: Screen["status"] | undefined;
  reasonId: string | null | undefined;
  comments: string | null | undefined;
  onChange: (patch: Pick<Screen, "statusReasonId" | "statusComments">) => void;
  error?: string;
  idPrefix?: string;
}) {
  if (status !== "Inactive" && status !== "Deleted") return null;
  return (
    <ReasonFields
      reasonType={SCREEN_STATUS_REASON_TYPES[status]}
      label={status === "Inactive" ? "Reason for deactivating" : "Reason for deleting"}
      reasonId={reasonId}
      comments={comments}
      onChange={(p) => onChange({ statusReasonId: p.reasonId, statusComments: p.comments })}
      error={error}
      idPrefix={idPrefix}
    />
  );
}
