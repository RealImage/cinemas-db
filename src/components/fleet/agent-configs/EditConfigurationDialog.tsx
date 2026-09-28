import { useEffect, useId, useRef, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  AgentConfiguration,
  AgentConfigurationInput,
  AgentDetails,
  ConfigFieldDef,
  ConfigScope,
  GLOBAL_REF,
  configScopes,
  configValueError,
  configValueTypeLabels,
  describeConfigFields,
} from "@/data/agentConfigData";
import { revealAgentConfigValue } from "@/hooks/api/agentConfigs";
import { useCredentialRefOptions } from "@/hooks/api/credentials";
import { common } from "@/i18n/common";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agent: AgentDetails;
  scope: ConfigScope;
  /** Existing row to edit; null to add a new one. */
  row: AgentConfiguration | null;
  /** Refs already used in this scope, to prevent duplicates. */
  takenRefs: string[];
  /** Resolves when saved (the dialog then closes); rejects to keep it open. */
  onSave: (input: AgentConfigurationInput & { configId?: string }) => Promise<unknown>;
  saving?: boolean;
}

const inputMode = (f: ConfigFieldDef) => (f.valueType === "integer" ? "numeric" : f.valueType === "storage_gb" || f.valueType === "ip" ? "decimal" : undefined);

export const EditConfigurationDialog = ({ open, onOpenChange, agent, scope, row, takenRefs, onSave, saving = false }: Props) => {
  const scopeInfo = configScopes.find((s) => s.id === scope)!;
  const needsRef = scope !== "global";
  // Chains and theatres come from the same lists as credential scopes
  const refOptionsQuery = useCredentialRefOptions(open && needsRef);
  const [ref, setRef] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [revealing, setRevealing] = useState<string | null>(null);
  /** Stored values loaded by the eye icon, so hiding one again can discard it. */
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  /** Bumped whenever the dialog opens, closes or switches row; a reveal from an older session is dropped. */
  const session = useRef(0);
  /** Per-instance prefix: each scope tab has its own dialog, so field ids must not collide. */
  const idPrefix = useId();

  useEffect(() => {
    session.current++;
    setRevealing(null);
    if (!open) return;
    setRef(row?.ref ?? (scope === "global" ? GLOBAL_REF : ""));
    // Masked values aren't loaded; leaving one blank keeps the stored value
    setValues(row?.values ?? {});
    setShown({});
    setRevealed({});
  }, [open, row, scope]);

  const fields = agent.configFields;
  const hasStored = (f: ConfigFieldDef) => f.masked && !!row?.maskedKeys.includes(f.key);

  const toggleShown = (f: ConfigFieldDef) => {
    if (shown[f.key]) {
      setShown((s) => ({ ...s, [f.key]: false }));
      // Hiding an untouched revealed value discards it (the stored value is kept on save)
      if (f.key in revealed && values[f.key] === revealed[f.key]) {
        setValues((v) => ({ ...v, [f.key]: "" }));
        setRevealed(({ [f.key]: _drop, ...rest }) => rest);
      }
      return;
    }
    if (!(values[f.key] ?? "") && hasStored(f) && row) {
      const started = session.current;
      setRevealing(f.key);
      revealAgentConfigValue(agent.id, row.id, f.key)
        .then((v) => {
          if (session.current !== started) return;
          setValues((vals) => ({ ...vals, [f.key]: v }));
          setRevealed((r) => ({ ...r, [f.key]: v }));
          setShown((s) => ({ ...s, [f.key]: true }));
        }, (err: Error) => {
          if (session.current === started) toast.error(`Could not show ${f.name.toLowerCase()}: ${err.message}`);
        })
        .finally(() => { if (session.current === started) setRevealing(null); });
      return;
    }
    setShown((s) => ({ ...s, [f.key]: true }));
  };

  const options = scope === "chain" ? refOptionsQuery.data?.chains : scope === "theatre" ? refOptionsQuery.data?.theatres : undefined;
  // Keep the row's current ref selectable even if it's no longer in the list
  const refOptions = options && row?.ref && !options.includes(row.ref) ? [row.ref, ...options] : options;
  const trimmedRef = ref.trim();
  const duplicate = needsRef && trimmedRef !== "" && trimmedRef !== row?.ref && takenRefs.includes(trimmedRef);
  const valueError = (f: ConfigFieldDef) => {
    const v = (values[f.key] ?? "").trim();
    return v ? configValueError(f, v) : null; // blank: Save stays disabled, no message needed
  };
  const canSave =
    trimmedRef !== "" && !duplicate && !saving && fields.length > 0 &&
    fields.every((f) => ((values[f.key] ?? "").trim() !== "" || hasStored(f)) && !valueError(f));

  const handleSave = () => {
    onSave({
      configId: row?.id,
      scope,
      ref: trimmedRef,
      // A blank masked field is left out, so the server keeps its stored value
      values: Object.fromEntries(fields.map((f) => [f.key, (values[f.key] ?? "").trim()] as const).filter(([, v]) => v !== "")),
    }).then(() => onOpenChange(false), () => undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{row ? "Edit" : "Add"} {scopeInfo.label.toLowerCase()} configuration</DialogTitle>
          <DialogDescription>{agent.agentOsName} · {describeConfigFields(fields)}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 py-2">
          {needsRef && (
            <div className="space-y-1">
              <Label className="text-xs">{scopeInfo.refLabel}</Label>
              <Combobox
                value={ref || null}
                onChange={(v) => setRef(v ?? "")}
                loading={!refOptions && !refOptionsQuery.isError}
                disabled={refOptionsQuery.isError}
                placeholder={refOptionsQuery.isError ? `Could not load ${scopeInfo.refLabel.toLowerCase()} list` : `Select ${scopeInfo.refLabel.toLowerCase()}`}
                searchPlaceholder={`Search ${scopeInfo.refLabel.toLowerCase()}s`}
                aria-label={scopeInfo.refLabel}
                options={(refOptions ?? []).map((o) => {
                  const taken = o !== row?.ref && takenRefs.includes(o);
                  return { value: o, label: o, disabled: taken, description: taken ? "Already added" : undefined };
                })}
              />
              {duplicate && <p className="text-xs text-destructive">A configuration for {trimmedRef} already exists.</p>}
            </div>
          )}
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={`${idPrefix}-${f.key}`} className="text-xs">
                {f.name}
                {f.valueType !== "string" && <span className="font-normal text-muted-foreground"> ({configValueTypeLabels[f.valueType]})</span>}
              </Label>
              <div className="relative">
                <Input
                  id={`${idPrefix}-${f.key}`}
                  type={f.masked && !shown[f.key] ? "password" : "text"}
                  inputMode={inputMode(f)}
                  autoComplete={f.masked ? "new-password" : "off"}
                  placeholder={hasStored(f) ? "•••••••• (unchanged; type to replace)" : f.valueType === "ip" ? "e.g. 239.10.0.1" : f.valueType === "storage_gb" ? "e.g. 500" : undefined}
                  className={f.masked ? "pr-9" : undefined}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  aria-invalid={!!valueError(f)}
                />
                {f.masked && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2"
                    onClick={() => toggleShown(f)}
                    disabled={revealing === f.key}
                    aria-label={shown[f.key] ? `Hide ${f.name}` : `Show ${f.name}`}
                    title={shown[f.key] ? `Hide ${f.name}` : `Show ${f.name}`}
                  >
                    {revealing === f.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : shown[f.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
              {valueError(f) && <p className="text-xs text-red-500">{valueError(f)}</p>}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{common.cancel}</Button>
          <Button onClick={handleSave} disabled={!canSave} loading={saving}>{common.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
