export const deviceTypes = [
  "Projector",
  "Playback Server",
  "Audio Processor",
  "Ticketing System",
  "TMS",
  "Others",
] as const;
export type DeviceType = (typeof deviceTypes)[number];

export const dciOptions = ["true", "false", "NA"] as const;
export type DciCompliance = (typeof dciOptions)[number];

/** Device roles (DCI security roles and system roles) a model can carry. */
export const deviceRoles = [
  { code: "FM", description: "Forensic Mark" },
  { code: "FMA", description: "Forensic Mark Inserter (Audio/Sound)" },
  { code: "FMI", description: "Forensic Mark Inserter (Image/Picture)" },
  { code: "LD", description: "Link Decryptor (Image/Picture)" },
  { code: "LE", description: "Link Encryptor (Image/Picture)" },
  { code: "MD", description: "Media Decryptor" },
  { code: "MDA", description: "Media Decryptor (Audio/Sound)" },
  { code: "MDE", description: "MDE" },
  { code: "MDI", description: "Media Decryptor (Image/Picture)" },
  { code: "MDS", description: "Media Decryptor (Subtitle)" },
  { code: "MIC", description: "MIC" },
  { code: "OBAE", description: "OBAE" },
  { code: "PR", description: "Projector" },
  { code: "RMB", description: "RMB" },
  { code: "SM", description: "Security Manager" },
  { code: "SMS", description: "SMS" },
  { code: "SPB", description: "Secure Processing Block (Security Enclosure)" },
  { code: "TMS", description: "Theater Management System" },
  { code: "POS", description: "Ticketing System" },
] as const;
export const deviceRoleCodes: string[] = deviceRoles.map((r) => r.code);
export const roleDescription = (code: string) => deviceRoles.find((r) => r.code === code)?.description;

/** Types for which DCI compliance doesn't apply; an unchecked "Is DCI" stores NA. */
export const nonDciTypes: DeviceType[] = ["TMS", "Ticketing System", "Others"];

// ---------------------------------------------------------------------------
// Credentials format: an ordered list of named fields, each numeric or string
// ---------------------------------------------------------------------------

export const credentialValueTypes = ["string", "numeric"] as const;
export type CredentialValueType = (typeof credentialValueTypes)[number];

export interface CredentialFieldDef {
  /** Stable key the values are stored under; survives renaming the field. */
  key: string;
  name: string;
  valueType: CredentialValueType;
  /** Masked values are stored encrypted and shown as •••• until explicitly revealed. */
  masked: boolean;
  /** A credential can't be saved without a value for a mandatory field. */
  mandatory: boolean;
}

/** Values of one credential set, keyed by CredentialFieldDef.key. */
export type CredentialValues = Record<string, string>;

/** Default for the Masked checkbox of a new field: names that look like secrets (Password, PIN…). */
export const looksSecret = (name: string) => /pass|pwd|pin|secret|token|key/i.test(name);

export const isNumericValue = (v: string) => /^-?\d+(\.\d+)?$/.test(v.trim());

/** A key for a new field, unique within `fields`. */
export const makeFieldKey = (name: string, fields: Pick<CredentialFieldDef, "key">[]) => {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "field";
  const taken = new Set(fields.map((f) => f.key));
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}_${n}`;
  return key;
};

export const describeCredentialFields = (fields: CredentialFieldDef[]) =>
  fields.length ? fields.map((f) => f.name).join(", ") : "No fields defined";

export const DEFAULT_CREDENTIAL_FIELDS: CredentialFieldDef[] = [
  { key: "username", name: "Username", valueType: "string", masked: false, mandatory: true },
  { key: "password", name: "Password", valueType: "string", masked: true, mandatory: true },
];

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

export const credentialScopes = [
  { id: "global", label: "Global Credentials", refLabel: "Region" },
  { id: "chain", label: "Chain Credentials", refLabel: "Chain" },
  { id: "theatre", label: "Theatre Credentials", refLabel: "Theatre" },
  { id: "device", label: "Device Credentials", refLabel: "Device (Serial No.)" },
] as const;
export type CredentialScope = (typeof credentialScopes)[number]["id"];

export const GLOBAL_REF = "Global";

/**
 * One set of credentials for a device model at a given scope. `ref` is the
 * scope target: "Global" or a country (global), chain name, theatre name, or
 * device serial number.
 */
export interface ScopedCredential {
  id: string;
  deviceId: string;
  scope: CredentialScope;
  ref: string;
  /** Device scope only: where that unit is installed. */
  location?: string;
  /** Values of unmasked fields. Masked values are never sent in lists; reveal them one at a time. */
  values: CredentialValues;
  /** Keys of masked fields that have a stored (encrypted) value. */
  maskedKeys: string[];
  updatedBy: string;
  updatedAt: string;
}

export interface CredentialDevice {
  id: string;
  brand: string;
  model: string;
  /** All roles of the model: primary + from certificates + additional (derived). */
  roles: string[];
  primaryRole: string | null;
  certificateRoles: string[];
  additionalRoles: string[];
  type: DeviceType;
  dci: DciCompliance;
  translations: string[];
  /** Devices of this model are expected to have a serial number. */
  serialNumberRequired: boolean;
  credentialFields: CredentialFieldDef[];
  updatedBy: string;
  updatedAt: string;
}

/** Combined role list shown in the Roles column. */
export const combineRoles = (d: Pick<CredentialDevice, "primaryRole" | "certificateRoles" | "additionalRoles">) =>
  Array.from(new Set([d.primaryRole, ...d.certificateRoles, ...d.additionalRoles].filter((r): r is string => !!r)));

/** Default credentials are the ones the device ships with, i.e. the Global row. */
export const hasDefaultCredentials = (deviceId: string, credentials: ScopedCredential[]) =>
  credentials.some((c) => c.deviceId === deviceId && c.scope === "global" && c.ref === GLOBAL_REF);

/** API shape of a device: the record plus whether a Global/"Global" credential exists. */
export type CredentialDeviceWithStatus = CredentialDevice & { hasDefaultCredentials: boolean };

/** What the add/edit device form sends; the server derives `roles` and stamps the audit fields. */
export type CredentialDeviceInput = Pick<
  CredentialDevice,
  | "brand" | "model" | "primaryRole" | "certificateRoles" | "additionalRoles" | "type" | "dci"
  | "translations" | "serialNumberRequired" | "credentialFields"
>;

/**
 * Fields a credential save sends; the server stamps id (for new rows), updatedBy and updatedAt.
 * On update, a masked field left out of `values` keeps its stored value.
 */
export type CredentialInput = Pick<ScopedCredential, "scope" | "ref" | "location" | "values">;

export const CREDENTIALS_MANAGER_PATH = "/theatre-device-management/credentials-manager";
export const deviceCredentialsPath = (deviceId: string) => `${CREDENTIALS_MANAGER_PATH}/${deviceId}/credentials`;

export const countryOptions = [
  "Australia", "Canada", "France", "Germany", "India", "Ireland", "Japan", "Mexico",
  "South Korea", "United Arab Emirates", "UK", "USA",
];
/** Chains offered for chain-scoped credentials beyond the ones in the database. */
export const extraChainNames = ["Cinemark", "Odeon", "PVR INOX", "CGV", "Cinépolis", "Pathé"];
