import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  CredentialDevice,
  CredentialValues,
  CredentialScope,
  GLOBAL_REF,
  ScopedCredential,
  countryOptions,
  credentialScopes,
  describeCredentialFields,
  isNumericValue,
} from "@/data/credentialsManagerData";
import { revealCredentialValue, useCredentialRefOptions } from "@/hooks/api/credentials";
import { common } from "@/i18n/common";

export type CredentialDraft = Omit<ScopedCredential, "id" | "updatedBy" | "updatedAt" | "maskedKeys"> & { id?: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  device: CredentialDevice;
  scope: CredentialScope;
  /** Existing row to edit; null to add a new one. */
  credential: ScopedCredential | null;
  /** Refs already used in this scope, to prevent duplicates. */
  takenRefs: string[];
  /** Resolves when saved (the dialog then closes); rejects to keep it open. */
  onSave: (draft: CredentialDraft) => Promise<unknown>;
  saving?: boolean;
}

const globalRefOptions = [GLOBAL_REF, ...countryOptions];

export const EditScopedCredentialDialog = ({ open, onOpenChange, device, scope, credential, takenRefs, onSave, saving = false }: Props) => {
  const needsRefOptions = scope === "chain" || scope === "theatre";
  const refOptionsQuery = useCredentialRefOptions(open && needsRefOptions);
  const [ref, setRef] = useState("");
  const [location, setLocation] = useState("");
  const [values, setValues] = useState<CredentialValues>({});
  /** Masked fields currently shown as plain text. */
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [revealing, setRevealing] = useState<string | null>(null);
  /** Stored values loaded by the eye icon, so hiding one again can discard it. */
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  /** Bumped whenever the dialog opens, closes or switches credential; a reveal from an older session is dropped. */
  const session = useRef(0);

  useEffect(() => {
    session.current++;
    setRevealing(null);
    if (!open) return;
    setRef(credential?.ref ?? "");
    setLocation(credential?.location ?? "");
    // Masked values aren't loaded; leaving one blank keeps the stored value
    setValues(credential?.values ?? {});
    setShown({});
    setRevealed({});
  }, [open, credential]);

  const scopeInfo = credentialScopes.find((s) => s.id === scope)!;
  const fields = device.credentialFields;
  const loadedOptions =
    scope === "global" ? globalRefOptions
    : scope === "chain" ? refOptionsQuery.data?.chains
    : scope === "theatre" ? refOptionsQuery.data?.theatres
    : undefined;
  // Keep the row's current ref selectable even if it's no longer in the list.
  const options = loadedOptions && credential?.ref && !loadedOptions.includes(credential.ref)
    ? [credential.ref, ...loadedOptions]
    : loadedOptions;
  const optionsLoading = needsRefOptions && !loadedOptions;
  const trimmedRef = ref.trim();
  const duplicate = trimmedRef !== "" && trimmedRef !== credential?.ref && takenRefs.includes(trimmedRef);
  /** A masked field of an existing credential that already has a stored value. */
  const hasStored = (f: (typeof fields)[number]) => f.masked && !!credential?.maskedKeys.includes(f.key);
  const toggleShown = (f: (typeof fields)[number]) => {
    if (shown[f.key]) {
      setShown((s) => ({ ...s, [f.key]: false }));
      // Hiding an untouched revealed value discards it (the stored value is kept on save)
      if (f.key in revealed && values[f.key] === revealed[f.key]) {
        setValues((vals) => ({ ...vals, [f.key]: "" }));
        setRevealed(({ [f.key]: _drop, ...rest }) => rest);
      }
      return;
    }
    // Showing a blank field that has a stored value loads it for editing
    if (!(values[f.key] ?? "") && hasStored(f) && credential) {
      setRevealing(f.key);
      const started = session.current;
      revealCredentialValue(device.id, credential.id, f.key)
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
  const valueError = (f: (typeof fields)[number]) => {
    const v = (values[f.key] ?? "").trim();
    if (!v) return null; // blank: Save stays disabled, no message needed
    return f.valueType === "numeric" && !isNumericValue(v) ? `${f.name} must be a number` : null;
  };
  const canSave =
    trimmedRef !== "" && !duplicate && !saving && fields.length > 0 &&
    fields.every((f) => (!f.mandatory || (values[f.key] ?? "").trim() !== "" || hasStored(f)) && !valueError(f)) &&
    fields.some((f) => (values[f.key] ?? "").trim() !== "" || hasStored(f));

  const handleSave = () => {
    onSave({
      id: credential?.id,
      deviceId: device.id,
      scope,
      ref: trimmedRef,
      location: scope === "device" ? location.trim() || undefined : undefined,
      // A blank masked field is left out, so the server keeps its stored value
      values: Object.fromEntries(
        fields.map((f) => [f.key, (values[f.key] ?? "").trim()] as const).filter(([, v]) => v !== ""),
      ),
    }).then(() => onOpenChange(false), () => {});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{credential ? "Edit" : "Add"} {scopeInfo.label.replace(" Credentials", "").toLowerCase()} credentials</DialogTitle>
          <DialogDescription>
            {device.brand} {device.model} · {describeCredentialFields(device.credentialFields)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs">{scopeInfo.refLabel}</Label>
            {options || optionsLoading ? (
              <Combobox
                value={ref || null}
                onChange={(v) => setRef(v ?? "")}
                loading={optionsLoading && !refOptionsQuery.isError}
                disabled={refOptionsQuery.isError}
                placeholder={refOptionsQuery.isError ? `Could not load ${scopeInfo.refLabel.toLowerCase()} list` : `Select ${scopeInfo.refLabel.toLowerCase()}`}
                searchPlaceholder={`Search ${scopeInfo.refLabel.toLowerCase()}s`}
                aria-label={scopeInfo.refLabel}
                options={(options ?? []).map((o) => ({
                  value: o,
                  label: o,
                  disabled: o !== credential?.ref && takenRefs.includes(o),
                  description: o !== credential?.ref && takenRefs.includes(o) ? "Already added" : undefined,
                }))}
              />
            ) : (
              <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. ICMP-12345" />
            )}
            {duplicate && <p className="text-xs text-destructive">Credentials for {trimmedRef} already exist.</p>}
          </div>
          {scope === "device" && (
            <div className="space-y-1">
              <Label className="text-xs">Installed At</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional, e.g. AMC Lincoln Square · Audi 3" />
            </div>
          )}
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              This device model has no credentials format yet. Add credential fields to the device model first.
            </p>
          )}
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={`cred-${f.key}`} className="text-xs">
                {f.name}
                {f.mandatory && <span className="text-red-500" aria-hidden="true"> *</span>}
                {f.valueType === "numeric" && <span className="font-normal text-muted-foreground"> (numeric)</span>}
                {!f.mandatory && <span className="font-normal text-muted-foreground"> (optional)</span>}
              </Label>
              <div className="relative">
                <Input
                  id={`cred-${f.key}`}
                  required={f.mandatory}
                  aria-required={f.mandatory}
                  type={f.masked && !shown[f.key] ? "password" : "text"}
                  inputMode={f.valueType === "numeric" ? "decimal" : undefined}
                  autoComplete={f.masked ? "new-password" : "off"}
                  placeholder={hasStored(f) ? "•••••••• (unchanged; type to replace)" : undefined}
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
