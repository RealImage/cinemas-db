// The theatre identity shown in the info hover card next to theatre names
// (src/components/theatres/TheatreInfo.tsx). GET /api/theatres/:ref/summary.

export interface TheatreSummary {
  id: string;
  name: string;
  /** Display name and alternate names, without duplicates. */
  alternateNames: string[];
  uuid: string | null;
  /** One line: street address, city, state and postal code, country. */
  address: string | null;
}

/**
 * One address line. A street line with commas is already a full address (e.g. "1998 Broadway, New York, NY 10023,
 * USA") and is shown as it is, since its spellings ("USA") needn't match the city/country fields ("United States").
 * Otherwise the city, state, postal code and country are appended, skipping any the street line contains.
 */
export function formatTheatreAddress(parts: {
  address?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; country?: string | null;
}) {
  const street = parts.address?.trim() ?? "";
  if (street.includes(",")) return street;
  // Whole words only, so "CA" isn't found in "123 Academy St"
  const has = (v: string) =>
    new RegExp(`(?<![\\p{L}\\p{N}])${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu").test(street);
  const region = [parts.state, parts.postalCode].map((v) => v?.trim()).filter((v): v is string => !!v && !has(v)).join(" ");
  const rest = [parts.city?.trim(), region, parts.country?.trim()].filter((v): v is string => !!v && !has(v));
  const line = [street, ...rest].filter(Boolean).join(", ");
  return line || null;
}

/** A theatre's display name and alternate names, trimmed and without duplicates or its own name. */
export function theatreAlternateNames(name: string, displayName: string | null | undefined, alternateNames: (string | null)[] | null | undefined) {
  return [...new Set([displayName, ...(alternateNames ?? [])].map((n) => n?.trim()).filter((n): n is string => !!n && n !== name))];
}
