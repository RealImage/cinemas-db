// Per-entity form state, fields, validation and API input for the Locations
// create/edit page (src/pages/LocationForm.tsx).
import type { ReactNode } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/credentials-manager/form-controls";
import { LocationMultiPicker, LocationPicker, type PickedLocation } from "./LocationPicker";
import {
  cityLabel, codePrefixError, currencyOptions, reparentCode, suggestCityCode, timezoneLabel,
  type City, type Country, type LocationEntity, type LocationInputMap, type LocationRecordMap, type MetroArea,
  type Province, type ReviewPrefill, type Timezone,
} from "@/data/locationsData";

export type Errors = Record<string, string>;

export interface FieldProps<F> {
  form: F;
  set: (patch: Partial<F>) => void;
  errors: Errors;
  record?: unknown;
}

export interface EntityForm<E extends LocationEntity, F> {
  /** Form state for a new record (optionally prefilled from a Reference sync item) or an existing one. */
  init: (record: LocationRecordMap[E] | undefined, prefill?: ReviewPrefill) => F;
  validate: (form: F) => Errors;
  toInput: (form: F) => LocationInputMap[E];
  Fields: (props: FieldProps<F>) => ReactNode;
  /** A friendly name for the page title. */
  title: (form: F) => string;
}

// ---------------------------------------------------------------------------
// Shared fields
// ---------------------------------------------------------------------------

export const FormField = ({ label, htmlFor, required, error, hint, children, className }: {
  label: string; htmlFor?: string; required?: boolean; error?: string; hint?: ReactNode; children: ReactNode; className?: string;
}) => (
  <div className={`space-y-1.5 ${className ?? ""}`}>
    <Label htmlFor={htmlFor}>{label}{required && <span className="text-red-500"> *</span>}</Label>
    {children}
    {error ? <p className="text-xs text-red-500" role="alert">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
  </div>
);

interface NamedForm {
  name: string;
  alternateName: string;
  localLanguageName: string;
  translations: string[];
  lastRegionalModificationDate: string;
}

type NamedRecord = { name: string; alternateName: string | null; localLanguageName: string | null; translations: string[]; lastRegionalModificationDate: string | null };

const namedInit = (r?: NamedRecord, p?: ReviewPrefill): NamedForm => ({
  name: r?.name ?? String(p?.name ?? ""),
  alternateName: r?.alternateName ?? String(p?.alternateName ?? ""),
  localLanguageName: r?.localLanguageName ?? "",
  translations: r?.translations ?? [],
  lastRegionalModificationDate: r?.lastRegionalModificationDate ?? "",
});

const namedInput = (f: NamedForm) => ({
  name: f.name.trim(),
  alternateName: f.alternateName.trim() || null,
  localLanguageName: f.localLanguageName.trim() || null,
  translations: f.translations,
  lastRegionalModificationDate: f.lastRegionalModificationDate || null,
});

const requireName = (f: { name: string }): Errors => (f.name.trim() ? {} : { name: "Name is required" });

function NameField<F extends { name: string }>({ form, set, errors }: FieldProps<F>) {
  return (
    <FormField label="Name" htmlFor="loc-name" required error={errors.name}>
      <Input id="loc-name" value={form.name} onChange={(e) => set({ name: e.target.value } as Partial<F>)} aria-invalid={!!errors.name} />
    </FormField>
  );
}

function OtherNameFields<F extends NamedForm>({ form, set }: FieldProps<F>) {
  return (
    <>
      <FormField label="Alternate Name" htmlFor="loc-alt">
        <Input id="loc-alt" value={form.alternateName} onChange={(e) => set({ alternateName: e.target.value } as Partial<F>)} />
      </FormField>
      <FormField label="Local Language Name" htmlFor="loc-local">
        <Input id="loc-local" value={form.localLanguageName} onChange={(e) => set({ localLanguageName: e.target.value } as Partial<F>)} />
      </FormField>
      <FormField label="Translations" htmlFor="loc-translations" hint="Press Enter or comma to add each one" className="md:col-span-2">
        <TagInput id="loc-translations" value={form.translations} onChange={(translations) => set({ translations } as Partial<F>)}
          placeholder="Add a Translation" />
      </FormField>
      <FormField label="Last Regional Modification Date" htmlFor="loc-lrmd">
        <Input id="loc-lrmd" type="date" value={form.lastRegionalModificationDate}
          onChange={(e) => set({ lastRegionalModificationDate: e.target.value } as Partial<F>)} />
      </FormField>
    </>
  );
}

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

interface CountryForm extends NamedForm {
  iso2: string;
  iso3: string;
  callingCode: string;
  currencyCode: string | null;
  timezones: PickedLocation[];
}

const currencies = currencyOptions();

const countryForm: EntityForm<"countries", CountryForm> = {
  init: (r?: Country, p?) => ({
    ...namedInit(r, p),
    iso2: r?.iso2 ?? String(p?.iso2 ?? ""),
    iso3: r?.iso3 ?? String(p?.iso3 ?? ""),
    callingCode: r?.callingCode ?? String(p?.callingCode ?? ""),
    currencyCode: r?.currencyCode ?? (p?.currencyCode as string) ?? null,
    timezones: r?.timezones.map((t) => ({ id: t.id, label: t.name })) ?? [],
  }),
  validate: (f) => ({
    ...requireName(f),
    ...(!/^[A-Za-z]{2}$/.test(f.iso2.trim()) ? { iso2: "Enter the 2-letter code, e.g. TR" } : {}),
    ...(!/^[A-Za-z]{3}$/.test(f.iso3.trim()) ? { iso3: "Enter the 3-letter code, e.g. TUR" } : {}),
    ...(f.callingCode.trim() && !/^\+?\d{1,4}$/.test(f.callingCode.trim()) ? { callingCode: "Enter 1–4 digits, e.g. 90" } : {}),
  }),
  toInput: (f) => ({
    ...namedInput(f), iso2: f.iso2.trim().toUpperCase(), iso3: f.iso3.trim().toUpperCase(),
    callingCode: f.callingCode.trim().replace(/^\+/, "") || null, currencyCode: f.currencyCode, timezoneIds: f.timezones.map((t) => t.id),
  }),
  title: (f) => f.name,
  Fields: (props) => {
    const { form, set, errors } = props;
    return (
      <>
        <NameField {...props} />
        <FormField label="Currency" htmlFor="loc-currency">
          <Combobox id="loc-currency" value={form.currencyCode} onChange={(currencyCode) => set({ currencyCode })} options={currencies}
            placeholder="Select a currency" searchPlaceholder="Search currencies" clearable />
        </FormField>
        <FormField label="ISO 3166-2" htmlFor="loc-iso2" required error={errors.iso2}>
          <Input id="loc-iso2" value={form.iso2} maxLength={2} onChange={(e) => set({ iso2: e.target.value.toUpperCase() })} aria-invalid={!!errors.iso2} />
        </FormField>
        <FormField label="ISO 3166-3" htmlFor="loc-iso3" required error={errors.iso3}>
          <Input id="loc-iso3" value={form.iso3} maxLength={3} onChange={(e) => set({ iso3: e.target.value.toUpperCase() })} aria-invalid={!!errors.iso3} />
        </FormField>
        <FormField label="Calling Code" htmlFor="loc-calling" error={errors.callingCode} hint="Shown as +code">
          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">+</span>
            <Input id="loc-calling" value={form.callingCode.replace(/^\+/, "")} className="pl-5" inputMode="numeric"
              onChange={(e) => set({ callingCode: e.target.value })} aria-invalid={!!errors.callingCode} />
          </div>
        </FormField>
        <FormField label="Timezones" htmlFor="loc-timezones" className="md:col-span-2">
          <LocationMultiPicker id="loc-timezones" entity="timezones" value={form.timezones} placeholder="Search for timezones"
            onChange={(timezones) => set({ timezones: timezones.map((t) => ({ id: t.id, label: t.label.replace(/ \(.*\)$/, "") })) })} />
        </FormField>
        <OtherNameFields {...props} />
      </>
    );
  },
};

// ---------------------------------------------------------------------------
// Provinces
// ---------------------------------------------------------------------------

interface ProvinceForm extends NamedForm {
  country: (PickedLocation & { iso2: string }) | null;
  isoCode: string;
  code: string;
}

const provinceForm: EntityForm<"provinces", ProvinceForm> = {
  init: (r?: Province, p?) => ({
    ...namedInit(r, p),
    country: r ? { id: r.countryId, label: `${r.countryName} (${r.countryCode})`, iso2: r.countryCode }
      : (p?.country as ProvinceForm["country"]) ?? null,
    isoCode: r?.isoCode ?? String(p?.isoCode ?? ""),
    code: r?.code ?? "",
  }),
  validate: (f) => {
    const errors: Errors = requireName(f);
    if (!f.country) errors.country = "Country is required";
    if (!f.isoCode.trim()) errors.isoCode = "ISO Code is required";
    else if (f.country) {
      const e = codePrefixError("ISO Code", f.isoCode.trim(), f.country.iso2, "country");
      if (e) errors.isoCode = e;
    }
    return errors;
  },
  toInput: (f) => ({ ...namedInput(f), countryId: f.country!.id, isoCode: f.isoCode.trim().toUpperCase(), code: f.code.trim() || null }),
  title: (f) => f.name,
  Fields: (props) => {
    const { form, set, errors } = props;
    return (
      <>
        <NameField {...props} />
        <FormField label="Country" htmlFor="loc-country" required error={errors.country}>
          <LocationPicker id="loc-country" entity="countries" value={form.country} invalid={!!errors.country}
            placeholder="Search for a country" searchPlaceholder="Search for a country"
            onChange={(v, rec) => {
              const iso2 = (rec as Country | undefined)?.iso2 ?? "";
              // Carry the code over to the new country when it had the old one's prefix
              const moved = form.country ? reparentCode(form.isoCode, form.country.iso2, iso2) : null;
              set({ country: v ? { ...v, iso2 } : null, isoCode: moved ?? (form.isoCode || (iso2 ? `${iso2}-` : "")) });
            }} />
        </FormField>
        <FormField label="ISO Code" htmlFor="loc-isocode" required error={errors.isoCode}
          hint={form.country ? `ISO 3166-2, starting with ${form.country.iso2}-, e.g. ${form.country.iso2}-HR` : "ISO 3166-2, e.g. IN-HR"}>
          <Input id="loc-isocode" value={form.isoCode} onChange={(e) => set({ isoCode: e.target.value.toUpperCase() })} aria-invalid={!!errors.isoCode} />
        </FormField>
        <FormField label="Code" htmlFor="loc-code" hint="Optional internal code">
          <Input id="loc-code" value={form.code} onChange={(e) => set({ code: e.target.value })} />
        </FormField>
        <OtherNameFields {...props} />
      </>
    );
  },
};

// ---------------------------------------------------------------------------
// Cities
// ---------------------------------------------------------------------------

interface CityForm extends NamedForm {
  province: (PickedLocation & { isoCode: string }) | null;
  timezone: PickedLocation | null;
  code: string;
  latitude: string;
  longitude: string;
  /** Set when a province change rewrote the code, to tell the admin. */
  codeNote: string | null;
}

const numberError = (v: string, label: string, min: number, max: number) => {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? null : `${label} must be between ${min} and ${max}`;
};

const cityForm: EntityForm<"cities", CityForm> = {
  init: (r?: City, p?) => ({
    ...namedInit(r, p),
    province: r ? { id: r.provinceId, label: `${r.provinceName}, ${r.countryCode}`, isoCode: r.provinceCode }
      : (p?.province as CityForm["province"]) ?? null,
    timezone: r ? { id: r.timezoneId, label: r.timezoneName } : (p?.timezone as PickedLocation) ?? null,
    code: r?.code ?? String(p?.code ?? ""),
    latitude: r?.latitude != null ? String(r.latitude) : p?.latitude != null ? String(p.latitude) : "",
    longitude: r?.longitude != null ? String(r.longitude) : p?.longitude != null ? String(p.longitude) : "",
    codeNote: null,
  }),
  validate: (f) => {
    const errors: Errors = requireName(f);
    if (!f.province) errors.province = "Province is required";
    if (!f.timezone) errors.timezone = "Timezone is required";
    if (f.code.trim() && f.province) {
      const e = codePrefixError("Code", f.code.trim(), f.province.isoCode, "province");
      if (e) errors.code = e;
    }
    const lat = numberError(f.latitude, "Latitude", -90, 90);
    const lng = numberError(f.longitude, "Longitude", -180, 180);
    if (lat) errors.latitude = lat;
    if (lng) errors.longitude = lng;
    return errors;
  },
  toInput: (f) => ({
    ...namedInput(f), provinceId: f.province!.id, timezoneId: f.timezone!.id, code: f.code.trim().toUpperCase() || null,
    latitude: f.latitude.trim() ? Number(f.latitude) : null, longitude: f.longitude.trim() ? Number(f.longitude) : null,
  }),
  title: (f) => f.name,
  Fields: (props) => {
    const { form, set, errors, record } = props;
    const city = record as City | undefined;
    return (
      <>
        <NameField {...props} />
        <FormField label="Province" htmlFor="loc-province" required error={errors.province}>
          <LocationPicker id="loc-province" entity="provinces" value={form.province} invalid={!!errors.province}
            placeholder="Search for a province" searchPlaceholder="Search for a province"
            onChange={(v, rec) => {
              const isoCode = (rec as Province | undefined)?.isoCode ?? "";
              const moved = form.province ? reparentCode(form.code, form.province.isoCode, isoCode) : null;
              set({
                province: v ? { ...v, isoCode } : null,
                ...(moved && moved !== form.code ? { code: moved, codeNote: `Code updated to ${moved} to match the new province` } : { codeNote: null }),
              });
            }} />
        </FormField>
        <FormField label="Timezone" htmlFor="loc-timezone" required error={errors.timezone}>
          <LocationPicker id="loc-timezone" entity="timezones" value={form.timezone} invalid={!!errors.timezone}
            placeholder="Select a timezone" searchPlaceholder="Search timezones, e.g. Kolkata"
            onChange={(v, rec) => set({ timezone: v && rec ? { id: v.id, label: timezoneLabel(rec as Timezone) } : null })} />
        </FormField>
        <FormField label="Code" htmlFor="loc-code" error={errors.code}
          hint={form.codeNote ?? (form.province ? `Starts with ${form.province.isoCode}-, e.g. ${suggestCityCode(form.name || "Chennai", form.province.isoCode)}` : "Pick a province first")}>
          <div className="flex gap-2">
            <Input id="loc-code" value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase(), codeNote: null })} aria-invalid={!!errors.code} />
            <Button type="button" variant="outline" size="icon" disabled={!form.province || !form.name.trim()} title="Suggest a code"
              aria-label="Suggest a code" onClick={() => form.province && set({ code: suggestCityCode(form.name, form.province.isoCode), codeNote: null })}>
              <Wand2 className="h-4 w-4" />
            </Button>
          </div>
        </FormField>
        <FormField label="Metro Area" hint="Set from the Metro Area form">
          <Input value={city?.metroAreaName ?? "—"} disabled readOnly />
        </FormField>
        <FormField label="Latitude" htmlFor="loc-lat" error={errors.latitude}>
          <Input id="loc-lat" inputMode="decimal" value={form.latitude} onChange={(e) => set({ latitude: e.target.value })} aria-invalid={!!errors.latitude} />
        </FormField>
        <FormField label="Longitude" htmlFor="loc-lng" error={errors.longitude}>
          <Input id="loc-lng" inputMode="decimal" value={form.longitude} onChange={(e) => set({ longitude: e.target.value })} aria-invalid={!!errors.longitude} />
        </FormField>
        <OtherNameFields {...props} />
      </>
    );
  },
};

// ---------------------------------------------------------------------------
// Metro areas
// ---------------------------------------------------------------------------

interface MetroAreaForm {
  name: string;
  cities: PickedLocation[];
}

const metroAreaForm: EntityForm<"metro_areas", MetroAreaForm> = {
  init: (r?: MetroArea) => ({ name: r?.name ?? "", cities: r?.cities.map((c) => ({ id: c.id, label: cityLabel(c) })) ?? [] }),
  validate: (f) => ({ ...requireName(f), ...(f.cities.length ? {} : { cities: "Add at least one city" }) }),
  toInput: (f) => ({ name: f.name.trim(), cityIds: f.cities.map((c) => c.id) }),
  title: (f) => f.name,
  Fields: (props) => (
    <>
      <NameField {...props} />
      <FormField label="Cities" htmlFor="loc-cities" required error={props.errors.cities} className="md:col-span-2"
        hint="A city belongs to one metro area; adding it here moves it from any other">
        <LocationMultiPicker id="loc-cities" entity="cities" value={props.form.cities} invalid={!!props.errors.cities}
          placeholder="Search for cities" onChange={(cities) => props.set({ cities })} />
      </FormField>
    </>
  ),
};

// ---------------------------------------------------------------------------
// Timezones
// ---------------------------------------------------------------------------

interface TimezoneForm {
  name: string;
  displayName: string;
  isActive: boolean;
  popularCities: PickedLocation[];
}

const timezoneForm: EntityForm<"timezones", TimezoneForm> = {
  init: (r?: Timezone) => ({
    name: r?.name ?? "", displayName: r?.displayName ?? "", isActive: r?.isActive ?? true,
    popularCities: r?.popularCities.map((c) => ({ id: c.id, label: cityLabel(c) })) ?? [],
  }),
  validate: () => ({}),
  toInput: (f) => ({ displayName: f.displayName.trim() || null, isActive: f.isActive, popularCityIds: f.popularCities.map((c) => c.id) }),
  title: (f) => f.name,
  Fields: ({ form, set, record }) => {
    const tz = record as Timezone | undefined;
    return (
      <>
        <FormField label="Name" hint="IANA ID; set by the IANA database">
          <Input value={form.name} disabled readOnly />
        </FormField>
        <FormField label="Display Name" htmlFor="loc-display">
          <Input id="loc-display" value={form.displayName} onChange={(e) => set({ displayName: e.target.value })} placeholder="e.g. Turkey Time" />
        </FormField>
        <FormField label="UTC offset" hint="Standard offset, derived from the IANA ID">
          <Input value={tz?.utcOffset ?? "—"} disabled readOnly />
        </FormField>
        <FormField label="DST offset" hint="During daylight saving time; — when the zone has none">
          <Input value={tz?.dstOffset ?? "—"} disabled readOnly />
        </FormField>
        <FormField label="Popular Cities" htmlFor="loc-popular" className="md:col-span-2">
          <LocationMultiPicker id="loc-popular" entity="cities" value={form.popularCities} placeholder="Search for cities"
            onChange={(popularCities) => set({ popularCities })} />
        </FormField>
        <div className="flex items-center gap-2">
          <Checkbox id="loc-active" checked={form.isActive} onCheckedChange={(v) => set({ isActive: v === true })} />
          <Label htmlFor="loc-active" className="font-normal">Is Active</Label>
          <span className="text-xs text-muted-foreground">Inactive zones stay in the list but can't be picked for a city</span>
        </div>
      </>
    );
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const entityForms: { [E in LocationEntity]: EntityForm<E, any> } = {
  countries: countryForm,
  provinces: provinceForm,
  cities: cityForm,
  metro_areas: metroAreaForm,
  timezones: timezoneForm,
};
