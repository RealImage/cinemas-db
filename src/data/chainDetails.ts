// The Edit Chain page (src/pages/ChainEdit.tsx) and its API (server/routes/chains.ts): shapes, and the form
// validation both sides run, so an inline error and a 400 always say the same thing.
import type { Chain } from "../types";
import type { CredentialDeviceWithStatus, ScopedCredential } from "./credentialsManagerData";

export type ChainPhone = { countryCode: string; number: string };
export type ChainOwner = { name: string; countryCode: string; phone: string };

/** What the Basic and Contact Information tabs save (PUT /chains/:id). */
export interface ChainDetailsInput {
  name: string;
  displayName: string;
  cityId: string | null;
  postalCode: string;
  area: string;
  headOfficeAddress: string;
  emails: string[];
  phones: ChainPhone[];
  owners: ChainOwner[];
}

export type ChainDetails = Chain & ChainDetailsInput & {
  /** "City, Province, Country" of cityId. */
  cityLabel: string | null;
};

/** A dialling code from the Locations countries, and the countries (ISO alpha-2) that use it. */
export type CallingCode = { code: string; countries: string[] };

export type ChainSystemCount = { id: string; name: string; theatres: number };

export interface ChainSystems {
  /** TMSes the chain's theatres may use (chain_tms). */
  tms: { id: string; name: string }[];
  /** POS / ticketing systems the chain's theatres may use (chain_ticketing_systems). */
  ticketingSystems: { id: string; name: string }[];
  theatreCount: number;
  /** TMSes the chain's theatres use; `allowed` is false for one no longer linked to the chain. */
  tmsInUse: (ChainSystemCount & { allowed: boolean })[];
  theatresWithoutTms: number;
  /** Ticketing systems the chain's theatres use; `allowed` as for tmsInUse. */
  ticketingInUse: (ChainSystemCount & { allowed: boolean })[];
  theatresWithoutTicketing: number;
  deliveryModes: { mode: "Physical" | "Network" | "Modem"; method: string; theatres: number }[];
}

export interface ChainDeviceModel {
  device: Pick<CredentialDeviceWithStatus, "id" | "brand" | "model" | "type" | "credentialFields">;
  theatres: number;
  /** Screens with a unit of this model; null for a TMS / ticketing system (a theatre-level system). */
  screens: number | null;
  /** Chain, theatre and global credentials of this model that apply to the chain; masked values withheld. */
  credentials: ScopedCredential[];
}

export interface ChainDeviceCredentials {
  models: ChainDeviceModel[];
  /** Screen device models not in the Credentials Manager. */
  unmatched: { brand: string; model: string; theatres: number; screens: number }[];
}

export interface ChainTheatre {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  status: string;
  screenCount: number;
}

export interface ChainLogEntry {
  id: string;
  date: string;
  section: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  updatedBy: string;
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Digits, spaces and + - ( ); at least four digits. */
const PHONE = /^[0-9 +\-()]+$/;
export const phoneError = (v: string) =>
  !PHONE.test(v) ? "Use digits, spaces and + - ( ) only" : (v.match(/\d/g)?.length ?? 0) < 4 ? "Enter at least 4 digits" : null;

/** A row the user added and left empty; dropped on save rather than reported. */
const blankPhone = (p: ChainPhone) => !p.number.trim();
const blankOwner = (o: ChainOwner) => !o.name.trim() && !o.phone.trim();

/** Trimmed input with empty rows dropped: what's validated and stored. */
export function cleanChainInput(f: ChainDetailsInput): ChainDetailsInput {
  return {
    name: f.name.trim(),
    displayName: f.displayName.trim(),
    cityId: f.cityId || null,
    postalCode: f.postalCode.trim(),
    area: f.area.trim(),
    headOfficeAddress: f.headOfficeAddress.trim(),
    emails: f.emails.map((e) => e.trim()).filter(Boolean),
    phones: f.phones.filter((p) => !blankPhone(p)).map((p) => ({ countryCode: p.countryCode.trim().replace(/^\+/, ""), number: p.number.trim() })),
    owners: f.owners.filter((o) => !blankOwner(o))
      .map((o) => ({ name: o.name.trim(), countryCode: o.countryCode.trim().replace(/^\+/, ""), phone: o.phone.trim() })),
  };
}

/**
 * Errors by field, for the raw form rows (keys like `emails.1`, `phones.0.number`, `owners.2.name`), so the page
 * can show them next to the row. Empty rows are ignored. `callingCodes` is the allowed dialling codes.
 */
export function chainFormErrors(f: ChainDetailsInput, callingCodes: readonly string[]): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!f.name.trim()) errors.name = "Chain name is required";
  if (!f.cityId) errors.cityId = "City is required";
  const seenEmails = new Set<string>();
  f.emails.forEach((raw, i) => {
    const e = raw.trim().toLowerCase();
    if (!e) return;
    if (!EMAIL.test(e)) errors[`emails.${i}`] = "Enter a valid email address";
    else if (seenEmails.has(e)) errors[`emails.${i}`] = "This email is listed twice";
    seenEmails.add(e);
  });
  const code = (v: string) => {
    const c = v.trim().replace(/^\+/, "");
    return !c ? "Select a country code" : callingCodes.includes(c) ? null : `+${c} is not a known country code`;
  };
  f.phones.forEach((p, i) => {
    if (blankPhone(p)) return;
    const c = code(p.countryCode);
    if (c) errors[`phones.${i}.countryCode`] = c;
    const n = phoneError(p.number.trim());
    if (n) errors[`phones.${i}.number`] = n;
  });
  f.owners.forEach((o, i) => {
    if (blankOwner(o)) return;
    if (!o.name.trim()) errors[`owners.${i}.name`] = "Owner name is required";
    if (o.phone.trim()) {
      const c = code(o.countryCode);
      if (c) errors[`owners.${i}.countryCode`] = c;
      const n = phoneError(o.phone.trim());
      if (n) errors[`owners.${i}.phone`] = n;
    }
  });
  return errors;
}

export const formatPhone = (countryCode: string, number: string) => (countryCode ? `+${countryCode} ${number}` : number);
