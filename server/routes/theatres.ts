import { Hono } from "hono";
import type pg from "pg";
import { query, transaction } from "../db";
import { CURRENT_USER, httpError, notFound } from "../http";
import { SCREEN_JSON, SCREEN_ORDER, saveScreen } from "./screens";
import { SYSTEM_NAME, theatreSystemName } from "../theatreSystems";
import { configurationsFor } from "./wtf";
import { LIVE_WIRE_AGENT, type ConfigFieldDef } from "../../src/data/agentConfigData";
import type { TheatreLiveWire } from "../../src/data/wtfData";
import {
  THEATRE_LISTINGS, type Company, type DashboardStats, type Screen, type Theatre, type TheatreMapping, type TheatreSystemOptions,
} from "../../src/types";
import type { WireTAPDevice } from "../../src/types/wireTAP";
import { formatTheatreAddress, theatreAlternateNames, type TheatreSummary } from "../../src/data/theatreSummary";
import {
  LISTING_NOT_SET, isTheatreSearchMode, isTheatreTagKind, searchTokens,
  type TheatreFacets, type TheatrePage, type TheatreSearchHit, type TheatreSearchMode, type TheatreTagKind,
} from "../../src/data/theatreSearch";

export const theatres = new Hono();

// ---------------------------------------------------------------------------
// Read shapes
// ---------------------------------------------------------------------------

/** Delivery / KDM form keys stored in theatres.delivery_settings. (Live Wire lives in the agent configurations.) */
const DELIVERY_KEYS = [
  "deliveryAddress", "deliveryInstructions", "deliveryTimeSlots", "dcpPhysicalDeliveryMethods",
  "dcpNetworkDeliveryMethods", "dcpModemDeliveryMethods", "dcpDeliveryContacts", "sendEmailsForDCPDelivery",
  "dcpContentTypesForEmail", "keyDeliveryContacts", "kdmDeliveryEmailsInFLMX", "autoIngestOfContentEnabled",
  "autoIngestContentTypes", "autoIngestTimeSlots", "kdmAutoIngestTimeSlots", "qcnTheatreIPAddressRange", "downloadRestrictionsEnabled", "downloadRestrictions",
] as const;

/** A theatre's TMS and ticketing system (from the Credentials Manager): id and name of each. */
const SYSTEM_COLUMNS = ([["TMS", "tmsId", "theatreManagementSystem"], ["Ticketing System", "ticketingSystemId", "ticketingSystem"]] as const)
  .map(([kind, idKey, nameKey]) => `
  (SELECT s.device_id FROM theatre_systems s WHERE s.theatre_id = t.id AND s.kind = '${kind}') AS "${idKey}",
  ${theatreSystemName(kind)} AS "${nameKey}"`).join(",");

const THEATRE_COLUMNS = `
  t.id, t.code, coalesce(t.name, '') AS name, coalesce(t.display_name, '') AS "displayName",
  t.alternate_names AS "alternateNames", coalesce(t.uuid, '') AS uuid, t.third_party_id AS "thirdPartyId",
  coalesce(t.chain_id, '') AS "chainId", coalesce(c.name, '') AS "chainName",
  coalesce(t.company_id, '') AS "companyId", coalesce(co.name, '') AS "companyName",
  t.exhibitor_integrator_companies AS "exhibitorIntegratorCompanies", t.listing, coalesce(t.type, '') AS type,
  coalesce(t.address, '') AS address, coalesce(t.city, '') AS city, coalesce(t.state, '') AS state,
  coalesce(t.country, '') AS country, t.city_id AS "cityId", coalesce(t.postal_code, '') AS "postalCode",
  coalesce(t.phone_number, '') AS "phoneNumber", coalesce(t.email, '') AS email, t.website, t.timezone,
  t.status, t.ad_integrators AS "adIntegrators", t.notes, t.closure_details AS "closureDetails",
  t.latitude, t.longitude, t.location_type AS "locationType",
  t.bike_parking_available AS "bikeParkingAvailable", t.bike_parking_capacity AS "bikeParkingCapacity",
  t.car_parking_available AS "carParkingAvailable", t.car_parking_capacity AS "carParkingCapacity",
  ${SYSTEM_COLUMNS},
  t.start_date AS "startDate", t.contact, t.configuration_notes AS "configurationNotes",
  t.delivery_settings AS "deliverySettings",
  t.created_at AS "createdAt", t.updated_at AS "updatedAt", t.created_by AS "createdBy", t.updated_by AS "updatedBy",
  (SELECT count(*) FROM screens s WHERE s.theatre_id = t.id AND s.status <> 'Deleted') AS "screenCount",
  coalesce((SELECT json_agg(json_build_object('id', m.id, 'domain', m.domain, 'theatreId', m.external_id)
                            ORDER BY m.domain, m.external_id)
            FROM theatre_mappings m WHERE m.theatre_id = t.id), '[]') AS "theatreMappings",
  coalesce((SELECT json_agg(json_build_object(
              'id', w.id, 'serialNumber', coalesce(w.application_serial_number, w.hardware_serial_number),
              'mappingStatus', w.mapping_status, 'theatreId', t.id, 'theatreName', t.name,
              'status', w.activation_status, 'createdAt', w.created_at, 'updatedAt', w.updated_at)
              ORDER BY w.application_serial_number)
            FROM wiretap_devices w WHERE w.theatre_id = t.id AND w.pull_out_status <> 'Pulled Out'), '[]') AS "wireTAPDevices"`;

const THEATRE_FROM = `FROM theatres t
  LEFT JOIN chains c ON c.id = t.chain_id
  LEFT JOIN companies co ON co.id = t.company_id`;

const SCREENS_COLUMN = `coalesce((SELECT json_agg(${SCREEN_JSON} ORDER BY ${SCREEN_ORDER})
  FROM screens s WHERE s.theatre_id = t.id), '[]') AS screens`;

type TheatreRow = Omit<Theatre, "deliveryAddress"> & { deliverySettings: Record<string, unknown>; code: string | null };

/** Spread delivery settings into the Theatre shape the form edits. */
const toTheatre = ({ deliverySettings, ...row }: TheatreRow) => ({ ...(deliverySettings ?? {}), ...row }) as Theatre;

async function loadTheatre(id: string, db: Pick<pg.PoolClient, "query"> | null = null) {
  const sql = `SELECT ${THEATRE_COLUMNS}, ${SCREENS_COLUMN} ${THEATRE_FROM} WHERE t.id = $1`;
  const rows = db ? (await db.query<TheatreRow>(sql, [id])).rows : await query<TheatreRow>(sql, [id]);
  return rows[0] ? toTheatre(rows[0]) : undefined;
}

// ---------------------------------------------------------------------------
// Validation / writes
// ---------------------------------------------------------------------------

const STATUSES = ["Active", "Inactive", "Closed"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Theatre form key → column, with a converter for the stored value. */
const SCALAR_FIELDS: Record<string, [column: string, convert?: (v: unknown) => unknown]> = {
  name: ["name"],
  displayName: ["display_name"],
  alternateNames: ["alternate_names", (v) => (Array.isArray(v) ? v.filter(Boolean).map(String) : [])],
  uuid: ["uuid"],
  thirdPartyId: ["third_party_id"],
  exhibitorIntegratorCompanies: ["exhibitor_integrator_companies", (v) => (Array.isArray(v) ? v.map(String) : [])],
  listing: ["listing"],
  type: ["type"],
  address: ["address"],
  city: ["city"],
  state: ["state"],
  country: ["country"],
  postalCode: ["postal_code"],
  phoneNumber: ["phone_number"],
  email: ["email"],
  website: ["website"],
  timezone: ["timezone"],
  status: ["status"],
  adIntegrators: ["ad_integrators", (v) => (Array.isArray(v) ? v.map(String) : [])],
  notes: ["notes"],
  closureDetails: ["closure_details"],
  latitude: ["latitude", (v) => (v === "" || v == null ? null : Number(v))],
  longitude: ["longitude", (v) => (v === "" || v == null ? null : Number(v))],
  locationType: ["location_type"],
  bikeParkingAvailable: ["bike_parking_available", (v) => (v == null ? null : !!v)],
  bikeParkingCapacity: ["bike_parking_capacity", (v) => (v === "" || v == null ? null : Number(v))],
  carParkingAvailable: ["car_parking_available", (v) => (v == null ? null : !!v)],
  carParkingCapacity: ["car_parking_capacity", (v) => (v === "" || v == null ? null : Number(v))],
  startDate: ["start_date"],
  contact: ["contact"],
  configurationNotes: ["configuration_notes"],
};

/** Empty strings become NULL for optional text columns (uuid must stay unique). */
const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

type TheatreInput = Partial<Theatre> & Record<string, unknown>;

function validate(body: TheatreInput, creating: boolean) {
  if (creating || "name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) throw httpError(400, "Theatre name is required");
  }
  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    throw httpError(400, `Status must be one of ${STATUSES.join(", ")}`);
  }
  if (body.listing != null && (body.listing as string) !== "" && !(THEATRE_LISTINGS as readonly string[]).includes(body.listing)) {
    throw httpError(400, `Listing must be ${THEATRE_LISTINGS.join(", ")}`);
  }
  if (body.email && !EMAIL.test(String(body.email))) throw httpError(400, `"${body.email}" is not a valid email address`);
  for (const key of ["latitude", "longitude", "bikeParkingCapacity", "carParkingCapacity"] as const) {
    const v = body[key];
    if (v !== undefined && v !== null && (v as unknown) !== "" && !Number.isFinite(Number(v))) {
      throw httpError(400, `${key} must be a number`);
    }
  }
}

const LOCATION_TEXT_KEYS = ["city", "state", "country", "timezone"];

/** The city a theatre is set to: undefined when not sent, null when cleared. */
async function resolveCity(client: pg.PoolClient, theatreId: string, cityId: unknown) {
  if (cityId === undefined) return undefined;
  if (cityId === null || cityId === "") return null;
  const { rows } = await client.query<{ id: string; name: string; province: string; country: string; timezone: string; is_deleted: boolean }>(
    `SELECT ci.id, ci.name, p.name AS province, c.name AS country, tz.name AS timezone, ci.is_deleted
     FROM cities ci JOIN provinces p ON p.id = ci.province_id JOIN countries c ON c.id = p.country_id
     JOIN timezones tz ON tz.id = ci.timezone_id WHERE ci.id = $1
     FOR SHARE OF ci`, [cityId]); // a concurrent city deactivation waits for this link
  const city = rows[0];
  if (!city) throw httpError(400, `City ${cityId} does not exist`);
  if (city.is_deleted) {
    const { rows: current } = await client.query("SELECT 1 FROM theatres WHERE id = $1 AND city_id = $2", [theatreId, cityId]);
    if (!current.length) throw httpError(400, `${city.name} is deactivated`);
  }
  return city;
}

async function resolveOrg(client: pg.PoolClient, table: "chains" | "companies", id: unknown) {
  if (id === undefined) return undefined;
  if (id === null || id === "") return null;
  const { rows } = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  if (rows.length === 0) throw httpError(400, `${table === "chains" ? "Chain" : "Company"} ${id} does not exist`);
  return id as string;
}

async function saveMappings(client: pg.PoolClient, theatreId: string, mappings: TheatreMapping[]) {
  if (!Array.isArray(mappings)) throw httpError(400, "theatreMappings must be an array");
  await client.query("DELETE FROM theatre_mappings WHERE theatre_id = $1", [theatreId]);
  const seen = new Set<string>();
  for (const m of mappings) {
    const domain = typeof m.domain === "string" ? m.domain.trim() : "";
    const externalId = typeof m.theatreId === "string" ? m.theatreId.trim() : "";
    if (!domain && !externalId) continue; // an "Add Identifier" row left blank
    if (!domain || !externalId) throw httpError(400, "Each third-party identifier needs a domain and an ID");
    const key = `${domain}\n${externalId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await client.query(
      "INSERT INTO theatre_mappings (id, theatre_id, domain, external_id) VALUES (coalesce($1, gen_random_uuid()::text), $2, $3, $4)",
      [m.id || null, theatreId, domain, externalId],
    );
  }
}

type LogEntry = { section: string; action: string; oldValue?: string | null; newValue?: string | null };

export async function writeLogs(client: pg.PoolClient, theatreId: string, entries: LogEntry[]) {
  for (const e of entries) {
    await client.query(
      `INSERT INTO theatre_logs (theatre_id, section, action, updated_by, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [theatreId, e.section, e.action, CURRENT_USER, e.oldValue ?? null, e.newValue ?? null],
    );
  }
}

const LOGGED_FIELDS: [key: keyof Theatre, section: string][] = [
  ["name", "General Information"], ["displayName", "General Information"], ["type", "General Information"],
  ["chainName", "General Information"], ["companyName", "General Information"], ["status", "General Information"],
  ["address", "Location & Systems"], ["city", "Location & Systems"], ["state", "Location & Systems"],
  ["country", "Location & Systems"], ["postalCode", "Location & Systems"], ["timezone", "Location & Systems"],
  ["theatreManagementSystem", "Location & Systems"], ["ticketingSystem", "Location & Systems"],
  ["phoneNumber", "Connectivity Details"], ["email", "Connectivity Details"], ["website", "Connectivity Details"],
  ["qcnTheatreIPAddressRange", "Content & Key Delivery"], ["kdmDeliveryEmailsInFLMX", "Content & Key Delivery"],
];

const show = (v: unknown) => (v === undefined || v === null || v === "" ? null : String(v));

/** Change-history entries between two versions of a theatre. */
function diffLogs(before: Theatre, after: Theatre): LogEntry[] {
  const logs: LogEntry[] = [];
  for (const [key, section] of LOGGED_FIELDS) {
    const [a, b] = [show(before[key]), show(after[key])];
    if (a !== b) logs.push({ section, action: "Updated", oldValue: a, newValue: b });
  }
  if ((before.listing ?? null) !== (after.listing ?? null)) {
    // Listed / Unlisted when the theatre enters or leaves the listings; Public ↔ Private is an update
    const action = after.listing === "Unlisted" ? "Unlisted" : before.listing === "Unlisted" || !before.listing ? "Listed" : "Updated";
    logs.push({ section: "General Information", action,
      oldValue: before.listing ?? null, newValue: after.listing ?? null });
  }
  const deliveryChanged = DELIVERY_KEYS.some((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null));
  if (deliveryChanged && !logs.some((l) => l.section === "Content & Key Delivery")) {
    logs.push({ section: "Content & Key Delivery", action: "Updated", newValue: "Delivery settings updated" });
  }
  const screens = (t: Theatre) => t.screens ?? [];
  const count = (t: Theatre) => screens(t).filter((s) => s.status !== "Deleted").length;
  const screenSig = (t: Theatre) => JSON.stringify(screens(t).map(({ devices, ipAddresses, suites, updatedAt, updatedBy, ...s }) => s));
  if (count(before) !== count(after)) {
    logs.push({ section: "Screen Management", action: "Updated", oldValue: `${count(before)} screens`, newValue: `${count(after)} screens` });
  } else if (screenSig(before) !== screenSig(after)) {
    logs.push({ section: "Screen Management", action: "Updated", newValue: "Screen details updated" });
  }
  const configSig = (t: Theatre) => JSON.stringify(screens(t).map((s) => [s.id, s.devices, s.ipAddresses, s.suites]));
  if (configSig(before) !== configSig(after)) {
    const devices = (t: Theatre) => screens(t).reduce((n, s) => n + s.devices.length, 0);
    logs.push({ section: "IP & Suites", action: "Updated",
      oldValue: `${devices(before)} devices`, newValue: `${devices(after)} devices` });
  }
  return logs;
}

/** Apply a (partial) theatre payload to `id` inside a transaction. */
async function applyTheatre(client: pg.PoolClient, id: string, body: TheatreInput) {
  const sets: string[] = [];
  const params: unknown[] = [id];
  const set = (column: string, value: unknown) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  // A theatre's city comes from Locations; its city, state, country and timezone text follow it
  const city = await resolveCity(client, id, body.cityId);
  if (city !== undefined) {
    set("city_id", city?.id ?? null);
    if (city) {
      set("city", city.name);
      set("state", city.province);
      set("country", city.country);
      set("timezone", city.timezone);
    }
  }

  for (const [key, [column, convert]] of Object.entries(SCALAR_FIELDS)) {
    if (!(key in body)) continue;
    if (city && LOCATION_TEXT_KEYS.includes(key)) continue;
    const raw = body[key];
    set(column, convert ? convert(raw) : key === "name" ? String(raw).trim() : blankToNull(raw));
  }
  const chainId = await resolveOrg(client, "chains", body.chainId);
  if (chainId !== undefined) set("chain_id", chainId);
  const companyId = await resolveOrg(client, "companies", body.companyId);
  if (companyId !== undefined) set("company_id", companyId);

  const delivery = Object.fromEntries(DELIVERY_KEYS.filter((k) => k in body).map((k) => [k, body[k]]));
  if (Object.keys(delivery).length > 0) {
    params.push(JSON.stringify(delivery));
    sets.push(`delivery_settings = delivery_settings || $${params.length}::jsonb`);
  }
  set("updated_by", CURRENT_USER);
  await client.query(`UPDATE theatres SET ${sets.join(", ")} WHERE id = $1`, params);

  if (body.theatreMappings !== undefined) await saveMappings(client, id, body.theatreMappings);
  await saveSystems(client, id, body);

  if (body.screens !== undefined) {
    if (!Array.isArray(body.screens)) throw httpError(400, "screens must be an array");
    const kept: string[] = [];
    for (const screen of body.screens as Screen[]) kept.push(await saveScreen(client, id, screen));
    await client.query("DELETE FROM screens WHERE theatre_id = $1 AND NOT (id = ANY($2))", [id, kept]);
  }
}

/**
 * The theatre's TMS (`tmsId`) and ticketing system (`ticketingSystemId`), from the Credentials Manager; blank
 * clears one. The TMS must be linked to the theatre's chain, so a wrong TMS can't be mapped: a newly chosen one is
 * checked, and so is the kept one whenever the chain is saved, since the chain may have changed.
 */
async function saveSystems(client: pg.PoolClient, theatreId: string, body: TheatreInput) {
  // Lock the chain first, as PUT /chains/:id/tms does, so its TMS links can't change during this save
  const { rows: [theatre] } = await client.query<{ chain_id: string | null }>(
    "SELECT chain_id FROM theatres WHERE id = $1", [theatreId]);
  const { rows: [chain] } = theatre.chain_id
    ? await client.query<{ name: string }>("SELECT name FROM chains WHERE id = $1 FOR SHARE", [theatre.chain_id])
    : { rows: [] as { name: string }[] };

  for (const [key, kind] of [["tmsId", "TMS"], ["ticketingSystemId", "Ticketing System"]] as const) {
    const chainSaved = kind === "TMS" && "chainId" in body;
    if (!(key in body) && !chainSaved) continue;
    const { rows: [current] } = await client.query<{ device_id: string }>(
      "SELECT device_id FROM theatre_systems WHERE theatre_id = $1 AND kind = $2 FOR UPDATE", [theatreId, kind]);
    const wanted = key in body ? (blankToNull(body[key]) as string | null) : current?.device_id ?? null;
    if (!wanted) {
      if (current) await client.query("DELETE FROM theatre_systems WHERE theatre_id = $1 AND kind = $2", [theatreId, kind]);
      continue;
    }
    const changed = wanted !== current?.device_id;
    if (!changed && !chainSaved) continue;
    const { rows: [device] } = await client.query<{ name: string }>(
      `SELECT ${SYSTEM_NAME} AS name FROM credential_devices d WHERE d.id = $1 AND d.type = $2 FOR SHARE`, [wanted, kind]);
    if (!device) throw httpError(400, `${wanted} isn't a ${kind} in the Credentials Manager`);
    if (kind === "TMS") {
      const fix = changed ? "Add it to the chain first." : "Choose one of the chain's TMSes, or None.";
      if (!chain) throw httpError(400, changed ? "Choose the theatre's chain before its TMS" : `The theatre needs a chain to keep its TMS (${device.name}). Choose a chain, or set the TMS to None.`);
      const { rows: [link] } = await client.query(
        "SELECT 1 FROM chain_tms WHERE chain_id = $1 AND device_id = $2", [theatre.chain_id, wanted]);
      if (!link) throw httpError(400, `${device.name} isn't linked to ${chain.name}. ${fix}`);
    }
    if (changed) {
      await client.query(
        `INSERT INTO theatre_systems (theatre_id, kind, device_id) VALUES ($1, $2, $3)
         ON CONFLICT (theatre_id, kind) DO UPDATE SET device_id = excluded.device_id`, [theatreId, kind, wanted]);
    }
  }
}

const uniqueViolation = (err: unknown) => (err as { code?: string }).code === "23505";

// ---------------------------------------------------------------------------
// Routes: lists and lookups
// ---------------------------------------------------------------------------

/** All theatres. `?include=screens` nests each theatre's screens. */
theatres.get("/", async (c) => {
  const withScreens = c.req.query("include") === "screens";
  const rows = await query<TheatreRow>(
    `SELECT ${THEATRE_COLUMNS}${withScreens ? `, ${SCREENS_COLUMN}` : ""} ${THEATRE_FROM}
     WHERE t.status <> 'Deleted' ORDER BY lower(t.name), t.id`,
  );
  return c.json(rows.map(toTheatre));
});

/**
 * Choices for the theatre form's TMS and Ticketing System dropdowns: the TMSes linked to `chainId` (none without
 * a chain) and every ticketing system.
 */
theatres.get("/systems", async (c) => {
  const chainId = c.req.query("chainId") || null;
  const rows = await query<{ kind: "TMS" | "Ticketing System"; id: string; name: string }>(
    `SELECT d.type AS kind, d.id, ${SYSTEM_NAME} AS name FROM credential_devices d
     WHERE d.type = 'Ticketing System'
        OR (d.type = 'TMS' AND EXISTS (SELECT 1 FROM chain_tms x WHERE x.device_id = d.id AND x.chain_id = $1))
     ORDER BY lower(d.brand), lower(d.model)`, [chainId]);
  const options: TheatreSystemOptions = {
    tms: rows.filter((r) => r.kind === "TMS").map(({ id, name }) => ({ id, name })),
    ticketing: rows.filter((r) => r.kind === "Ticketing System").map(({ id, name }) => ({ id, name })),
  };
  return c.json(options);
});

/** Companies for the theatre form's company picker. */
theatres.get("/companies", async (c) =>
  c.json(await query<Company>(`
    SELECT co.id, co.name, co.status, co.created_at AS "createdAt", co.updated_at AS "updatedAt",
           (SELECT count(*) FROM chains ch WHERE ch.company_id = co.id) AS "chainCount",
           (SELECT count(*) FROM theatres t WHERE t.company_id = co.id) AS "theatreCount"
    FROM companies co WHERE co.status <> 'Deleted' ORDER BY co.name`)),
);

/** Home dashboard numbers. */
theatres.get("/stats", async (c) => {
  const [totals] = await query<Omit<DashboardStats, "recentlyAddedTheatres" | "recentlyUpdatedTheatres" | "theatresByStatus" | "theatresByType">>(`
    SELECT (SELECT count(*) FROM theatres WHERE status <> 'Deleted') AS "totalTheatres",
           (SELECT count(*) FROM theatres WHERE status = 'Active') AS "activeTheatres",
           (SELECT count(*) FROM screens s JOIN theatres t ON t.id = s.theatre_id
             WHERE s.status <> 'Deleted' AND t.status <> 'Deleted') AS "totalScreens",
           (SELECT count(*) FROM screen_devices) AS "totalDevices",
           (SELECT count(*) FROM companies WHERE status <> 'Deleted') AS "totalCompanies",
           (SELECT count(*) FROM chains WHERE status <> 'Deleted') AS "totalChains"`);
  const theatresByStatus = await query<{ status: string; count: number }>(
    "SELECT status::text AS status, count(*) AS count FROM theatres GROUP BY status ORDER BY count DESC, status",
  );
  const theatresByType = await query<{ type: string; count: number }>(
    `SELECT coalesce(nullif(type, ''), 'Unspecified') AS type, count(*) AS count
     FROM theatres WHERE status <> 'Deleted' GROUP BY 1 ORDER BY count DESC, type`,
  );
  const recent = (order: string) =>
    query<TheatreRow>(`SELECT ${THEATRE_COLUMNS} ${THEATRE_FROM} WHERE t.status <> 'Deleted' ORDER BY ${order} DESC LIMIT 5`);
  const stats: DashboardStats = {
    ...totals,
    theatresByStatus,
    theatresByType,
    recentlyAddedTheatres: (await recent("t.created_at")).map(toTheatre),
    recentlyUpdatedTheatres: (await recent("t.updated_at")).map(toTheatre),
  };
  return c.json(stats);
});

// WireTAP devices, as the theatre edit page's "Qube Appliances" tab shows them.
const WIRETAP_COLUMNS = `
  d.id, d.hardware_serial_number AS "hardwareSerialNumber",
  coalesce(d.application_serial_number, '') AS "applicationSerialNumber",
  coalesce(d.host_name, '') AS "hostName", d.cluster_name AS "clusterName",
  coalesce(d.connectivity_type, '') AS "connectivityType", coalesce(d.isp_name, '') AS "ispName",
  coalesce(t.id, '') AS "theatreId", coalesce(t.name, '') AS "theatreName",
  coalesce(t.uuid, '') AS "theatreUUID", coalesce(t.address, '') AS "theatreAddress",
  coalesce(t.alternate_names, '{}') AS "theatreAlternateNames",
  coalesce(d.storage_capacity, '') AS "storageCapacity", coalesce(d.bandwidth, '') AS bandwidth,
  d.activation_status AS "activationStatus", d.mapping_status AS "mappingStatus",
  d.vpn_status AS "vpnStatus", d.appliance_type AS "wireTapApplianceType",
  d.pull_out_status AS "pullOutStatus", coalesce(d.updated_by, '') AS "updatedBy",
  d.updated_at AS "updatedAt"`;
const WIRETAP_FROM = "FROM wiretap_devices d LEFT JOIN theatres t ON t.id = d.theatre_id";

const WIRETAP_SEARCH_COLUMNS: Record<string, string> = {
  applicationSerialNumber: "d.application_serial_number",
  hardwareSerialNumber: "d.hardware_serial_number",
  hostName: "d.host_name",
};

/** Find a WireTAP device to add to a theatre. ?by=applicationSerialNumber|hardwareSerialNumber|hostName&q= */
theatres.get("/wiretap-devices/search", async (c) => {
  const column = WIRETAP_SEARCH_COLUMNS[c.req.query("by") ?? "applicationSerialNumber"];
  if (!column) throw httpError(400, "by must be applicationSerialNumber, hardwareSerialNumber or hostName");
  const q = (c.req.query("q") ?? "").trim();
  if (!q) throw httpError(400, "q is required");
  return c.json(await query<WireTAPDevice>(
    `SELECT ${WIRETAP_COLUMNS} ${WIRETAP_FROM} WHERE lower(${column}) = lower($1) ORDER BY d.id LIMIT 1`, [q],
  ));
});

/** Where each search mode looks: (theatre id, field label, value) for every searchable value. */
const SEARCH_SOURCES: Record<Exclude<TheatreSearchMode, "all">, string> = {
  theatre: `
    SELECT t.id, 'Name' AS label, t.name AS value FROM theatres t
    UNION ALL SELECT t.id, 'Display name', t.display_name FROM theatres t WHERE t.display_name <> ''
    UNION ALL SELECT t.id, 'Alternate name', a FROM theatres t, unnest(t.alternate_names) a
    UNION ALL SELECT t.id, 'Chain', ch.name FROM theatres t JOIN chains ch ON ch.id = t.chain_id
    UNION ALL SELECT t.id, 'Company', co.name FROM theatres t JOIN companies co ON co.id = t.company_id
    UNION ALL SELECT t.id, 'Address', concat_ws(', ', nullif(t.address, ''), nullif(t.city, ''), nullif(t.state, ''),
                                                 nullif(t.postal_code, ''), nullif(t.country, '')) FROM theatres t`,
  uuid: `SELECT t.id, 'UUID', t.uuid FROM theatres t WHERE t.uuid IS NOT NULL`,
  thirdParty: `SELECT m.theatre_id, 'Third-party ID', m.domain || ':' || m.external_id FROM theatre_mappings m`,
  device: `
    SELECT s.theatre_id, 'Device serial', sd.serial_number FROM screen_devices sd
      JOIN screens s ON s.id = sd.screen_id WHERE s.status <> 'Deleted'
    UNION ALL SELECT d.theatre_id, 'WireTAP ' || f.label || CASE WHEN d.pull_out_status = 'Pulled Out' THEN ' (pulled out)' ELSE '' END, f.value
      FROM wiretap_devices d, LATERAL (VALUES ('application serial', d.application_serial_number),
                                              ('hardware serial', d.hardware_serial_number),
                                              ('host name', d.host_name)) f(label, value)
      WHERE d.theatre_id IS NOT NULL AND f.value <> ''`,
};

/**
 * CTEs ending in `ranked(id, matched_field, matched_value, score)` for a theatre search, or null for a blank query.
 * A theatre scores the lengths of the distinct tokens it matches (longer, more specific tokens count for more), plus
 * a bonus when one field contains the whole query (1000) or equals it (2000). Appends its parameters to `params`.
 */
function rankedSearch(q: string, mode: TheatreSearchMode, params: unknown[]): string | null {
  const phrase = q.trim().toLowerCase().replace(/\s+/g, " ");
  if (!phrase) return null;
  params.push(searchTokens(phrase), phrase);
  const [$tokens, $phrase] = [`$${params.length - 1}`, `$${params.length}`];
  // Names and addresses match token by token; UUIDs, third-party IDs and serials only as the whole query, in every mode
  const modes = mode === "all" ? (Object.keys(SEARCH_SOURCES) as (keyof typeof SEARCH_SOURCES)[]) : [mode];
  const sources = modes
    .map((m) => `SELECT theatre_id, label, value, ${m !== "theatre"} AS whole FROM (${SEARCH_SOURCES[m]}) src(theatre_id, label, value)`)
    .join("\n    UNION ALL ");
  return `docs(theatre_id, label, value, whole) AS (${sources}),
     hits AS (
       SELECT d.theatre_id, d.label, d.value, tok,
              lower(d.value) = ${$phrase} AS exact, strpos(lower(d.value), ${$phrase}) > 0 AS phrase
       FROM docs d JOIN unnest(${$tokens}::text[]) tok ON NOT d.whole AND strpos(lower(d.value), tok) > 0
       UNION ALL
       SELECT d.theatre_id, d.label, d.value, ${$phrase}, lower(d.value) = ${$phrase}, true
       FROM docs d WHERE d.whole AND strpos(lower(d.value), ${$phrase}) > 0),
     scored AS (
       SELECT theatre_id, sum(length(tok)) AS token_score
       FROM (SELECT DISTINCT theatre_id, tok FROM hits) x GROUP BY theatre_id),
     -- The hit to show: exact, then whole-phrase, then longest-token matches first
     best AS (
       SELECT DISTINCT ON (theatre_id) theatre_id, label, value,
              bool_or(exact) OVER w AS any_exact, bool_or(phrase) OVER w AS any_phrase
       FROM hits WINDOW w AS (PARTITION BY theatre_id)
       ORDER BY theatre_id, exact DESC, phrase DESC, length(tok) DESC, label = 'Name' DESC),
     ranked AS (
       SELECT s.theatre_id AS id, b.label AS matched_field, b.value AS matched_value,
              (s.token_score + CASE WHEN b.any_exact THEN 2000 WHEN b.any_phrase THEN 1000 ELSE 0 END)::int AS score
       FROM scored s JOIN best b USING (theatre_id))`;
}

/** A positive whole-number query parameter, or `fallback` when it's absent. */
function positiveInt(name: string, raw: string | undefined, fallback: number) {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw httpError(400, `${name} must be a positive whole number`);
  return n;
}

const searchMode = (v: string | undefined): TheatreSearchMode => {
  const mode = v ?? "all";
  if (!isTheatreSearchMode(mode)) throw httpError(400, "mode must be all, theatre, uuid, thirdParty or device");
  return mode;
};

/** Ranked theatre search, best first (up to 500). ?q=&mode=all|theatre|uuid|thirdParty|device */
theatres.get("/search", async (c) => {
  const params: unknown[] = [];
  const ctes = rankedSearch(c.req.query("q") ?? "", searchMode(c.req.query("mode")), params);
  if (!ctes) return c.json([] as TheatreSearchHit[]);
  return c.json(await query<TheatreSearchHit>(
    `WITH ${ctes}
     SELECT r.id, r.matched_field AS "matchedField", r.matched_value AS "matchedValue", r.score
     FROM ranked r JOIN theatres t ON t.id = r.id AND t.status <> 'Deleted'
     ORDER BY r.score DESC, r.id LIMIT 500`,
    params,
  ));
});

/** Theatre List sort keys (the list's column accessors) and the SQL each sorts by. */
const LIST_SORTS: Record<string, string> = {
  name: "lower(t.name)",
  displayName: "lower(t.display_name)",
  chainName: "lower(c.name)",
  companyName: "lower(co.name)",
  address: "lower(concat_ws(', ', t.city, t.state, t.country))",
  status: "t.status",
  listing: "t.listing",
  adIntegrators: "lower(array_to_string(t.ad_integrators, ', '))",
  screenCount: "(SELECT count(*) FROM screens s WHERE s.theatre_id = t.id AND s.status <> 'Deleted')",
  updatedAt: "t.updated_at",
  updatedBy: "lower(t.updated_by)",
};

/** Tag kinds for the Theatre List's tag chips, and the condition each adds (`$v` is the tag's value). */
const TAG_CONDITIONS: Record<TheatreTagKind, (v: string) => string> = {
  chain: (v) => `c.name = ${v}`,
  city: (v) => `t.city = ${v}`,
  province: (v) => `t.state = ${v}`,
  country: (v) => `t.country = ${v}`,
  owner: (v) => `co.name = ${v}`,
  integrator: (v) => `${v} = ANY(t.exhibitor_integrator_companies)`,
  adIntegrator: (v) => `${v} = ANY(t.ad_integrators)`,
};

/**
 * One page of the Theatre List. ?page=&pageSize=&q=&mode=&sort=&dir=asc|desc, plus column filters (status, listing,
 * chain, company; "Not set" matches a blank listing) and tag chips (tag=kind:value, all must match). With a search
 * and no sort, the best matches come first, and each row says what matched.
 */
theatres.get("/page", async (c) => {
  const page = positiveInt("page", c.req.query("page"), 1);
  const pageSize = Math.min(1000, positiveInt("pageSize", c.req.query("pageSize"), 100));
  const params: unknown[] = [];
  const bind = (v: unknown) => { params.push(v); return `$${params.length}`; };

  const ctes = rankedSearch(c.req.query("q") ?? "", searchMode(c.req.query("mode")), params);
  const where = ["t.status <> 'Deleted'"];
  const oneOf = (name: string, column: string) => {
    const values = c.req.queries(name)?.filter(Boolean);
    if (values?.length) where.push(`${column} = ANY(${bind(values)})`);
  };
  oneOf("status", "t.status");
  oneOf("chain", "c.name");
  oneOf("company", "co.name");
  const listings = c.req.queries("listing")?.filter(Boolean);
  if (listings?.length) {
    where.push(`(t.listing = ANY(${bind(listings)})${listings.includes(LISTING_NOT_SET) ? " OR t.listing IS NULL" : ""})`);
  }
  for (const tag of c.req.queries("tag") ?? []) {
    const at = tag.indexOf(":");
    const kind = tag.slice(0, at);
    if (at < 1 || !isTheatreTagKind(kind)) throw httpError(400, `Unknown tag "${tag}"`);
    where.push(TAG_CONDITIONS[kind](bind(tag.slice(at + 1))));
  }

  const sort = c.req.query("sort");
  if (sort && !LIST_SORTS[sort]) throw httpError(400, `Can't sort by ${sort}`);
  const dir = c.req.query("dir") === "desc" ? "DESC" : "ASC";
  const order = [sort ? `${LIST_SORTS[sort]} ${dir} NULLS LAST` : ctes ? "r.score DESC" : "", "lower(t.name)", "t.id"].filter(Boolean);

  const from = `${THEATRE_FROM}${ctes ? " JOIN ranked r ON r.id = t.id" : ""} WHERE ${where.join(" AND ")}`;
  const withClause = ctes ? `WITH ${ctes} ` : "";
  const [{ total }] = await query<{ total: number }>(`${withClause}SELECT count(*)::int AS total ${from}`, params);
  const rows = await query<TheatreRow & { matchedField?: string; matchedValue?: string }>(
    `${withClause}SELECT ${THEATRE_COLUMNS}${ctes ? `, r.matched_field AS "matchedField", r.matched_value AS "matchedValue"` : ""}
     ${from} ORDER BY ${order.join(", ")} LIMIT ${bind(pageSize)} OFFSET ${bind((page - 1) * pageSize)}`,
    params,
  );
  const result: TheatrePage = {
    rows: rows.map(({ matchedField, matchedValue, ...row }) => ({
      ...toTheatre(row), ...(matchedField ? { match: { field: matchedField, value: matchedValue ?? "" } } : {}),
    })),
    total,
  };
  return c.json(result);
});

/** Filter options and tag chips for the Theatre List, with how many theatres each covers. */
theatres.get("/facets", async (c) => {
  const [facets] = await query<TheatreFacets>(`
    WITH live AS (SELECT t.*, c.name AS chain_name, co.name AS company_name ${THEATRE_FROM} WHERE t.status <> 'Deleted'),
    tags AS (
      SELECT id, 'chain' AS kind, chain_name AS value FROM live
      UNION ALL SELECT id, 'city', city FROM live
      UNION ALL SELECT id, 'province', state FROM live
      UNION ALL SELECT id, 'country', country FROM live
      UNION ALL SELECT id, 'owner', company_name FROM live
      UNION ALL SELECT id, 'integrator', unnest(exhibitor_integrator_companies) FROM live
      UNION ALL SELECT id, 'adIntegrator', unnest(ad_integrators) FROM live)
    SELECT
      (SELECT coalesce(json_agg(DISTINCT status), '[]') FROM live) AS statuses,
      (SELECT coalesce(json_agg(DISTINCT chain_name) FILTER (WHERE chain_name <> ''), '[]') FROM live) AS chains,
      (SELECT coalesce(json_agg(DISTINCT company_name) FILTER (WHERE company_name <> ''), '[]') FROM live) AS companies,
      (SELECT coalesce(json_agg(json_build_object('kind', kind, 'value', value, 'count', n) ORDER BY kind, lower(value)), '[]')
         FROM (SELECT kind, value, count(DISTINCT id)::int AS n FROM tags WHERE coalesce(value, '') <> '' GROUP BY 1, 2) x) AS tags`);
  return c.json(facets);
});

// ---------------------------------------------------------------------------
// Routes: one theatre
// ---------------------------------------------------------------------------

/** Identity for the theatre info hover card; `ref` is a theatre's id, code (e.g. T30000) or UUID. */
theatres.get("/:ref/summary", async (c) => {
  const [row] = await query<{
    id: string; name: string; display_name: string | null; alternate_names: string[]; uuid: string | null;
    address: string | null; city: string | null; state: string | null; postal_code: string | null; country: string | null;
  }>(
    `SELECT id, name, display_name, alternate_names, uuid, address, city, state, postal_code, country
     FROM theatres WHERE id = $1 OR code = $1 OR uuid = $1
     ORDER BY (id = $1) DESC LIMIT 1`,
    [c.req.param("ref")],
  );
  if (!row) throw notFound("Theatre");
  const summary: TheatreSummary = {
    id: row.id,
    name: row.name,
    alternateNames: theatreAlternateNames(row.name, row.display_name, row.alternate_names),
    uuid: row.uuid,
    address: formatTheatreAddress({ address: row.address, city: row.city, state: row.state, postalCode: row.postal_code, country: row.country }),
  };
  return c.json(summary);
});

theatres.get("/:id", async (c) => {
  const theatre = await loadTheatre(c.req.param("id"));
  if (!theatre) throw notFound("Theatre");
  return c.json(theatre);
});

/** Create a theatre (the Add Theatre dialog sends name/display name/address; the full form may send more). */
theatres.post("/", async (c) => {
  const body = await c.req.json<TheatreInput>();
  validate(body, true);
  try {
    const theatre = await transaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO theatres (name, uuid, listing, status, created_by, updated_by)
         VALUES ($1, coalesce($2, gen_random_uuid()::text), 'Listed - Public', 'Active', $3, $3) RETURNING id`,
        [String(body.name).trim(), blankToNull(body.uuid) ?? null, CURRENT_USER],
      );
      const id = rows[0].id;
      const { id: _ignored, uuid: _uuid, ...rest } = body;
      await applyTheatre(client, id, rest);
      await writeLogs(client, id, [{ section: "General Information", action: "Created", newValue: String(body.name).trim() }]);
      return loadTheatre(id, client);
    });
    return c.json(theatre, 201);
  } catch (err) {
    if (uniqueViolation(err)) throw httpError(409, "A theatre or screen with that UUID already exists");
    throw err;
  }
});

/** Save the theatre edit form (scalar fields, delivery settings, mappings, and screens when sent). */
theatres.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<TheatreInput>();
  validate(body, false);
  try {
    const theatre = await transaction(async (client) => {
      const before = await loadTheatre(id, client);
      if (!before) throw notFound("Theatre");
      await applyTheatre(client, id, body);
      const after = (await loadTheatre(id, client))!;
      await writeLogs(client, id, diffLogs(before, after));
      return after;
    });
    return c.json(theatre);
  } catch (err) {
    if (uniqueViolation(err)) throw httpError(409, "A theatre or screen with that UUID already exists");
    throw err;
  }
});

/** Activate / deactivate. Body: { status } */
theatres.patch("/:id/status", async (c) => {
  const id = c.req.param("id");
  const { status } = await c.req.json<{ status?: string }>();
  if (!status || !STATUSES.includes(status)) throw httpError(400, `Status must be one of ${STATUSES.join(", ")}`);
  const theatre = await transaction(async (client) => {
    const { rows } = await client.query<{ status: string }>("SELECT status FROM theatres WHERE id = $1 FOR UPDATE", [id]);
    if (rows.length === 0) throw notFound("Theatre");
    await client.query("UPDATE theatres SET status = $2, updated_by = $3 WHERE id = $1", [id, status, CURRENT_USER]);
    if (rows[0].status !== status) {
      await writeLogs(client, id, [{ section: "General Information", action: "Updated", oldValue: rows[0].status, newValue: status }]);
    }
    return loadTheatre(id, client);
  });
  return c.json(theatre);
});

theatres.delete("/:id", async (c) => {
  const rows = await query("DELETE FROM theatres WHERE id = $1 RETURNING id", [c.req.param("id")]);
  if (rows.length === 0) throw notFound("Theatre");
  return c.body(null, 204);
});

/** The Live Wire settings that apply at this theatre (theatre, else chain, else Global), read-only. */
theatres.get("/:id/livewire", async (c) => {
  const [t] = await query<{ name: string; chain: string | null }>(
    `SELECT t.name, c.name AS chain FROM theatres t LEFT JOIN chains c ON c.id = t.chain_id WHERE t.id = $1`,
    [c.req.param("id")]);
  if (!t) throw notFound("Theatre");
  const [agent] = await query<{ id: string; fields: ConfigFieldDef[] }>(
    "SELECT id, config_fields AS fields FROM fleet_images WHERE agent_os_name = $1 ORDER BY id LIMIT 1", [LIVE_WIRE_AGENT]);
  const result: TheatreLiveWire = agent
    ? { imageId: agent.id, configuration: (await configurationsFor([agent], t.chain ?? "", t.name)).get(agent.id) ?? [] }
    : { imageId: null, configuration: [] };
  return c.json(result);
});

/** Change history, newest first. */
theatres.get("/:id/logs", async (c) => {
  const id = c.req.param("id");
  const [exists] = await query("SELECT 1 FROM theatres WHERE id = $1", [id]);
  if (!exists) throw notFound("Theatre");
  return c.json(await query(
    `SELECT l.id::text AS id, l.logged_at AS date, l.section, l.action,
            json_build_object('name', l.updated_by) AS "updatedBy",
            l.old_value AS "oldValue", l.new_value AS "newValue"
     FROM theatre_logs l WHERE l.theatre_id = $1 ORDER BY l.logged_at DESC, l.id DESC`, [id],
  ));
});

/** WireTAP devices at this theatre, including pulled-out ones. */
theatres.get("/:id/wiretap-devices", async (c) => {
  const id = c.req.param("id");
  const [exists] = await query("SELECT 1 FROM theatres WHERE id = $1", [id]);
  if (!exists) throw notFound("Theatre");
  return c.json(await query<WireTAPDevice>(
    `SELECT ${WIRETAP_COLUMNS} ${WIRETAP_FROM} WHERE d.theatre_id = $1 ORDER BY d.application_serial_number`, [id],
  ));
});

/** Map a WireTAP device to this theatre. Body: { deviceId } */
theatres.post("/:id/wiretap-devices", async (c) => {
  const id = c.req.param("id");
  const { deviceId } = await c.req.json<{ deviceId?: string }>();
  if (!deviceId) throw httpError(400, "deviceId is required");
  await transaction(async (client) => {
    const { rows: t } = await client.query("SELECT 1 FROM theatres WHERE id = $1", [id]);
    if (t.length === 0) throw notFound("Theatre");
    const { rows } = await client.query<{ theatre_id: string | null; mapping_status: string; pull_out_status: string }>(
      "SELECT theatre_id, mapping_status, pull_out_status FROM wiretap_devices WHERE id = $1 FOR UPDATE", [deviceId],
    );
    if (rows.length === 0) throw notFound("WireTAP device");
    const d = rows[0];
    if (d.mapping_status === "Mapped" && d.theatre_id && d.theatre_id !== id && d.pull_out_status !== "Pulled Out") {
      throw httpError(409, "WireTAP is mapped to another theatre. Pull out the WireTAP before mapping.");
    }
    await client.query(
      `UPDATE wiretap_devices SET theatre_id = $2, mapping_status = 'Mapped', pull_out_status = 'Installed',
              pull_out_date = NULL, pull_out_reason = NULL, updated_by = $3 WHERE id = $1`,
      [deviceId, id, CURRENT_USER],
    );
  });
  const [device] = await query<WireTAPDevice>(`SELECT ${WIRETAP_COLUMNS} ${WIRETAP_FROM} WHERE d.id = $1`, [deviceId]);
  return c.json(device);
});

/** Pull a WireTAP device out of this theatre. Body: { reason, comments? } */
theatres.post("/:id/wiretap-devices/:deviceId/pull-out", async (c) => {
  const { id, deviceId } = c.req.param();
  const { reason, comments } = await c.req.json<{ reason?: string; comments?: string }>();
  if (!reason?.trim()) throw httpError(400, "A pull-out reason is required");
  const rows = await query(
    `UPDATE wiretap_devices SET pull_out_status = 'Pulled Out', mapping_status = 'Unmapped',
            pull_out_date = current_date, pull_out_reason = $3, updated_by = $4
     WHERE id = $1 AND theatre_id = $2 AND pull_out_status <> 'Pulled Out' RETURNING id`,
    [deviceId, id, comments?.trim() ? `${reason.trim()}: ${comments.trim()}` : reason.trim(), CURRENT_USER],
  );
  if (rows.length === 0) throw notFound("Installed WireTAP device at this theatre");
  const [device] = await query<WireTAPDevice>(`SELECT ${WIRETAP_COLUMNS} ${WIRETAP_FROM} WHERE d.id = $1`, [deviceId]);
  return c.json(device);
});
