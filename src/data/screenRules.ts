// Screen identity rules, shared by the screen form and the server (and backed by migration 014):
// a screen needs a number or a name; the number is a whole number; within a theatre no two screens share a
// number or a name (ignoring case and surrounding spaces). Deleted screens don't count.
import type { Screen } from "../types";

type Identity = Pick<Screen, "number" | "name"> & { id?: string; status?: Screen["status"] };

/** The number as stored: digits without leading zeros ("007" → "7"); "" when blank; null when not a whole number. */
export function normalizeScreenNumber(value: unknown): string | null {
  const v = value === undefined || value === null ? "" : String(value).trim();
  if (v === "") return "";
  return /^\d+$/.test(v) ? v.replace(/^0+(?=\d)/, "") : null;
}

const nameKey = (name: unknown) => (typeof name === "string" ? name.trim().toLowerCase() : "");

/** Problems with one screen's number and name, checked against the theatre's other screens. */
export function screenIdentityErrors(screen: Identity, others: Identity[]): { number?: string; name?: string } {
  const errors: { number?: string; name?: string } = {};
  const number = normalizeScreenNumber(screen.number);
  const name = nameKey(screen.name);
  if (number === null) errors.number = "Screen number must be a whole number";
  if (number === "" && name === "") errors.name = "Enter a screen number or a screen name";
  if (screen.status === "Deleted") return errors;
  const live = others.filter((o) => o.status !== "Deleted" && (!screen.id || o.id !== screen.id));
  if (number && live.some((o) => normalizeScreenNumber(o.number) === number)) {
    errors.number = `Screen number ${number} is already used in this theatre`;
  }
  if (name && live.some((o) => nameKey(o.name) === name)) {
    errors.name = `Screen name "${String(screen.name).trim()}" is already used in this theatre`;
  }
  return errors;
}

/** The first rule a theatre's list of screens breaks, or null when every screen is fine. */
export function screenListError(screens: Identity[]): string | null {
  for (const [i, s] of screens.entries()) {
    const errors = screenIdentityErrors(s, screens.filter((_, j) => j !== i));
    const message = errors.number ?? errors.name;
    if (message) return message;
  }
  return null;
}

/** How to refer to a screen in messages: its name, else "Screen <number>". */
export const screenLabel = (s: Pick<Screen, "number" | "name">) =>
  s.name?.trim() || (s.number ? `Screen ${s.number}` : "Screen");
