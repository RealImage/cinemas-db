import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocationPicker } from "@/components/locations/LocationPicker";
import type { CallingCode, ChainDetailsInput, ChainOwner, ChainPhone } from "@/data/chainDetails";

// The Basic and Contact Information tabs of the Edit Chain page. The page owns the form state and its one
// Save / Cancel; these render the fields and their inline errors (keys as in chainFormErrors).

export type ChainForm = ChainDetailsInput & { cityLabel: string | null };

interface SectionProps {
  form: ChainForm;
  onChange: (patch: Partial<ChainForm>) => void;
  errors: Record<string, string>;
}

const Required = () => <span className="text-red-500" aria-hidden> *</span>;

/** aria-invalid / aria-describedby for field `key`, pointing at its FieldError. */
const invalidProps = (errors: Record<string, string>, key: string) =>
  errors[key] ? { "aria-invalid": true, "aria-describedby": `chain-err-${key}` } : {};

const FieldError = ({ errors, name }: { errors: Record<string, string>; name: string }) =>
  errors[name] ? <p id={`chain-err-${name}`} className="text-xs text-red-500">{errors[name]}</p> : null;

export function ChainBasicInformation({ form, onChange, errors, companyName }: SectionProps & { companyName: string }) {
  return (
    <Card className="p-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="chain-name">Chain Name<Required /></Label>
          <Input id="chain-name" value={form.name} onChange={(e) => onChange({ name: e.target.value })} required {...invalidProps(errors, "name")} />
          <FieldError errors={errors} name="name" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="chain-display-name">Display Name</Label>
          <Input id="chain-display-name" value={form.displayName} onChange={(e) => onChange({ displayName: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="chain-company">Company</Label>
          <Input id="chain-company" value={companyName || "—"} readOnly disabled />
        </div>
        <div className="space-y-1">
          <Label htmlFor="chain-city">City<Required /></Label>
          <LocationPicker
            id="chain-city"
            entity="cities"
            value={form.cityId ? { id: form.cityId, label: form.cityLabel ?? form.cityId } : null}
            onChange={(picked, record) => {
              const city = record as { name: string; provinceName: string; countryName: string } | undefined;
              onChange({
                cityId: picked?.id ?? null,
                cityLabel: city ? `${city.name}, ${city.provinceName}, ${city.countryName}` : picked?.label ?? null,
              });
            }}
            placeholder="Search for a city"
            searchPlaceholder="Search for a city"
            aria-label="City"
            invalid={!!errors.cityId}
            aria-describedby={errors.cityId ? "chain-err-cityId" : undefined}
          />
          <FieldError errors={errors} name="cityId" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="chain-postal-code">Postal Code</Label>
          <Input id="chain-postal-code" value={form.postalCode} onChange={(e) => onChange({ postalCode: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="chain-area">Area</Label>
          <Input id="chain-area" value={form.area} onChange={(e) => onChange({ area: e.target.value })} />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="chain-address">Address (Head Office)</Label>
          <Textarea id="chain-address" rows={3} value={form.headOfficeAddress} onChange={(e) => onChange({ headOfficeAddress: e.target.value })} />
        </div>
      </div>
    </Card>
  );
}

/** A labelled list of rows with Add / Remove; `render` draws row i's inputs. */
function RowList<T>({ title, rows, empty, addLabel, onChange, render }: {
  title: string;
  rows: T[];
  empty: T;
  addLabel: string;
  onChange: (rows: T[]) => void;
  render: (row: T, i: number, set: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{title}</legend>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">None added</p>}
      {rows.map((row, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
            {render(row, i, (patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))))}
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-[2.125rem] w-[2.125rem] shrink-0"
            aria-label={`Remove ${title.replace(/\(s\)$/, "").toLowerCase()} ${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, empty])}>
        <Plus className="mr-1 h-3.5 w-3.5" /> {addLabel}
      </Button>
    </fieldset>
  );
}

export function ChainContactInformation({ form, onChange, errors, callingCodes }: SectionProps & { callingCodes: CallingCode[] | undefined }) {
  const codeOptions: ComboboxOption[] = (callingCodes ?? []).map((c) => ({ value: c.code, label: `+${c.code}`, description: c.countries.join(", ") }));
  const codeField = (key: string, value: string, set: (v: string) => void, label: string) => (
    <div className="w-28 shrink-0 space-y-1">
      <Combobox value={value.replace(/^\+/, "") || null} onChange={(v) => set(v ?? "")} options={codeOptions}
        loading={!callingCodes} placeholder="Code" searchPlaceholder="Code or country" aria-label={label}
        aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `chain-err-${key}` : undefined} />
      <FieldError errors={errors} name={key} />
    </div>
  );
  return (
    <Card className="space-y-6 p-5">
      <RowList<string>
        title="Official Email(s)" rows={form.emails} empty="" addLabel="Add email"
        onChange={(emails) => onChange({ emails })}
        render={(email, i) => (
          <div className="min-w-[14rem] flex-1 space-y-1">
            <Input type="email" value={email} aria-label={`Official email ${i + 1}`} placeholder="name@example.com"
              onChange={(e) => onChange({ emails: form.emails.map((x, j) => (j === i ? e.target.value : x)) })}
              {...invalidProps(errors, `emails.${i}`)} />
            <FieldError errors={errors} name={`emails.${i}`} />
          </div>
        )}
      />
      <RowList<ChainPhone>
        title="Registered Phone Number(s)" rows={form.phones} empty={{ countryCode: "", number: "" }} addLabel="Add phone number"
        onChange={(phones) => onChange({ phones })}
        render={(phone, i, set) => (
          <>
            {codeField(`phones.${i}.countryCode`, phone.countryCode, (countryCode) => set({ countryCode }), `Phone ${i + 1} country code`)}
            <div className="min-w-[12rem] flex-1 space-y-1">
              <Input type="tel" value={phone.number} aria-label={`Phone ${i + 1} number`} placeholder="Phone number"
                onChange={(e) => set({ number: e.target.value })} {...invalidProps(errors, `phones.${i}.number`)} />
              <FieldError errors={errors} name={`phones.${i}.number`} />
            </div>
          </>
        )}
      />
      <RowList<ChainOwner>
        title="Owner(s)" rows={form.owners} empty={{ name: "", countryCode: "", phone: "" }} addLabel="Add owner"
        onChange={(owners) => onChange({ owners })}
        render={(owner, i, set) => (
          <>
            <div className="min-w-[12rem] flex-1 space-y-1">
              <Input value={owner.name} aria-label={`Owner ${i + 1} name`} placeholder="Owner name"
                onChange={(e) => set({ name: e.target.value })} {...invalidProps(errors, `owners.${i}.name`)} />
              <FieldError errors={errors} name={`owners.${i}.name`} />
            </div>
            {codeField(`owners.${i}.countryCode`, owner.countryCode, (countryCode) => set({ countryCode }), `Owner ${i + 1} country code`)}
            <div className="min-w-[10rem] flex-1 space-y-1">
              <Input type="tel" value={owner.phone} aria-label={`Owner ${i + 1} phone`} placeholder="Phone number"
                onChange={(e) => set({ phone: e.target.value })} {...invalidProps(errors, `owners.${i}.phone`)} />
              <FieldError errors={errors} name={`owners.${i}.phone`} />
            </div>
          </>
        )}
      />
    </Card>
  );
}
