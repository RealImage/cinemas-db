// Locations: the geographic master data (countries, provinces, cities, metro
// areas, timezones) theatres reference, and the Reference sync review queue.
// Shared by the UI and the API (server/routes/locations.ts).

export const LOCATIONS_PATH = "/locations";

export const locationEntities = [
  { id: "countries", label: "Countries", singular: "Country" },
  { id: "provinces", label: "Provinces", singular: "Province" },
  { id: "cities", label: "Cities", singular: "City" },
  { id: "metro_areas", label: "Metro Areas", singular: "Metro Area" },
  { id: "timezones", label: "Timezones", singular: "Timezone" },
] as const;
export type LocationEntity = (typeof locationEntities)[number]["id"];

export const isLocationEntity = (v: string): v is LocationEntity => locationEntities.some((e) => e.id === v);
export const entityInfo = (entity: LocationEntity) => locationEntities.find((e) => e.id === entity)!;

/** URL segment for an entity ("metro_areas" → "metro-areas"). */
export const entitySlug = (entity: LocationEntity) => entity.replace("_", "-");
export const entityFromSlug = (slug: string | undefined) => {
  const entity = slug?.replace("-", "_") ?? "";
  return isLocationEntity(entity) ? entity : null;
};
export const locationListPath = (entity: LocationEntity) => `${LOCATIONS_PATH}/${entitySlug(entity)}`;
export const locationEditPath = (entity: LocationEntity, id: string) => `${locationListPath(entity)}/${id}/edit`;
export const locationNewPath = (entity: LocationEntity, reviewItemId?: number) =>
  `${locationListPath(entity)}/new${reviewItemId ? `?reviewItem=${reviewItemId}` : ""}`;
export const locationLogsPath = (entity: LocationEntity, id: string) => `${locationListPath(entity)}/${id}/logs`;
export const LOCATION_REVIEW_PATH = `${LOCATIONS_PATH}/review`;

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

interface Audited {
  id: string;
  isDeleted: boolean;
  updatedBy: string;
  updatedAt: string;
  /** Open Reference sync review items for this record. */
  reviewCount: number;
}

interface Named {
  name: string;
  alternateName: string | null;
  localLanguageName: string | null;
  translations: string[];
  lastRegionalModificationDate: string | null;
}

export interface LocationRef {
  id: string;
  name: string;
}

export interface Country extends Audited, Named {
  iso2: string;
  iso3: string;
  callingCode: string | null;
  currencyCode: string | null;
  timezones: LocationRef[];
  geonameId: number | null;
  provinceCount: number;
}

export interface Province extends Audited, Named {
  countryId: string;
  countryName: string;
  countryCode: string;
  isoCode: string;
  code: string | null;
  geonameId: number | null;
  geonameKey: string | null;
  cityCount: number;
}

export interface City extends Audited, Named {
  provinceId: string;
  provinceName: string;
  provinceCode: string;
  countryId: string;
  countryName: string;
  countryCode: string;
  timezoneId: string;
  timezoneName: string;
  metroAreaId: string | null;
  metroAreaName: string | null;
  code: string | null;
  latitude: number | null;
  longitude: number | null;
  population: number | null;
  geonameId: number | null;
  theatreCount: number;
}

/** A city as shown in pickers and lists: "Chennai, Tamil Nadu, IN". */
export interface CityRef extends LocationRef {
  provinceName: string;
  countryCode: string;
}
export const cityLabel = (c: Pick<CityRef, "name" | "provinceName" | "countryCode">) =>
  `${c.name}, ${c.provinceName}, ${c.countryCode}`;

export interface MetroArea extends Audited {
  name: string;
  cities: CityRef[];
  cityCount: number;
}

export interface Timezone extends Omit<Audited, "isDeleted"> {
  name: string;
  displayName: string | null;
  /** Standard offset, derived from the IANA ID, e.g. "+05:30". */
  utcOffset: string | null;
  /** Offset during daylight saving time, or null when the zone has none. */
  dstOffset: string | null;
  isActive: boolean;
  popularCities: CityRef[];
  cityCount: number;
}

export type LocationRecord = Country | Province | City | MetroArea | Timezone;

export interface LocationRecordMap {
  countries: Country;
  provinces: Province;
  cities: City;
  metro_areas: MetroArea;
  timezones: Timezone;
}

// ---------------------------------------------------------------------------
// Inputs (create / update bodies)
// ---------------------------------------------------------------------------

type NamedInput = Pick<Named, "name" | "alternateName" | "localLanguageName" | "translations" | "lastRegionalModificationDate">;

export interface CountryInput extends NamedInput {
  iso2: string;
  iso3: string;
  callingCode: string | null;
  currencyCode: string | null;
  timezoneIds: string[];
}
export interface ProvinceInput extends NamedInput {
  countryId: string;
  isoCode: string;
  code: string | null;
}
export interface CityInput extends NamedInput {
  provinceId: string;
  timezoneId: string;
  code: string | null;
  latitude: number | null;
  longitude: number | null;
}
export interface MetroAreaInput {
  name: string;
  cityIds: string[];
}
export interface TimezoneInput {
  displayName: string | null;
  isActive: boolean;
  popularCityIds: string[];
}

export interface LocationInputMap {
  countries: CountryInput;
  provinces: ProvinceInput;
  cities: CityInput;
  metro_areas: MetroAreaInput;
  timezones: TimezoneInput;
}

/** Create/update bodies may carry the review item the change resolves (Add, or Link or fix via the form). */
export type WithReviewItem<T> = T & { reviewItemId?: number };

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export interface LocationListParams {
  search?: string;
  sort?: string;
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
  needsReview?: boolean;
  /** Restrict to children of a record, e.g. provinces of one country. */
  countryId?: string;
  provinceId?: string;
}

export interface LocationPage<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const LOCATION_PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

export type LocationLogAction = "CREATE" | "UPDATE" | "DEACTIVATE" | "RESTORE" | "LINK" | "IGNORE";

export interface LocationLogEntry {
  id: number;
  entity: LocationEntity;
  recordId: string | null;
  action: LocationLogAction;
  updatedBy: string;
  createdAt: string;
  current: Record<string, unknown> | null;
  previous: Record<string, unknown> | null;
  source: ReferenceSource | null;
  sourceRef: string | null;
}

// ---------------------------------------------------------------------------
// Validation shared by the forms and the API
// ---------------------------------------------------------------------------

/** Why `code` doesn't belong to its parent (e.g. a city code under another province), or null. */
export function codePrefixError(what: string, code: string, parentCode: string, parentLabel: string): string | null {
  return code.toUpperCase().startsWith(`${parentCode.toUpperCase()}-`)
    ? null
    : `${what} must start with ${parentCode}- (the ${parentLabel}'s code)`;
}

/** A city code suggestion: <province ISO code>-<first 5 distinct letters>, e.g. IN-TN-CHENA. */
export function suggestCityCode(name: string, provinceCode: string) {
  const letters = [...new Set(name.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase())];
  return `${provinceCode}-${(letters.join("") + "XXXXX").slice(0, 5)}`;
}

/** Re-parenting: swap the old parent prefix of a code for the new one, when it had it. */
export function reparentCode(code: string | null, oldPrefix: string | null, newPrefix: string) {
  if (!code || !oldPrefix || !code.toUpperCase().startsWith(`${oldPrefix.toUpperCase()}-`)) return null;
  return `${newPrefix}${code.slice(oldPrefix.length)}`;
}

// ---------------------------------------------------------------------------
// Timezone offsets, derived from the runtime's IANA database
// ---------------------------------------------------------------------------

/** "+05:30" for a zone at `date`, or null for an ID the runtime doesn't know. */
export function zoneOffsetAt(timeZone: string, date: Date): string | null {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value;
    if (!part) return null;
    if (part === "GMT") return "+00:00";
    return part.replace("GMT", "");
  } catch {
    return null;
  }
}

const offsetMinutes = (o: string) => {
  const [, sign, h, m] = /^([+-])(\d{2}):(\d{2})$/.exec(o) ?? [];
  return sign ? (sign === "-" ? -1 : 1) * (Number(h) * 60 + Number(m)) : 0;
};

/** Standard and daylight-saving offsets for this year: the lower and higher of January's and July's. */
export function zoneOffsets(timeZone: string, year = new Date().getUTCFullYear()) {
  const jan = zoneOffsetAt(timeZone, new Date(Date.UTC(year, 0, 15)));
  const jul = zoneOffsetAt(timeZone, new Date(Date.UTC(year, 6, 15)));
  if (!jan || !jul) return { utcOffset: jan ?? jul, dstOffset: null };
  if (jan === jul) return { utcOffset: jan, dstOffset: null };
  const [std, dst] = offsetMinutes(jan) < offsetMinutes(jul) ? [jan, jul] : [jul, jan];
  return { utcOffset: std, dstOffset: dst };
}

export const timezoneLabel = (tz: { name: string; utcOffset: string | null }) =>
  tz.utcOffset ? `${tz.name} (${tz.utcOffset})` : tz.name;

// ---------------------------------------------------------------------------
// Currencies (ISO 4217, from the runtime)
// ---------------------------------------------------------------------------

// Intl.supportedValuesOf is ES2022; the app's TS lib predates it
const supportedCurrencies = () => (Intl as unknown as { supportedValuesOf(key: "currency"): string[] }).supportedValuesOf("currency");

export function currencyOptions() {
  const names = new Intl.DisplayNames(["en"], { type: "currency" });
  return supportedCurrencies()
    .map((code) => ({ value: code, label: `${names.of(code) ?? code} (${code})` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
export const isCurrencyCode = (code: string) => supportedCurrencies().includes(code);

// ---------------------------------------------------------------------------
// Reference sync and gap review
// ---------------------------------------------------------------------------

export type ReferenceSource = "geonames" | "iana";
export const referenceSourceLabel: Record<ReferenceSource, string> = { geonames: "GeoNames", iana: "IANA tz" };

export const reviewEntities = ["countries", "provinces", "cities", "timezones"] as const;
export type ReviewEntity = (typeof reviewEntities)[number];

export const reviewFlags = [
  { id: "new", label: "New", description: "In the reference, not in CinemaDB" },
  { id: "missing", label: "Missing", description: "In CinemaDB, retired or absent in the reference" },
  { id: "mismatch", label: "Mismatch", description: "Linked record differs on code, parent or timezone" },
  { id: "duplicate", label: "Duplicate", description: "Two CinemaDB records link to one reference record" },
] as const;
export type ReviewFlag = (typeof reviewFlags)[number]["id"];

export type ReviewStatus = "open" | "resolved" | "ignored";
export type ReviewResolution = "added" | "linked" | "fixed" | "deactivated" | "ignored" | "cleared";

export interface ReviewDifference {
  field: string;
  local: string | null;
  reference: string | null;
}

export interface ReviewItem {
  id: number;
  entity: ReviewEntity;
  flag: ReviewFlag;
  recordId: string | null;
  /** Current name of the CinemaDB record, for display. */
  recordLabel: string | null;
  source: ReferenceSource;
  sourceRef: string;
  reference: Record<string, unknown> | null;
  local: Record<string, unknown> | null;
  differences: ReviewDifference[];
  /** What Link or fix would do automatically, or null when it needs the edit form. */
  autoFix: string | null;
  status: ReviewStatus;
  resolution: ReviewResolution | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface SyncRun {
  id: number;
  trigger: "nightly" | "manual";
  status: "running" | "succeeded" | "failed";
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  summary: {
    sources?: { geonames?: string; iana?: string; runtimeTz?: string };
    linked?: number;
    opened?: number;
    reopened?: number;
    closed?: number;
    detected?: number;
  };
  startedBy: string;
}

export interface SyncSettings {
  /** Null: the countries that have theatres. */
  trackedCountryIds: string[] | null;
  /** Resolved list, for display. */
  trackedCountries: LocationRef[];
  populationThreshold: number;
  nightlyEnabled: boolean;
  updatedBy: string;
  updatedAt: string;
}

export interface ReviewSummary {
  lastRun: SyncRun | null;
  running: boolean;
  settings: SyncSettings;
  /** Open item counts: counts[entity][flag]. */
  counts: Record<ReviewEntity, Record<ReviewFlag, number>>;
}

export interface ReviewItemsParams {
  entity: ReviewEntity;
  flag?: ReviewFlag;
  status?: ReviewStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export type ReviewAction =
  | { action: "ignore" }
  | { action: "link"; recordId: string }
  | { action: "fix" }
  | { action: "deactivate" }
  | { action: "keep"; recordId: string };

/** Prefill for the create form when adding a New item: field → value. */
export type ReviewPrefill = Record<string, unknown>;
