import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useScreenStatusReasons } from "@/hooks/api/screens";
import { SCREEN_STATUS_REASON_TYPES, type Screen } from "@/types";

/** Reason (required) and comments for an Inactive or Deleted screen; renders nothing for an Active one. */
export function StatusReasonFields({ status, reasonId, comments, onChange, error, idPrefix = "status" }: {
  status: Screen["status"] | undefined;
  reasonId: string | null | undefined;
  comments: string | null | undefined;
  onChange: (patch: Pick<Screen, "statusReasonId" | "statusComments">) => void;
  error?: string;
  idPrefix?: string;
}) {
  const reasonType = status === "Inactive" || status === "Deleted" ? SCREEN_STATUS_REASON_TYPES[status] : null;
  const reasonsQuery = useScreenStatusReasons(!!reasonType);
  if (!reasonType) return null;
  const options = (reasonsQuery.data ?? []).filter((r) => r.reasonType === reasonType);
  const label = status === "Inactive" ? "Reason for deactivating" : "Reason for deleting";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-reason`}>{label}</Label>
        <Select
          value={options.some((o) => o.id === reasonId) ? reasonId! : ""}
          onValueChange={(v) => onChange({ statusReasonId: v, statusComments: comments ?? "" })}
          disabled={!reasonsQuery.data}
        >
          <SelectTrigger
            id={`${idPrefix}-reason`}
            aria-required="true"
            aria-invalid={!!error}
            aria-describedby={error ? `${idPrefix}-reason-error` : undefined}
          >
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
        {error && <p id={`${idPrefix}-reason-error`} className="text-xs text-red-500">{error}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-comments`}>Additional Comments</Label>
        <Input
          id={`${idPrefix}-comments`}
          value={comments ?? ""}
          onChange={(e) => onChange({ statusReasonId: reasonId ?? null, statusComments: e.target.value })}
        />
      </div>
    </div>
  );
}
