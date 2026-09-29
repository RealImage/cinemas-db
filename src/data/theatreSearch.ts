import type { Theatre } from "@/types";

// Theatre List search (GET /api/theatres/search). The server matches each token against theatre fields and ranks
// theatres by the tokens they match, longer tokens counting for more.

export const THEATRE_SEARCH_MODES = [
  { value: "all", label: "All" },
  { value: "theatre", label: "Theatre" },
  { value: "uuid", label: "UUID" },
  { value: "thirdParty", label: "Third-party ID" },
  { value: "device", label: "Device" },
] as const;

export type TheatreSearchMode = (typeof THEATRE_SEARCH_MODES)[number]["value"];

export const isTheatreSearchMode = (v: unknown): v is TheatreSearchMode =>
  THEATRE_SEARCH_MODES.some((m) => m.value === v);

export const THEATRE_SEARCH_PLACEHOLDERS: Record<TheatreSearchMode, string> = {
  all: "Search by name, chain, location, UUID, third-party ID or device serial…",
  theatre: "Search by name, alternate name, chain, company or address…",
  uuid: "Search by theatre UUID…",
  thirdParty: "Search by third-party ID, e.g. moviebuff.com:1234…",
  device: "Search by device or WireTAP serial, or WireTAP host name…",
};

/** Words too common in theatre names and addresses to tell theatres apart. */
export const SEARCH_STOP_WORDS = new Set([
  "the", "a", "an", "and", "of", "at", "in", "on", "by",
  "cinema", "cinemas", "cine", "theatre", "theatres", "theater", "theaters",
  "multiplex", "multiplexes", "cineplex", "cineplexes",
  "drive", "drive-in", "mall",
]);

/**
 * Lowercased search tokens, longest first. Splits on spaces and punctuation that don't occur inside IDs (so UUIDs,
 * serials and "domain:id" stay whole), drops common words and one-character tokens, and falls back to every token
 * when that would leave nothing (a search for "The Cinema" still runs).
 */
export function searchTokens(query: string): string[] {
  const all = [...new Set(
    query.toLowerCase().split(/[\s,;/|()&"'+]+/).map((t) => t.replace(/^[-:._]+|[-:._]+$/g, "")).filter(Boolean),
  )];
  const useful = all.filter((t) => t.length > 1 && !SEARCH_STOP_WORDS.has(t));
  return (useful.length ? useful : all).sort((a, b) => b.length - a.length);
}

/** A search result's best match, shown under the theatre name. */
export interface TheatreMatch {
  field: string;
  value: string;
}

/** GET /api/theatres/page */
export interface TheatrePage {
  rows: (Theatre & { match?: TheatreMatch })[];
  total: number;
}

/** Listing filter option for theatres whose listing isn't set. */
export const LISTING_NOT_SET = "Not set";

/** Tag chips on the Theatre List: where a theatre is and which companies it's linked to. */
export const THEATRE_TAG_KINDS = [
  { value: "chain", label: "Chain" },
  { value: "city", label: "City" },
  { value: "province", label: "Province" },
  { value: "country", label: "Country" },
  { value: "owner", label: "Company" },
  { value: "integrator", label: "Exhibitor / Integrator" },
  { value: "adIntegrator", label: "Ad integrator" },
] as const;

export type TheatreTagKind = (typeof THEATRE_TAG_KINDS)[number]["value"];

export const isTheatreTagKind = (v: unknown): v is TheatreTagKind => THEATRE_TAG_KINDS.some((k) => k.value === v);

export const theatreTagLabel = (kind: TheatreTagKind) => THEATRE_TAG_KINDS.find((k) => k.value === kind)!.label;

export interface TheatreTag {
  kind: TheatreTagKind;
  value: string;
}

export const sameTag = (a: TheatreTag, b: TheatreTag) => a.kind === b.kind && a.value === b.value;

/** GET /api/theatres/facets */
export interface TheatreFacets {
  statuses: string[];
  chains: string[];
  companies: string[];
  tags: (TheatreTag & { count: number })[];
}

export interface TheatreSearchHit {
  id: string;
  score: number;
  /** The field that matched best, e.g. "Device serial". */
  matchedField: string;
  matchedValue: string;
}
