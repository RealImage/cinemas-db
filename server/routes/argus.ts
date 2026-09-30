import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { stream } from "hono/streaming";
import { query } from "../db";
import { httpError } from "../http";
import { STATUSES, THEATRE_FROM, loadTheatre, rankedSearch, validate as validateTheatre, type TheatreInput } from "./theatres";
import { CHAIN_DETAILS_SELECT, CHAIN_SELECT, callingCodes } from "./chains";
import type { Chain } from "../../src/types";
import { chainFormErrors, type ChainDetails } from "../../src/data/chainDetails";
import {
  ARGUS_EDITABLE_FIELDS, ARGUS_LIMITS,
  type ArgusChatResponse, type ArgusMessage, type ArgusProposal, type ArgusProposalKind, type ArgusStep, type ArgusStreamEvent,
} from "../../src/data/argus";

/**
 * Ask Argus: a chat over the CinemaDB data. The model (Anthropic Messages API) answers with read-only tools run
 * here against the database, and may propose theatre or chain updates, which the panel shows as cards; applying
 * one goes through the entity's own endpoint, so Argus itself never writes.
 */
export const argus = new Hono();

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOOL_ROUNDS = 8;
/** Longest tool result sent back to the model, in characters. */
const MAX_TOOL_RESULT = 12_000;
const LIST_LIMIT = 25;

export const NOT_SET_UP = "Ask Argus isn't set up yet: add ANTHROPIC_API_KEY to .env and restart the API.";

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

type ToolInput = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const limitOf = (v: unknown) => Math.min(LIST_LIMIT, Math.max(1, Number.isInteger(v) ? (v as number) : LIST_LIMIT));
const like = (v: string) => `%${v.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

const theatreLink = (id: string) => `/theatre/${id}/edit`;
const chainLink = (id: string) => `/chains/${id}`;

/**
 * A live theatre by id, code, UUID or exact name, else the theatres whose name contains `ref`; `candidates` when
 * that's more than one.
 */
async function findTheatre(ref: string) {
  if (!ref) throw new ToolError("Give a theatre id, code or name");
  const [exact] = await query<{ id: string }>(
    `SELECT id FROM theatres WHERE status <> 'Deleted' AND (id = $1 OR code = upper($1) OR uuid = $1 OR lower(name) = lower($1))
     ORDER BY (id = $1) DESC, coalesce(code = upper($1), false) DESC LIMIT 1`, [ref]);
  if (exact) return { id: exact.id };
  const candidates = await query<{ id: string; code: string; name: string; city: string; country: string }>(
    `SELECT id, code, name, city, country FROM theatres
     WHERE status <> 'Deleted' AND (name ILIKE $1 OR display_name ILIKE $1) ORDER BY lower(name) LIMIT 10`, [like(ref)]);
  if (candidates.length === 1) return { id: candidates[0].id };
  if (!candidates.length) throw new ToolError(`No theatre matches "${ref}"`);
  return { candidates: candidates.map((t) => ({ ...t, link: theatreLink(t.id) })) };
}

/** A live chain by id or exact name, else the chains whose name contains `ref`. */
async function findChain(ref: string) {
  if (!ref) throw new ToolError("Give a chain id or name");
  const rows = await query<{ id: string; name: string; exact: boolean }>(
    `SELECT id, name, (id = $1 OR lower(name) = lower($1)) AS exact FROM chains
     WHERE status <> 'Deleted' AND (id = $1 OR name ILIKE $2 OR display_name ILIKE $2)
     ORDER BY 3 DESC, lower(name) LIMIT 10`, [ref, like(ref)]);
  if (rows[0]?.exact || rows.length === 1) return { id: rows[0].id };
  if (!rows.length) throw new ToolError(`No chain matches "${ref}"`);
  return { candidates: rows.map(({ id, name }) => ({ id, name, link: chainLink(id) })) };
}

/** A tool's own failure, returned to the model as an error result so it can correct itself. */
class ToolError extends Error {}

/** WHERE conditions for the theatre filters shared by search_theatres and count_theatres. */
function theatreFilters(input: ToolInput, params: unknown[]) {
  const bind = (v: unknown) => { params.push(v); return `$${params.length}`; };
  const where = ["t.status <> 'Deleted'"];
  const status = str(input.status);
  if (status) {
    if (!STATUSES.includes(status)) throw new ToolError(`status must be one of ${STATUSES.join(", ")}`);
    where.push(`t.status = ${bind(status)}`);
  }
  const country = str(input.country);
  if (country) where.push(`t.country ILIKE ${bind(country)}`);
  const city = str(input.city);
  if (city) where.push(`t.city ILIKE ${bind(city)}`);
  const chain = str(input.chain);
  if (chain) {
    const v = bind(chain);
    where.push(`(c.id = ${v} OR c.name ILIKE ${v})`);
  }
  return { where, bind };
}

const COUNT_GROUPS: Record<string, string> = {
  status: "t.status::text",
  country: "coalesce(nullif(t.country, ''), '(not set)')",
  state: "coalesce(nullif(t.state, ''), '(not set)')",
  city: "coalesce(nullif(t.city, ''), '(not set)')",
  chain: "coalesce(c.name, '(no chain)')",
};

type Tool = {
  description: string;
  input_schema: Record<string, unknown>;
  label: (input: ToolInput) => string;
  run: (input: ToolInput, ctx: ToolContext) => Promise<unknown>;
};

type ToolContext = { proposals: ArgusProposal[] };

const filterProps = {
  status: { type: "string", enum: STATUSES, description: "Theatre status" },
  country: { type: "string", description: "Country name, e.g. India" },
  city: { type: "string", description: "City name" },
  chain: { type: "string", description: "Chain name or id" },
};

const quoted = (v: unknown) => `“${str(v)}”`;

const TOOLS: Record<string, Tool> = {
  search_theatres: {
    description:
      "Search theatres (not Deleted) by text across name, display and alternate names, code (e.g. T10014), chain, " +
      "company, address and city, UUIDs, third-party IDs and device serials; optionally filtered. Best matches first. " +
      "Returns the total count and up to `limit` theatres.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Free text; omit to list by filters only" }, ...filterProps, limit: { type: "integer", maximum: LIST_LIMIT } },
    },
    label: (i) => (str(i.query) ? `Searching theatres for ${quoted(i.query)}` : "Listing theatres"),
    run: async (input) => {
      const params: unknown[] = [];
      const q = str(input.query);
      const ctes = q ? rankedSearch(q, "all", params) : null;
      const { where, bind } = theatreFilters(input, params);
      if (ctes) where.push(`(r.id IS NOT NULL OR upper(t.code) = upper(${bind(q)}))`);
      const from = `${THEATRE_FROM}${ctes ? " LEFT JOIN ranked r ON r.id = t.id" : ""} WHERE ${where.join(" AND ")}`;
      const withClause = ctes ? `WITH ${ctes} ` : "";
      const [{ total }] = await query<{ total: number }>(`${withClause}SELECT count(*)::int AS total ${from}`, params);
      const rows = await query<{ id: string }>(
        `${withClause}SELECT t.id, t.code, t.name, coalesce(t.display_name, '') AS "displayName", c.name AS chain,
                t.city, t.state, t.country, t.status,
                (SELECT count(*) FROM screens s WHERE s.theatre_id = t.id AND s.status <> 'Deleted') AS screens
                ${ctes ? `, r.matched_field AS "matchedOn"` : ""}
         ${from} ORDER BY ${ctes ? "r.score DESC NULLS LAST, " : ""}lower(t.name), t.id LIMIT ${bind(limitOf(input.limit))}`, params);
      return { total, shown: rows.length, theatres: rows.map((r) => ({ ...r, link: theatreLink(r.id) })) };
    },
  },

  get_theatre: {
    description:
      "One theatre's details by id, code, UUID or name: chain, company, status, address, contact details, systems " +
      "(TMS, ticketing), identifiers, WireTAP devices and a summary of each screen. Returns candidates when the name is ambiguous.",
    input_schema: { type: "object", properties: { ref: { type: "string", description: "Theatre id, code, UUID or name" } }, required: ["ref"] },
    label: (i) => `Looking up theatre ${quoted(i.ref)}`,
    run: async (input) => {
      const found = await findTheatre(str(input.ref));
      if (found.candidates) return { ambiguous: true, candidates: found.candidates };
      const t = (await loadTheatre(found.id))!;
      const screens = (t.screens ?? []).filter((s) => s.status !== "Deleted");
      return {
        id: t.id, code: (t as { code?: string }).code, name: t.name, displayName: t.displayName, alternateNames: t.alternateNames,
        uuid: t.uuid, status: t.status, listing: t.listing, type: t.type,
        chain: t.chainId ? { id: t.chainId, name: t.chainName, link: chainLink(t.chainId) } : null,
        company: t.companyName || null,
        address: t.address, city: t.city, state: t.state, country: t.country, postalCode: t.postalCode, timezone: t.timezone,
        phoneNumber: t.phoneNumber, email: t.email, website: t.website, notes: t.notes, closureDetails: t.closureDetails,
        tms: t.theatreManagementSystem ?? null, ticketingSystem: t.ticketingSystem ?? null,
        thirdPartyIds: (t.theatreMappings ?? []).map((m) => `${m.domain}: ${m.theatreId}`),
        wireTAPDevices: (t.wireTAPDevices ?? []).map((w) => ({ serialNumber: w.serialNumber, status: w.status })),
        pendingDeletion: t.pendingDeletion ?? null,
        screenCount: screens.length,
        screens: screens.slice(0, 30).map((s) => ({
          number: s.number, name: s.name, status: s.status, seats: s.seatingCapacity ?? null,
          projection: s.projection?.type ?? null, devices: s.devices.length,
        })),
        updatedAt: t.updatedAt, updatedBy: t.updatedBy,
        link: theatreLink(t.id),
      };
    },
  },

  list_screens: {
    description: "A theatre's screens with their devices (manufacturer, model, serial, role, software, certificate status).",
    input_schema: { type: "object", properties: { ref: { type: "string", description: "Theatre id, code, UUID or name" } }, required: ["ref"] },
    label: (i) => `Listing screens at ${quoted(i.ref)}`,
    run: async (input) => {
      const found = await findTheatre(str(input.ref));
      if (found.candidates) return { ambiguous: true, candidates: found.candidates };
      const t = (await loadTheatre(found.id))!;
      const screens = t.screens ?? [];
      return {
        theatre: { id: t.id, name: t.name, link: theatreLink(t.id) },
        total: screens.length,
        screens: screens.slice(0, 40).map((s) => ({
          number: s.number, name: s.name, status: s.status, seats: s.seatingCapacity ?? null, uuid: s.uuid,
          projection: s.projection ?? null, sound: s.sound?.processor ?? null,
          devices: s.devices.map((d) => ({
            manufacturer: d.manufacturer, model: d.model, serialNumber: d.serialNumber, role: d.role,
            softwareVersion: d.softwareVersion, certificateStatus: d.certificateStatus,
          })),
        })),
      };
    },
  },

  search_chains: {
    description: "Search chains (not Deleted) by name or owning company, with each chain's theatre count and allowed TMS / ticketing systems. Largest first.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "Omit to list all chains" }, limit: { type: "integer", maximum: LIST_LIMIT } } },
    label: (i) => (str(i.query) ? `Searching chains for ${quoted(i.query)}` : "Listing chains"),
    run: async (input) => {
      const q = str(input.query);
      const rows = await query<Chain>(
        `${CHAIN_SELECT} WHERE c.status <> 'Deleted' AND ($1 = '' OR c.name ILIKE $2 OR c.display_name ILIKE $2 OR co.name ILIKE $2)
         ORDER BY "theatreCount" DESC, lower(c.name) LIMIT $3`, [q, like(q), limitOf(input.limit)]);
      return rows.map((r) => ({
        id: r.id, name: r.name, company: r.companyName, theatreCount: r.theatreCount, status: r.status,
        tms: (r.tms ?? []).map((x) => x.name), ticketingSystems: (r.ticketingSystems ?? []).map((x) => x.name),
        link: chainLink(r.id),
      }));
    },
  },

  get_chain: {
    description: "One chain's details by id or name: company, contact information, theatre count, allowed systems and its theatres per country.",
    input_schema: { type: "object", properties: { ref: { type: "string", description: "Chain id or name" } }, required: ["ref"] },
    label: (i) => `Looking up chain ${quoted(i.ref)}`,
    run: async (input) => {
      const found = await findChain(str(input.ref));
      if (found.candidates) return { ambiguous: true, candidates: found.candidates };
      const [ch] = await query<ChainDetails>(`${CHAIN_DETAILS_SELECT} WHERE c.id = $1`, [found.id]);
      const byCountry = await query<{ country: string; theatres: number }>(
        `SELECT coalesce(nullif(country, ''), '(not set)') AS country, count(*)::int AS theatres FROM theatres
         WHERE chain_id = $1 AND status <> 'Deleted' GROUP BY 1 ORDER BY 2 DESC`, [found.id]);
      return {
        id: ch.id, name: ch.name, displayName: ch.displayName, company: ch.companyName, status: ch.status,
        city: ch.cityLabel, postalCode: ch.postalCode, area: ch.area, headOfficeAddress: ch.headOfficeAddress,
        emails: ch.emails, owners: ch.owners.map((o) => o.name),
        theatreCount: ch.theatreCount, theatresByCountry: byCountry,
        tms: (ch.tms ?? []).map((x) => x.name), ticketingSystems: (ch.ticketingSystems ?? []).map((x) => x.name),
        updatedAt: ch.updatedAt, link: chainLink(ch.id),
      };
    },
  },

  count_theatres: {
    description: "Count theatres (not Deleted), grouped by status, country, state, city or chain, optionally filtered. For questions like \"how many active theatres in India\".",
    input_schema: {
      type: "object",
      properties: { group_by: { type: "string", enum: Object.keys(COUNT_GROUPS) }, ...filterProps },
    },
    label: (i) => (str(i.group_by) ? `Counting theatres by ${str(i.group_by)}` : "Counting theatres"),
    run: async (input) => {
      const params: unknown[] = [];
      const { where } = theatreFilters(input, params);
      const group = str(input.group_by);
      if (group && !COUNT_GROUPS[group]) throw new ToolError(`group_by must be one of ${Object.keys(COUNT_GROUPS).join(", ")}`);
      const from = `${THEATRE_FROM} WHERE ${where.join(" AND ")}`;
      const [{ total }] = await query<{ total: number }>(`SELECT count(*)::int AS total ${from}`, params);
      if (!group) return { total };
      const groups = await query<{ value: string; count: number }>(
        `SELECT ${COUNT_GROUPS[group]} AS value, count(*)::int AS count ${from} GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 60`, params);
      return { total, groupBy: group, groups };
    },
  },

  search_device_models: {
    description:
      "Search the Credentials Manager's device models (projectors, playback servers, audio processors, TMS, ticketing " +
      "systems) by brand, model or alternate name, with how many credentials are recorded and how many screen devices use each. Never returns credential values.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        type: { type: "string", enum: ["Projector", "Playback Server", "Audio Processor", "TMS", "Ticketing System", "Others"] },
        limit: { type: "integer", maximum: LIST_LIMIT },
      },
    },
    label: (i) => (str(i.query) ? `Searching device models for ${quoted(i.query)}` : "Listing device models"),
    run: async (input) => {
      const q = str(input.query);
      const rows = await query<{ id: string }>(
        `SELECT d.id, d.brand, d.model, d.type, d.roles, d.translations AS "alternateNames",
                (SELECT count(*) FROM device_credentials x WHERE x.device_id = d.id) AS credentials,
                (SELECT count(*) FROM screen_devices sd
                  WHERE lower(trim(sd.manufacturer)) = lower(d.brand) AND lower(trim(sd.model)) = lower(d.model)) AS "screenDevices"
         FROM credential_devices d
         WHERE ($1 = '' OR d.brand ILIKE $2 OR d.model ILIKE $2 OR d.brand || ' ' || d.model ILIKE $2
                OR EXISTS (SELECT 1 FROM unnest(d.translations) tr WHERE tr ILIKE $2))
           AND ($3 = '' OR d.type = $3)
         ORDER BY lower(d.brand), lower(d.model) LIMIT $4`, [q, like(q), str(input.type), limitOf(input.limit)]);
      return rows.map((r) => ({ ...r, link: `/theatre-device-management/credentials-manager/${r.id}/credentials` }));
    },
  },

  propose_theatre_update: {
    description:
      "Propose changing a theatre's simple fields. This does NOT save anything: the user sees the change as a card " +
      `and applies or cancels it. Editable fields: ${Object.keys(ARGUS_EDITABLE_FIELDS.theatre).join(", ")}. ` +
      `status is one of ${STATUSES.join(", ")}; listing is "Listed - Public", "Listed - Private" or "Unlisted".`,
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The theatre's id (from search_theatres / get_theatre)" },
        changes: { type: "object", description: "Field → new value (text)", additionalProperties: { type: "string" } },
        summary: { type: "string", description: "One short sentence describing the change" },
      },
      required: ["id", "changes", "summary"],
    },
    label: () => "Preparing a theatre update",
    run: async (input, ctx) => propose("theatre", input, ctx),
  },

  propose_chain_update: {
    description:
      "Propose changing a chain's simple fields. This does NOT save anything: the user sees the change as a card " +
      `and applies or cancels it. Editable fields: ${Object.keys(ARGUS_EDITABLE_FIELDS.chain).join(", ")}.`,
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The chain's id (from search_chains / get_chain)" },
        changes: { type: "object", description: "Field → new value (text)", additionalProperties: { type: "string" } },
        summary: { type: "string", description: "One short sentence describing the change" },
      },
      required: ["id", "changes", "summary"],
    },
    label: () => "Preparing a chain update",
    run: async (input, ctx) => propose("chain", input, ctx),
  },
};

/** Validate a proposed update (record exists, fields editable, values accepted) and queue it for the panel. */
async function propose(kind: ArgusProposalKind, input: ToolInput, ctx: ToolContext) {
  const id = str(input.id);
  const summary = str(input.summary).slice(0, 300);
  const raw = input.changes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ToolError("changes must be an object of field → new value");
  const labels: Record<string, string> = ARGUS_EDITABLE_FIELDS[kind];
  const unknown = Object.keys(raw).filter((f) => !(f in labels));
  if (unknown.length) {
    throw new ToolError(`Can't change ${unknown.join(", ")} from chat. Editable ${kind} fields: ${Object.keys(labels).join(", ")}. ` +
      "Other changes must be made on the record's page.");
  }
  const wanted: Record<string, string> = {};
  for (const [field, value] of Object.entries(raw)) {
    if (value !== null && typeof value !== "string") throw new ToolError(`${field} must be text`);
    wanted[field] = (value ?? "").trim();
  }

  let current: Record<string, unknown>;
  let targetName: string;
  if (kind === "theatre") {
    const theatre = id ? await loadTheatre(id) : undefined;
    if (!theatre) throw new ToolError(`No theatre has id "${id}"; look it up with search_theatres first`);
    if (theatre.status === "Deleted") throw new ToolError("That theatre is deleted and can't be edited");
    try {
      validateTheatre(wanted as TheatreInput, false);
    } catch (err) {
      if (err instanceof HTTPException) throw new ToolError(err.message);
      throw err;
    }
    current = { ...theatre };
    targetName = theatre.name;
  } else {
    const [chain] = id ? await query<ChainDetails>(`${CHAIN_DETAILS_SELECT} WHERE c.id = $1 AND c.status <> 'Deleted'`, [id]) : [];
    if (!chain) throw new ToolError(`No chain has id "${id}"; look it up with search_chains first`);
    // PUT /chains/:id replaces the whole form, so check the form as it would be saved
    const { name, displayName, cityId, postalCode, area, headOfficeAddress, emails, phones, owners } = chain;
    const input = { name, displayName, cityId, postalCode, area, headOfficeAddress, emails, phones, owners, ...wanted };
    const codes = (await callingCodes()).map((r) => r.code);
    const [error] = Object.entries(chainFormErrors(input, codes));
    if (error) {
      throw new ToolError(error[0] === "cityId"
        ? `${chain.name} has no city, which the chain form requires; the user must set it on the chain page first`
        : error[1]);
    }
    current = { ...chain };
    targetName = chain.name;
  }

  const changes = Object.entries(wanted)
    .map(([field, to]) => ({ field, label: labels[field], from: current[field] ?? "", to }))
    .filter((c) => String(c.from ?? "") !== c.to);
  if (!changes.length) throw new ToolError("Those values are already set; nothing to change");
  const proposal: ArgusProposal = { id: randomUUID(), kind, targetId: id, targetName, changes, summary };
  ctx.proposals.push(proposal);
  return {
    proposalId: proposal.id,
    status: "Shown to the user as a card with Apply and Cancel. Nothing has been changed; the user must apply it.",
    changes: changes.map(({ label, from, to }) => ({ field: label, from, to })),
  };
}

/** Run one tool call; failures come back as `{ error }` for the model. Exported for testing tools locally. */
export async function runArgusTool(name: string, input: ToolInput, ctx: ToolContext = { proposals: [] }) {
  const tool = TOOLS[name];
  if (!tool) return { error: `Unknown tool ${name}` };
  try {
    return await tool.run(input ?? {}, ctx);
  } catch (err) {
    if (err instanceof ToolError) return { error: err.message };
    console.error(`Argus tool ${name} failed`, err);
    return { error: "The tool failed on the server" };
  }
}

const capResult = (value: unknown) => {
  const text = JSON.stringify(value);
  return text.length > MAX_TOOL_RESULT ? `${text.slice(0, MAX_TOOL_RESULT)}… (truncated; narrow the query)` : text;
};

// ---------------------------------------------------------------------------
// Model loop
// ---------------------------------------------------------------------------

/** What the user is looking at, from the panel's path, so "this theatre" / "this chain" resolve. */
async function pageContext(path: string) {
  const theatre = /^\/theatre\/([^/]+)\/edit$/.exec(path);
  if (theatre) {
    const [t] = await query<{ id: string; name: string }>("SELECT id, name FROM theatres WHERE id = $1", [theatre[1]]);
    if (t) return `The user is on the Edit Theatre page of "${t.name}" (theatre id ${t.id}); "this theatre" means it.`;
  }
  const chain = /^\/chains\/([^/]+)$/.exec(path);
  if (chain) {
    const [c] = await query<{ id: string; name: string }>("SELECT id, name FROM chains WHERE id = $1", [chain[1]]);
    if (c) return `The user is on the Edit Chain page of "${c.name}" (chain id ${c.id}); "this chain" means it.`;
  }
  const device = /^\/theatre-device-management\/credentials-manager\/([^/]+)\/credentials$/.exec(path);
  if (device) {
    const [d] = await query<{ brand: string; model: string }>("SELECT brand, model FROM credential_devices WHERE id = $1", [device[1]]);
    if (d) return `The user is viewing the credentials of device model ${d.brand} ${d.model}.`;
  }
  return "";
}

async function systemPrompt(path: string) {
  const today = new Date().toISOString().slice(0, 10);
  return `You are Argus, the assistant inside CinemaDB, Qube Cinema's portal for its global cinema database. You help staff find information and prepare simple updates.

CinemaDB holds:
- Chains (cinema circuits such as PVR or Cinépolis), each owned by a company, with the TMS and ticketing systems its theatres may use.
- Theatres: a code like T10014, names, chain, company, status (Active, Inactive, Closed), listing, address, contact details, systems and identifiers.
- Screens in each theatre, and the devices in each screen (projectors, playback servers, audio processors) with serial numbers and certificates.
- The Credentials Manager: device models, and credentials recorded for them (you never see credential values).

Rules:
- Use the tools to answer. Never guess names, ids, counts or values; if the tools don't have it, say so.
- Link every record you mention with a markdown link to its page, using the tool results' \`link\` values: theatres [Name](/theatre/{id}/edit), chains [Name](/chains/{id}). Other pages: Theatre List (/theatres/list), Chains (/chains), Credentials Manager (/theatre-device-management/credentials-manager).
- To change data, call propose_theatre_update or propose_chain_update. You never change anything yourself: a proposal is shown to the user as a card, and nothing is saved until they apply it. Never say a change was made; say you've prepared it for them to review and apply. Only the fields those tools list can be changed from chat; for anything else, point the user to the record's page.
- If a name matches several records, ask which one, listing the candidates.
- Be concise: short answers, bullet lists or small markdown tables for several records, and totals when you only show some.

Today is ${today}. The user is on ${path}.${await pageContext(path).then((c) => (c ? `\n${c}` : ""))}`;
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: ToolInput }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
type ApiMessage = { role: "user" | "assistant"; content: string | ContentBlock[] };

/** The transcript as alternating turns that start with the user (consecutive turns of one role are merged). */
function toApiMessages(messages: ArgusMessage[]): ApiMessage[] {
  const out: ApiMessage[] = [];
  for (const m of messages) {
    if (!out.length && m.role !== "user") continue;
    const last = out[out.length - 1];
    if (last?.role === m.role) last.content = `${last.content}\n\n${m.content}`;
    else out.push({ role: m.role, content: m.content });
  }
  return out;
}

async function callModel(apiKey: string, body: Record<string, unknown>) {
  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    console.error("Argus: model request failed", err);
    throw new HTTPException(502, { message: "Ask Argus couldn't reach the AI service. Try again in a moment." });
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = payload?.error?.message ?? `HTTP ${res.status}`;
    console.error(`Argus: model returned ${res.status}: ${detail}`);
    const message = res.status === 401 || res.status === 403
      ? "Ask Argus's API key was rejected: check ANTHROPIC_API_KEY in .env."
      : res.status === 429 || res.status === 529
        ? "The AI service is busy. Try again in a moment."
        : `The AI service returned an error: ${detail}`;
    throw new HTTPException(502, { message });
  }
  return payload as { content: ContentBlock[]; stop_reason: string };
}

/** Answer the transcript: call the model, run the tools it asks for, repeat (up to MAX_TOOL_ROUNDS). */
async function chat(apiKey: string, messages: ArgusMessage[], path: string, onStep: (step: ArgusStep) => void | Promise<void>) {
  const model = process.env.ARGUS_MODEL ?? "claude-sonnet-5-5";
  const system = await systemPrompt(path);
  const tools = Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, input_schema: t.input_schema }));
  const conversation = toApiMessages(messages);
  const steps: ArgusStep[] = [];
  const ctx: ToolContext = { proposals: [] };

  for (let round = 0; ; round++) {
    // The last round must answer in text
    const last = round === MAX_TOOL_ROUNDS - 1;
    const response = await callModel(apiKey, {
      model, max_tokens: 2048, system, tools, messages: conversation, ...(last ? { tool_choice: { type: "none" } } : {}),
    });
    const calls = response.content.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || !calls.length || last) {
      const reply = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n\n").trim();
      const result: ArgusChatResponse = { reply: reply || "I couldn't find an answer to that.", steps, proposals: ctx.proposals };
      return result;
    }
    conversation.push({ role: "assistant", content: response.content });
    const results: ContentBlock[] = [];
    for (const call of calls) {
      const step = { tool: call.name, label: TOOLS[call.name]?.label(call.input ?? {}) ?? call.name };
      steps.push(step);
      await onStep(step);
      const output = await runArgusTool(call.name, call.input);
      const isError = !!output && typeof output === "object" && "error" in output;
      results.push({ type: "tool_result", tool_use_id: call.id, content: capResult(output), ...(isError ? { is_error: true } : {}) });
    }
    conversation.push({ role: "user", content: results });
  }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

function parseRequest(body: unknown) {
  if (!body || typeof body !== "object") throw httpError(400, "Request body must be a JSON object");
  const { messages, path } = body as { messages?: unknown; path?: unknown };
  if (!Array.isArray(messages) || !messages.length) throw httpError(400, "messages must be a non-empty list");
  if (messages.length > ARGUS_LIMITS.messages) {
    throw httpError(400, `This conversation is too long (over ${ARGUS_LIMITS.messages} messages). Start a new chat.`);
  }
  const parsed: ArgusMessage[] = messages.map((m) => {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      throw httpError(400, "Each message needs a role (user or assistant) and text content");
    }
    if (m.content.length > ARGUS_LIMITS.chars) throw httpError(400, `Messages can be at most ${ARGUS_LIMITS.chars.toLocaleString("en-US")} characters`);
    return { role: m.role, content: m.content };
  });
  if (parsed[parsed.length - 1].role !== "user" || !parsed[parsed.length - 1].content.trim()) {
    throw httpError(400, "The last message must be the user's question");
  }
  const page = typeof path === "string" && path.startsWith("/") ? path.slice(0, 300) : "/";
  return { messages: parsed, path: page };
}

/**
 * Body: { messages: [{ role, content }], path }. Answers { reply, steps, proposals }; with
 * `Accept: application/x-ndjson`, streams each step as it runs, then the answer (ArgusStreamEvent per line).
 */
argus.post("/chat", async (c) => {
  const { messages, path } = parseRequest(await c.req.json().catch(() => null));
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return c.json({ error: NOT_SET_UP }, 503);

  if (!(c.req.header("accept") ?? "").includes("application/x-ndjson")) {
    return c.json(await chat(apiKey, messages, path, () => {}));
  }
  c.header("Content-Type", "application/x-ndjson; charset=utf-8");
  c.header("Cache-Control", "no-cache");
  return stream(c, async (s) => {
    const send = (event: ArgusStreamEvent) => s.write(`${JSON.stringify(event)}\n`);
    try {
      const result = await chat(apiKey, messages, path, (step) => send({ type: "step", step }).then(() => {}));
      await send({ type: "done", ...result });
    } catch (err) {
      if (!(err instanceof HTTPException)) console.error(err);
      await send(err instanceof HTTPException
        ? { type: "error", status: err.status, error: err.message }
        : { type: "error", status: 500, error: "Internal server error" });
    }
  });
});
