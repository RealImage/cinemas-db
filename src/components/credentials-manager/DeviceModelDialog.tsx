import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CredentialDevice,
  CredentialDeviceInput,
  CredentialFieldDef,
  CredentialValueType,
  DEFAULT_CREDENTIAL_FIELDS,
  DeviceType,
  deviceRoles,
  deviceTypes,
  looksSecret,
  nonDciTypes,
} from "@/data/credentialsManagerData";
import { RoleMultiSelect, TagInput } from "./form-controls";
import { Combobox } from "@/components/ui/combobox";
import { common } from "@/i18n/common";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** The model to edit; null to add a new one. */
  device: CredentialDevice | null;
  /** Resolves when saved (the dialog then closes); rejects to keep it open. */
  onSave: (input: CredentialDeviceInput) => Promise<unknown>;
  saving?: boolean;
}

/**
 * A field row in the editor; `key` is empty for rows added in this session.
 * `maskedSet` is true once Masked was set by hand, so naming a new field
 * "Password" no longer changes it.
 */
type FieldRow = CredentialFieldDef & { rowId: string; maskedSet?: boolean };

type Form = Omit<CredentialDeviceInput, "type" | "credentialFields"> & {
  type: DeviceType | "";
  isDci: boolean;
  fields: FieldRow[];
};

let rowSeq = 0;
const toRow = (f: CredentialFieldDef): FieldRow => ({ ...f, rowId: `row-${++rowSeq}`, maskedSet: !!f.key });

const emptyForm = (): Form => ({
  brand: "",
  model: "",
  primaryRole: null,
  certificateRoles: [],
  additionalRoles: [],
  type: "",
  dci: "false",
  isDci: false,
  translations: [],
  serialNumberRequired: false,
  fields: DEFAULT_CREDENTIAL_FIELDS.map(toRow),
});

const fromDevice = (d: CredentialDevice): Form => ({
  brand: d.brand,
  model: d.model,
  primaryRole: d.primaryRole,
  certificateRoles: d.certificateRoles,
  additionalRoles: d.additionalRoles,
  type: d.type,
  dci: d.dci,
  isDci: d.dci === "true",
  translations: d.translations,
  serialNumberRequired: d.serialNumberRequired,
  fields: d.credentialFields.map(toRow),
});

const Required = () => <span className="text-red-500" aria-hidden> *</span>;

export const DeviceModelDialog = ({ open, onOpenChange, device, onSave, saving = false }: Props) => {
  const [form, setForm] = useState<Form>(emptyForm);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(device ? fromDevice(device) : emptyForm());
    setSubmitted(false);
  }, [open, device]);

  const upd = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const updField = (rowId: string, patch: Partial<FieldRow>) =>
    upd({ fields: form.fields.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)) });

  // Validation
  const fieldNames = form.fields.map((f) => f.name.trim().toLowerCase());
  const fieldError = (row: FieldRow, i: number) =>
    !row.name.trim() ? "Name is required" : fieldNames.indexOf(row.name.trim().toLowerCase()) !== i ? "Name is used twice" : null;
  const errors = {
    brand: !form.brand.trim() ? "Brand is required" : null,
    model: !form.model.trim() ? "Model is required" : null,
    type: !form.type ? "Type is required" : null,
    fields: form.fields.length === 0 ? "Add at least one credential field" : form.fields.some((r, i) => fieldError(r, i)) ? "Fix the credential fields" : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (msg: string | null) => submitted && msg ? <p className="text-xs text-red-500">{msg}</p> : null;

  const fieldsChanged =
    !!device &&
    JSON.stringify(device.credentialFields.map((f) => [f.key, f.name, f.valueType, f.masked])) !==
      JSON.stringify(form.fields.map((f) => [f.key, f.name.trim(), f.valueType, f.masked]));
  const maskingChanged =
    !!device && form.fields.some((f) => device.credentialFields.some((d) => d.key === f.key && d.masked !== f.masked));

  const handleSave = () => {
    setSubmitted(true);
    if (!valid || !form.type) return;
    const type = form.type;
    // "Is DCI" unchecked stores NA for types DCI doesn't apply to
    const dci = form.isDci ? "true" : nonDciTypes.includes(type) ? "NA" : "false";
    onSave({
      brand: form.brand.trim(),
      model: form.model.trim(),
      primaryRole: form.primaryRole,
      certificateRoles: form.certificateRoles,
      additionalRoles: form.additionalRoles,
      type,
      dci,
      translations: form.translations,
      serialNumberRequired: form.serialNumberRequired,
      credentialFields: form.fields.map(({ key, name, valueType, masked }) => ({ key, name: name.trim(), valueType, masked })),
    }).then(() => onOpenChange(false), () => undefined);
  };

  const coveredRoles = [form.primaryRole, ...form.certificateRoles].filter((r): r is string => !!r);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>{device ? `Edit device model — ${device.brand} ${device.model}` : "Add device model"}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto px-5 py-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="dm-brand" className="text-xs">Brand<Required /></Label>
            <Input id="dm-brand" value={form.brand} onChange={(e) => upd({ brand: e.target.value })} placeholder="e.g. Barco" aria-invalid={submitted && !!errors.brand} />
            {show(errors.brand)}
          </div>
          <div className="space-y-1">
            <Label htmlFor="dm-model" className="text-xs">Model<Required /></Label>
            <Input id="dm-model" value={form.model} onChange={(e) => upd({ model: e.target.value })} placeholder="e.g. ICMP" aria-invalid={submitted && !!errors.model} />
            {show(errors.model)}
          </div>

          <div className="space-y-1">
            <Label htmlFor="dm-role" className="text-xs">Role</Label>
            <Combobox
              id="dm-role"
              value={form.primaryRole}
              onChange={(v) => upd({ primaryRole: v })}
              clearable
              placeholder="None"
              searchPlaceholder="Search roles by code or name"
              options={deviceRoles.map((r) => ({ value: r.code, label: r.code, description: r.description }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dm-type" className="text-xs">Type<Required /></Label>
            <Combobox
              id="dm-type"
              value={form.type || null}
              onChange={(v) => upd({ type: (v ?? "") as DeviceType | "" })}
              placeholder="Select type"
              searchPlaceholder="Search types"
              aria-invalid={submitted && !!errors.type}
              options={deviceTypes.map((t) => ({ value: t, label: t }))}
            />
            {show(errors.type)}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.isDci} onCheckedChange={(c) => upd({ isDci: c === true })} />
            Is DCI
          </label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" checked={form.serialNumberRequired} onCheckedChange={(c) => upd({ serialNumberRequired: c === true })} />
            <span>
              Serial numbers
              <span className="block text-xs text-muted-foreground">Devices with this model are expected to have a serial number</span>
            </span>
          </label>

          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="dm-translations" className="text-xs">Translations</Label>
            <TagInput id="dm-translations" value={form.translations} onChange={(translations) => upd({ translations })} placeholder="Alternate names, e.g. ICMP-X — press Enter to add" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="dm-cert-roles" className="text-xs">Roles from certificates</Label>
            <TagInput id="dm-cert-roles" uppercase value={form.certificateRoles} onChange={(certificateRoles) => upd({ certificateRoles })} placeholder="Role codes in the device certificate, e.g. SM, PR" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="dm-additional-roles" className="text-xs">Additional roles</Label>
            <RoleMultiSelect
              id="dm-additional-roles"
              value={form.additionalRoles.filter((r) => !coveredRoles.includes(r))}
              exclude={coveredRoles}
              onChange={(additionalRoles) => upd({ additionalRoles })}
            />
          </div>

          <fieldset className="space-y-2 md:col-span-2">
            <legend className="mb-1 text-xs font-medium">Credentials format<Required /></legend>
            <div className="grid grid-cols-[1fr_9rem_4rem_2.125rem] items-center gap-2 text-xs text-muted-foreground">
              <span>Credential name</span>
              <span>Value type</span>
              <span className="text-center" title="Masked values are stored encrypted and hidden until someone clicks View">Masked</span>
              <span className="sr-only">Remove</span>
            </div>
            {form.fields.map((row, i) => (
              <div key={row.rowId} className="space-y-1">
                <div className="grid grid-cols-[1fr_9rem_4rem_2.125rem] items-center gap-2">
                  <Input
                    aria-label={`Credential name ${i + 1}`}
                    value={row.name}
                    onChange={(e) =>
                      updField(row.rowId, {
                        name: e.target.value,
                        // Suggest Masked for new fields named like a secret, until it's set by hand
                        ...(!row.maskedSet && { masked: looksSecret(e.target.value) }),
                      })}
                    placeholder="e.g. Username, Site ID, PIN"
                    aria-invalid={submitted && !!fieldError(row, i)}
                  />
                  <Select value={row.valueType} onValueChange={(v: CredentialValueType) => updField(row.rowId, { valueType: v })}>
                    <SelectTrigger aria-label={`Value type ${i + 1}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="numeric">Numeric</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex justify-center">
                    <Checkbox
                      checked={row.masked}
                      onCheckedChange={(c) => updField(row.rowId, { masked: c === true, maskedSet: true })}
                      aria-label={`Masked ${row.name || `field ${i + 1}`}`}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${row.name || `field ${i + 1}`}`}
                    onClick={() => upd({ fields: form.fields.filter((r) => r.rowId !== row.rowId) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {show(fieldError(row, i))}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => upd({ fields: [...form.fields, toRow({ key: "", name: "", valueType: "string", masked: false })] })}>
              <Plus className="h-4 w-4" /> Add credential field
            </Button>
            {show(errors.fields === "Add at least one credential field" ? errors.fields : null)}
            {fieldsChanged && (
              <p className="text-xs text-muted-foreground">
                Existing credentials keep their stored values. New fields stay blank until each credential is edited.
                {maskingChanged && " Stored values of fields whose Masked setting changed are encrypted or decrypted when you save."}
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
