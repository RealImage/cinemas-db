// WTF ("What's This Facility"): one read-only view of everything configured for
// a theatre, gathered from the theatre definition, Credentials Manager and
// agent configurations. GET /api/wtf/:theatreId.
import type { CredentialFieldDef, CredentialScope } from "./credentialsManagerData";
import type { ConfigFieldDef, ConfigScope } from "./agentConfigData";
import type { DeliveryTimeSlot, DownloadRestrictions } from "@/types";

export interface WtfScreen {
  id: string;
  name: string;
  number: string;
  seatCount: number | null;
  projectionType: string | null;
  projectionExperiences: string[];
  audioExperiences: string[];
}

/** Credentials that apply to one device: the most specific of device serial, theatre, chain, country, Global. */
export interface WtfEffectiveCredentials {
  deviceModelId: string;
  credentialId: string;
  scope: CredentialScope;
  ref: string;
  fields: CredentialFieldDef[];
  /** Unmasked values; masked ones are revealed one at a time via the credentials API. */
  values: Record<string, string>;
  maskedKeys: string[];
  updatedAt: string;
}

export interface WtfScreenDevice {
  id: string;
  screenName: string;
  screenNumber: string;
  brand: string;
  model: string;
  role: string;
  serialNumber: string;
  /** Null when no device model in Credentials Manager matches, or none of its credentials apply. */
  credentials: WtfEffectiveCredentials | null;
  /** The matching device model, when there is one but no credential applies. */
  deviceModelId: string | null;
}

/** One configuration value that applies to the theatre, and the row it comes from. */
export interface WtfConfigValue {
  field: ConfigFieldDef;
  /** Null when no row sets this field; masked values are never included. */
  value: string | null;
  masked: boolean;
  configId: string | null;
  source: ConfigScope | null;
  sourceRef: string | null;
  /** When the source row was last saved; with configId, identifies the value's version. */
  updatedAt: string | null;
}

export interface WtfAgent {
  imageId: string;
  name: string;
  provider: string;
  /** Versions installed on the theatre's appliances. */
  versions: string[];
  entitlements: string[];
  configuration: WtfConfigValue[];
}

export interface WtfData {
  theatre: {
    id: string;
    uuid: string;
    name: string;
    alternateNames: string[];
    city: string;
    state: string;
    country: string;
    chainName: string;
    tms: string | null;
    ticketingSystem: string | null;
  };
  isp: { enabled: boolean; restrictions: DownloadRestrictions | null };
  contentAutoIngestion: { enabled: boolean; contentTypes: string[]; timeSlots: DeliveryTimeSlot[] };
  kdmAutoIngestion: { timeSlots: DeliveryTimeSlot[] };
  screens: WtfScreen[];
  screenDevices: WtfScreenDevice[];
  agents: WtfAgent[];
}

/**
 * GET /api/theatres/:id/livewire: the Live Wire agent settings that apply at a theatre (read-only on the theatre
 * form; edited in Fleet Management › Image Management › Live Wire › Manage Agent Configurations).
 */
export interface TheatreLiveWire {
  /** The Live Wire fleet image, for linking to its configurations; null when there's no Live Wire agent. */
  imageId: string | null;
  configuration: WtfAgent["configuration"];
}
