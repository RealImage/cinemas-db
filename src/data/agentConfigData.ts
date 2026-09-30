// Agent configurations: entitlements, configurations format and scoped values
// of an agent (a fleet image other than an Appliance OS).
import { GLOBAL_REF } from "./credentialsManagerData";

export { GLOBAL_REF };

/** Appliance OS images are operating systems, not agents, and have no configurations. */
export const isAgentImage = (image: { provider: string }) => image.provider !== "Appliance OS";

export const agentConfigurationsPath = (imageId: string) => `/fleet-management/images/${imageId}/configurations`;
export const IMAGE_MANAGEMENT_PATH = "/fleet-management/images";

/**
 * Link to an agent's configurations that opens one chain or theatre's configuration for editing (or adding, when
 * it has none yet).
 */
export const agentConfigurationLink = (imageId: string, scope: "chain" | "theatre", ref: string) =>
  `${IMAGE_MANAGEMENT_PATH}/${encodeURIComponent(imageId)}/configurations?${new URLSearchParams({ scope, ref })}`;

// ---------------------------------------------------------------------------
// Entitlements
// ---------------------------------------------------------------------------

export interface Entitlement {
  id: string;
  label: string;
  /** Every agent has it; it can't be removed. */
  locked?: boolean;
}

/** The master list: the facility data an agent may access (the same areas as the theatre's WTF panel). */
export const allEntitlements: Entitlement[] = [
  { id: "theatre_metadata", label: "Theatre Meta Data", locked: true },
  { id: "theatre_isp", label: "Theatre ISP" },
  { id: "content_ingestion", label: "Content Ingestion" },
  { id: "kdm_ingestion", label: "KDM Ingestion" },
  { id: "screen_metadata", label: "Screen Meta Data" },
  { id: "screen_devices", label: "Screen Devices" },
  { id: "agents_config", label: "Agents & Agent Config" },
];
export const entitlementIds = allEntitlements.map((e) => e.id);
export const lockedEntitlementIds = allEntitlements.filter((e) => e.locked).map((e) => e.id);
export const entitlementLabel = (id: string) => allEntitlements.find((e) => e.id === id)?.label ?? id;

/** Known ids in catalogue order, always including the locked ones. */
export const normalizeEntitlements = (ids: readonly string[]) =>
  entitlementIds.filter((id) => lockedEntitlementIds.includes(id) || ids.includes(id));

// ---------------------------------------------------------------------------
// Configurations format
// ---------------------------------------------------------------------------

export const configValueTypes = ["string", "integer", "ip", "storage_gb"] as const;
export type ConfigValueType = (typeof configValueTypes)[number];

export const configValueTypeLabels: Record<ConfigValueType, string> = {
  string: "String",
  integer: "Integer",
  ip: "IP address",
  storage_gb: "Storage (GB)",
};

export interface ConfigFieldDef {
  /** Stable key the values are stored under; survives renaming the field. */
  key: string;
  name: string;
  valueType: ConfigValueType;
  /** Masked values are stored encrypted and shown as •••• until explicitly revealed. */
  masked: boolean;
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Why `value` isn't valid for the type, or null. Expects a trimmed, non-empty value. */
export function configValueError(field: Pick<ConfigFieldDef, "name" | "valueType">, value: string): string | null {
  switch (field.valueType) {
    case "integer":
      return /^-?\d+$/.test(value) ? null : `${field.name} must be a whole number`;
    case "ip":
      return IPV4.test(value) ? null : `${field.name} must be an IPv4 address, e.g. 192.168.1.10`;
    case "storage_gb":
      return /^\d+(\.\d+)?$/.test(value) && Number(value) > 0 ? null : `${field.name} must be a size in GB greater than 0`;
    default:
      return null;
  }
}

/** Display form of a stored value (e.g. "500 GB"). */
export const formatConfigValue = (field: Pick<ConfigFieldDef, "valueType">, value: string) =>
  field.valueType === "storage_gb" ? `${value} GB` : value;

export const describeConfigFields = (fields: readonly ConfigFieldDef[]) =>
  fields.length ? fields.map((f) => f.name).join(", ") : "No configurations";

// ---------------------------------------------------------------------------
// Scopes and records
// ---------------------------------------------------------------------------

export const configScopes = [
  { id: "global", label: "Global", refLabel: "Scope" },
  { id: "chain", label: "Chain", refLabel: "Chain" },
  { id: "theatre", label: "Theatre", refLabel: "Theatre" },
] as const;
export type ConfigScope = (typeof configScopes)[number]["id"];
export const configScopeIds: ConfigScope[] = configScopes.map((s) => s.id);

export interface AgentDetails {
  id: string;
  provider: string;
  agentOsName: string;
  latestVersion: string;
  entitlements: string[];
  configFields: ConfigFieldDef[];
  /** The levels configurations can be set at; the other levels' tabs are hidden and their rows ignored. */
  configLevels: ConfigScope[];
  /** Last change to the entitlements or configurations format. */
  updatedBy: string;
  updatedAt: string;
}

/** One agent's configuration values at a scope; `ref` is "Global", a chain name or a theatre name. */
export interface AgentConfiguration {
  id: string;
  imageId: string;
  scope: ConfigScope;
  ref: string;
  /** Values of unmasked fields. Masked values are never sent in lists; reveal them one at a time. */
  values: Record<string, string>;
  /** Keys of masked fields that have a stored (encrypted) value. */
  maskedKeys: string[];
  updatedBy: string;
  updatedAt: string;
}

export type AgentUpdateInput = Pick<AgentDetails, "entitlements" | "configFields" | "configLevels">;

/** On update, a masked field left out of `values` keeps its stored value. */
export type AgentConfigurationInput = Pick<AgentConfiguration, "scope" | "ref" | "values">;

/** Fleet image name of the Live Wire agent, whose theatre settings the theatre form shows read-only. */
export const LIVE_WIRE_AGENT = "Live Wire";
