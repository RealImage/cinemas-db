import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AgentDetails,
  AgentUpdateInput,
  ConfigFieldDef,
  ConfigValueType,
  configValueTypeLabels,
  configValueTypes,
  allEntitlements,
  normalizeEntitlements,
} from "@/data/agentConfigData";
import { looksSecret } from "@/data/credentialsManagerData";
import { common } from "@/i18n/common";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agent: AgentDetails;
  /** Resolves when saved (the dialog then closes); rejects to keep it open. */
  onSave: (input: AgentUpdateInput) => Promise<unknown>;
  saving?: boolean;
}

/**
 * A configuration row in the editor; `key` is empty for rows added in this
 * session. `maskedSet` is true once Masked was set by hand, so naming a new
 * field "Password" no longer changes it.
 */
type FieldRow = ConfigFieldDef & { rowId: string; maskedSet?: boolean };

let rowSeq = 0;
const toRow = (f: ConfigFieldDef): FieldRow => ({ ...f, rowId: `cfg-${++rowSeq}`, maskedSet: !!f.key });

export const EditAgentDialog = ({ open, onOpenChange, agent, onSave, saving = false }: Props) => {
  const [entitlements, setEntitlements] = useState<string[]>([]);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEntitlements(normalizeEntitlements(agent.entitlements));
    setFields(agent.configFields.map(toRow));
    setSubmitted(false);
  }, [open, agent]);

  const updField = (rowId: string, patch: Partial<FieldRow>) =>
    setFields((rows) => rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  const toggleEntitlement = (id: string, on: boolean) =>
    setEntitlements((ids) => normalizeEntitlements(on ? [...ids, id] : ids.filter((x) => x !== id)));

  const names = fields.map((f) => f.name.trim().toLowerCase());
  const fieldError = (row: FieldRow, i: number) =>
    !row.name.trim() ? "Name is required" : names.indexOf(row.name.trim().toLowerCase()) !== i ? "Name is used twice" : null;
  const valid = fields.every((r, i) => !fieldError(r, i));

  const formatChanged =
    JSON.stringify(agent.configFields.map((f) => [f.key, f.name, f.valueType, f.masked])) !==
    JSON.stringify(fields.map((f) => [f.key, f.name.trim(), f.valueType, f.masked]));
  const maskingChanged = fields.some((f) => agent.configFields.some((a) => a.key === f.key && a.masked !== f.masked));

  const handleSave = () => {
    setSubmitted(true);
    if (!valid) return;
    onSave({
      entitlements,
      configFields: fields.map(({ key, name, valueType, masked }) => ({ key, name: name.trim(), valueType, masked })),
    }).then(() => onOpenChange(false), () => undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Edit agent — {agent.agentOsName}</DialogTitle>
          <DialogDescription>Entitlements and the configurations this agent takes.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
          <fieldset className="space-y-3">
            <legend className="mb-1 text-xs font-medium">Agent entitlements</legend>
            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              {allEntitlements.map((e) => (
                <label key={e.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={entitlements.includes(e.id)}
                    disabled={e.locked}
                    onCheckedChange={(c) => toggleEntitlement(e.id, c === true)}
                  />
                  <span>
                    {e.label}
                    {e.locked && <span className="ml-1 text-xs text-muted-foreground">(always on)</span>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-xs font-medium">Configurations format</legend>
            {fields.length > 0 && (
              <div className="grid grid-cols-[1fr_9rem_4rem_2.125rem] items-center gap-2 text-xs text-muted-foreground">
                <span>Configuration name</span>
                <span>Value type</span>
                <span className="text-center" title="Masked values are stored encrypted and hidden until someone clicks View">Masked</span>
                <span className="sr-only">Remove</span>
              </div>
            )}
            {fields.map((row, i) => (
              <div key={row.rowId} className="space-y-1">
                <div className="grid grid-cols-[1fr_9rem_4rem_2.125rem] items-center gap-2">
                  <Input
                    aria-label={`Configuration name ${i + 1}`}
                    value={row.name}
                    onChange={(e) =>
                      updField(row.rowId, {
                        name: e.target.value,
                        // Suggest Masked for new fields named like a secret, until it's set by hand
                        ...(!row.maskedSet && { masked: looksSecret(e.target.value) }),
                      })}
                    placeholder="e.g. Storage, Multicast IP, Port"
                    aria-invalid={submitted && !!fieldError(row, i)}
                  />
                  <Select value={row.valueType} onValueChange={(v: ConfigValueType) => updField(row.rowId, { valueType: v })}>
                    <SelectTrigger aria-label={`Value type ${i + 1}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {configValueTypes.map((t) => <SelectItem key={t} value={t}>{configValueTypeLabels[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex justify-center">
                    <Checkbox
                      checked={row.masked}
                      onCheckedChange={(c) => updField(row.rowId, { masked: c === true, maskedSet: true })}
                      aria-label={`Masked ${row.name || `configuration ${i + 1}`}`}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${row.name || `configuration ${i + 1}`}`}
                    onClick={() => setFields((rows) => rows.filter((r) => r.rowId !== row.rowId))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {submitted && fieldError(row, i) && <p className="text-xs text-red-500">{fieldError(row, i)}</p>}
              </div>
            ))}
            {fields.length === 0 && <p className="text-sm text-muted-foreground">This agent has no configurations.</p>}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFields((rows) => [...rows, toRow({ key: "", name: "", valueType: "string", masked: false })])}
            >
              <Plus className="h-4 w-4" /> Add configuration
            </Button>
            {formatChanged && agent.configFields.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Existing configurations keep their stored values. New configurations stay blank until each row is edited.
                {maskingChanged && " Stored values of configurations whose Masked setting changed are encrypted or decrypted when you save."}
              </p>
            )}
          </fieldset>
        </div>

        <DialogFooter className="border-t border-border px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{common.cancel}</Button>
          <Button onClick={handleSave} loading={saving}>{common.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
