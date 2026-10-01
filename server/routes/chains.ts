import { Hono, type Context } from "hono";
import type pg from "pg";
import { query, transaction } from "../db";
import { CURRENT_USER, httpError, notFound } from "../http";
import { CHAIN_SYSTEMS, SYSTEM_NAME, type SystemKind } from "../theatreSystems";
import { CREDENTIAL_COLUMNS, toCredential, type CredentialRow } from "./credentials";
import type { Chain } from "../../src/types";
import { GLOBAL_REF, type CredentialDeviceWithStatus } from "../../src/data/credentialsManagerData";
import {
  chainFormErrors, cleanChainInput, formatPhone,
  type CallingCode, type ChainDetails, type ChainDetailsInput, type ChainDeviceCredentials, type ChainLogEntry,
  type ChainOwner, type ChainPhone, type ChainSystems, type ChainTheatre,
} from "../../src/data/chainDetails";

export const chains = new Hono();

export const CHAIN_SELECT = `
  SELECT c.id, c.name, c.company_id AS "companyId", co.name AS "companyName",
         (SELECT count(*) FROM theatres t WHERE t.chain_id = c.id AND t.status <> 'Deleted') AS "theatreCount",
         c.status, c.created_at AS "createdAt", c.updated_at AS "updatedAt",
         coalesce((SELECT json_agg(json_build_object('id', d.id, 'name', ${SYSTEM_NAME}) ORDER BY lower(d.brand), lower(d.model))
                   FROM chain_tms x JOIN credential_devices d ON d.id = x.device_id WHERE x.chain_id = c.id), '[]') AS tms,
         coalesce((SELECT json_agg(json_build_object('id', d.id, 'name', ${SYSTEM_NAME}) ORDER BY lower(d.brand), lower(d.model))
                   FROM chain_ticketing_systems x JOIN credential_devices d ON d.id = x.device_id WHERE x.chain_id = c.id),
                  '[]') AS "ticketingSystems"
  FROM chains c LEFT JOIN companies co ON co.id = c.company_id`;

/** CHAIN_SELECT plus the Basic and Contact Information the Edit Chain page edits. */
export const CHAIN_DETAILS_SELECT = CHAIN_SELECT.replace("FROM chains c", `,
         coalesce(c.display_name, '') AS "displayName", c.city_id AS "cityId",
         (SELECT ci.name || ', ' || p.name || ', ' || co2.name FROM cities ci
            JOIN provinces p ON p.id = ci.province_id JOIN countries co2 ON co2.id = p.country_id
           WHERE ci.id = c.city_id) AS "cityLabel",
         coalesce(c.postal_code, '') AS "postalCode", coalesce(c.area, '') AS area,
         coalesce(c.head_office_address, '') AS "headOfficeAddress", c.emails, c.phones, c.owners
  FROM chains c`);

chains.get("/", async (c) => c.json(await query<Chain>(`${CHAIN_SELECT} WHERE c.status <> 'Deleted' ORDER BY c.name`)));

/** Dialling codes for the phone fields: each countries.calling_code, with the countries using it. */
export async function callingCodes(db: Pick<pg.PoolClient, "query"> | null = null) {
  const sql = `SELECT calling_code AS code, array_agg(iso3166_2 ORDER BY iso3166_2) AS countries
               FROM countries WHERE NOT is_deleted AND calling_code IS NOT NULL
               GROUP BY calling_code ORDER BY calling_code::int`;
  return db ? (await db.query<CallingCode>(sql)).rows : query<CallingCode>(sql);
}

chains.get("/calling-codes", async (c) => c.json(await callingCodes()));

/** A chain that isn't Deleted, or 404. */
async function liveChain(id: string) {
  const [row] = await query<ChainDetails>(`${CHAIN_DETAILS_SELECT} WHERE c.id = $1 AND c.status <> 'Deleted'`, [id]);
  if (!row) throw notFound("Chain");
  return row;
}

/** Lock chain `id` for an edit: 404 when unknown, 409 when Deleted. */
async function lockChain(client: pg.PoolClient, id: string) {
  const { rows: [row] } = await client.query<{ name: string; status: string }>(
    "SELECT name, status FROM chains WHERE id = $1 FOR UPDATE", [id]);
  if (!row) throw notFound("Chain");
  if (row.status === "Deleted") throw httpError(409, "This chain is deleted and can't be edited");
  return row;
}

chains.get("/:id", async (c) => c.json(await liveChain(c.req.param("id"))));

chains.delete("/:id", async (c) => {
  const rows = await query("DELETE FROM chains WHERE id = $1 RETURNING id", [c.req.param("id")]);
  if (rows.length === 0) throw notFound("Chain");
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// Basic and Contact Information
// ---------------------------------------------------------------------------

type LogEntry = { section: ChainLogEntry["section"]; field: string | null; oldValue: string | null; newValue: string | null };

async function writeLogs(client: pg.PoolClient, chainId: string, entries: LogEntry[]) {
  for (const e of entries) {
    await client.query(
      `INSERT INTO chain_logs (chain_id, section, action, field, old_value, new_value, updated_by)
       VALUES ($1, $2, 'Updated', $3, $4, $5, $6)`,
      [chainId, e.section, e.field, e.oldValue, e.newValue, CURRENT_USER]);
  }
}

const show = (v: string | null | undefined) => (v ? v : null);
const showPhones = (phones: ChainPhone[]) => show(phones.map((p) => formatPhone(p.countryCode, p.number)).join(", "));
const showOwners = (owners: ChainOwner[]) =>
  show(owners.map((o) => (o.phone ? `${o.name} (${formatPhone(o.countryCode, o.phone)})` : o.name)).join(", "));

/** The logged fields: label, section and how the value reads in the log. */
const LOGGED_FIELDS: [label: string, section: string, read: (c: ChainDetails) => string | null][] = [
  ["Chain Name", "Basic Information", (c) => show(c.name)],
  ["Display Name", "Basic Information", (c) => show(c.displayName)],
  ["City", "Basic Information", (c) => show(c.cityLabel)],
  ["Postal Code", "Basic Information", (c) => show(c.postalCode)],
  ["Area", "Basic Information", (c) => show(c.area)],
  ["Head Office Address", "Basic Information", (c) => show(c.headOfficeAddress)],
  ["Official Emails", "Contact Information", (c) => show(c.emails.join(", "))],
  ["Registered Phone Numbers", "Contact Information", (c) => showPhones(c.phones)],
  ["Owners", "Contact Information", (c) => showOwners(c.owners)],
];

/** Read the body into form input; wrong types are a 400, never silently dropped. */
function parseDetails(body: unknown): ChainDetailsInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw httpError(400, "Request body must be a JSON object");
  const b = body as Record<string, unknown>;
  const text = (key: string, label: string) => {
    const v = b[key];
    if (v === undefined || v === null) return "";
    if (typeof v !== "string") throw httpError(400, `${label} must be text`);
    return v;
  };
  const rows = <T>(key: string, label: string, fields: (keyof T & string)[]): T[] => {
    const v = b[key];
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v) || !v.every((r) => r && typeof r === "object" && !Array.isArray(r) && fields.every((f) => r[f] == null || typeof r[f] === "string"))) {
      throw httpError(400, `${label} must be a list of { ${fields.join(", ")} }`);
    }
    return v.map((r) => Object.fromEntries(fields.map((f) => [f, r[f] ?? ""])) as T);
  };
  const emails = b.emails ?? [];
  if (!Array.isArray(emails) || !emails.every((e) => typeof e === "string")) throw httpError(400, "emails must be a list of strings");
  return {
    name: text("name", "Chain name"),
    displayName: text("displayName", "Display name"),
    cityId: text("cityId", "City") || null,
    postalCode: text("postalCode", "Postal code"),
    area: text("area", "Area"),
    headOfficeAddress: text("headOfficeAddress", "Head office address"),
    emails,
    phones: rows<ChainPhone>("phones", "phones", ["countryCode", "number"]),
    owners: rows<ChainOwner>("owners", "owners", ["name", "countryCode", "phone"]),
  };
}

const ERROR_LABELS: [prefix: string, label: string][] = [["emails.", "Official email"], ["phones.", "Registered phone"], ["owners.", "Owner"]];

/** A field error as one sentence, e.g. "Registered phone 2: Use digits, spaces and + - ( ) only". */
function describeError(key: string, message: string) {
  const row = ERROR_LABELS.find(([prefix]) => key.startsWith(prefix));
  return row ? `${row[1]} ${Number(key.split(".")[1]) + 1}: ${message}` : message;
}

const isUniqueViolation = (err: unknown) => (err as pg.DatabaseError)?.code === "23505";

/**
 * Save Basic and Contact Information. Body: ChainDetailsInput. Logs one entry per changed field. A rename also
 * moves the chain's credentials and agent configurations, which reference the chain by name.
 */
chains.put("/:id", async (c) => {
  const id = c.req.param("id");
  const raw = parseDetails(await c.req.json().catch(() => null));
  const chain = await transaction(async (client) => {
    const current = await lockChain(client, id);
    const codes = (await callingCodes(client)).map((r) => r.code);
    const errors = Object.entries(chainFormErrors(raw, codes));
    if (errors.length) throw httpError(400, describeError(...errors[0]));
    const input = cleanChainInput(raw);

    const { rows: [city] } = await client.query<{ is_deleted: boolean }>(
      "SELECT is_deleted FROM cities WHERE id = $1 FOR SHARE", [input.cityId]);
    if (!city) throw httpError(400, `City ${input.cityId} does not exist`);
    const { rows: [before] } = await client.query<ChainDetails>(`${CHAIN_DETAILS_SELECT} WHERE c.id = $1`, [id]);
    if (city.is_deleted && before.cityId !== input.cityId) throw httpError(400, "That city is deactivated in Locations");

    const { rows: taken } = await client.query(
      "SELECT 1 FROM chains WHERE lower(name) = lower($1) AND id <> $2 AND status <> 'Deleted'", [input.name, id]);
    if (taken.length) throw httpError(409, `Another chain is already named "${input.name}"`);

    try {
      await client.query(
        `UPDATE chains SET name = $2, display_name = $3, city_id = $4, postal_code = $5, area = $6,
           head_office_address = $7, emails = $8, phones = $9, owners = $10, updated_by = $11 WHERE id = $1`,
        [id, input.name, input.displayName || null, input.cityId, input.postalCode || null, input.area || null,
         input.headOfficeAddress || null, input.emails, JSON.stringify(input.phones), JSON.stringify(input.owners), CURRENT_USER]);
      if (input.name !== current.name) {
        for (const table of ["device_credentials", "agent_configurations"]) {
          await client.query(`UPDATE ${table} SET ref = $2 WHERE scope = 'chain' AND ref = $1`, [current.name, input.name]);
        }
      }
    } catch (err) {
      // chains.name is unique across every chain, Deleted ones included; credentials are unique per ref
      if (isUniqueViolation(err)) {
        throw httpError(409, (err as pg.DatabaseError).constraint === "chains_name_key"
          ? `A deleted chain is still named "${input.name}". Choose another name.`
          : `Credentials or agent configurations already exist for a chain named "${input.name}". Choose another name.`);
      }
      throw err;
    }

    const { rows: [after] } = await client.query<ChainDetails>(`${CHAIN_DETAILS_SELECT} WHERE c.id = $1`, [id]);
    await writeLogs(client, id, LOGGED_FIELDS
      .map(([field, section, read]) => ({ section, field, oldValue: read(before), newValue: read(after) }))
      .filter((e) => e.oldValue !== e.newValue));
    return after;
  });
  return c.json(chain);
});

// ---------------------------------------------------------------------------
// Theatre Systems
// ---------------------------------------------------------------------------

/**
 * Replace the TMSes (or ticketing systems) a chain's theatres may use: Credentials Manager entries of that type.
 * Body: { deviceIds }. One still used by one of the chain's theatres can't be removed.
 */
const putChainSystems = (kind: SystemKind) => async (c: Context) => {
  const id = c.req.param("id");
  const { table, label, noun } = CHAIN_SYSTEMS[kind];
  const listKey = kind === "TMS" ? "tms" : "ticketingSystems";
  const body = await c.req.json<{ deviceIds?: unknown }>();
  if (!Array.isArray(body.deviceIds) || !body.deviceIds.every((d) => typeof d === "string")) {
    throw httpError(400, `deviceIds must be a list of ${noun} ids`);
  }
  const deviceIds = [...new Set(body.deviceIds as string[])];
  const chain = await transaction(async (client) => {
    await lockChain(client, id);
    const { rows: found } = await client.query<{ id: string }>(
      "SELECT id FROM credential_devices WHERE id = ANY($1) AND type = $2 FOR SHARE", [deviceIds, kind]);
    const unknown = deviceIds.filter((d) => !found.some((f) => f.id === d));
    if (unknown.length) throw httpError(400, `Not a ${noun} in the Credentials Manager: ${unknown.join(", ")}`);
    const { rows: inUse } = await client.query<{ name: string; theatres: number }>(
      `SELECT ${SYSTEM_NAME} AS name, count(*)::int AS theatres
       FROM theatre_systems s JOIN theatres t ON t.id = s.theatre_id JOIN credential_devices d ON d.id = s.device_id
       WHERE s.kind = $3 AND t.chain_id = $1 AND NOT (s.device_id = ANY($2)) GROUP BY d.id`, [id, deviceIds, kind]);
    if (inUse.length) {
      throw httpError(409, `Still in use by this chain's theatres: ${inUse.map((u) => `${u.name} (${u.theatres})`).join(", ")}. Change those theatres first.`);
    }
    // Logged when the set of linked ids changes; the names are only what the log shows
    const linked = async () => (await client.query<Chain>(`${CHAIN_SELECT} WHERE c.id = $1`, [id])).rows[0][listKey] ?? [];
    const ids = (list: { id: string }[]) => list.map((t) => t.id).sort().join(",");
    const names = (list: { name: string }[]) => list.map((t) => t.name).join(", ") || null;
    const before = await linked();
    await client.query(`DELETE FROM ${table} WHERE chain_id = $1 AND NOT (device_id = ANY($2))`, [id, deviceIds]);
    await client.query(
      `INSERT INTO ${table} (chain_id, device_id, updated_by) SELECT $1, unnest($2::text[]), $3 ON CONFLICT DO NOTHING`,
      [id, deviceIds, CURRENT_USER]);
    await client.query("UPDATE chains SET updated_by = $2 WHERE id = $1", [id, CURRENT_USER]);
    const after = await linked();
    if (ids(before) !== ids(after)) {
      await writeLogs(client, id, [{ section: "Theatre Systems", field: label, oldValue: names(before), newValue: names(after) }]);
    }
    const { rows: [updated] } = await client.query<Chain>(`${CHAIN_SELECT} WHERE c.id = $1`, [id]);
    return updated;
  });
  return c.json(chain);
};

chains.put("/:id/tms", putChainSystems("TMS"));
chains.put("/:id/ticketing-systems", putChainSystems("Ticketing System"));

/** A chain's official FLM providers, by name. */
export const flmSubscriptionsOf = async (db: Pick<pg.PoolClient, "query">, chainId: string) =>
  (await db.query<{ id: string; name: string }>(
    `SELECT p.id, p.name FROM chain_flm_subscriptions s JOIN flm_providers p ON p.id = s.provider_id
     WHERE s.chain_id = $1 ORDER BY lower(p.name)`, [chainId])).rows;

/**
 * Replace a chain's official FLM providers. Body: { providerIds }. Usually one or none, but several are allowed;
 * nothing else references them, so any can be removed.
 */
chains.put("/:id/flm-subscriptions", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ providerIds?: unknown }>();
  if (!Array.isArray(body.providerIds) || !body.providerIds.every((d) => typeof d === "string")) {
    throw httpError(400, "providerIds must be a list of FLM provider ids");
  }
  const providerIds = [...new Set(body.providerIds as string[])];
  const flmSubscriptions = await transaction(async (client) => {
    await lockChain(client, id);
    const { rows: found } = await client.query<{ id: string }>(
      "SELECT id FROM flm_providers WHERE id = ANY($1) FOR SHARE", [providerIds]);
    const unknown = providerIds.filter((p) => !found.some((f) => f.id === p));
    if (unknown.length) throw httpError(400, `Not an FLM provider: ${unknown.join(", ")}`);
    const before = await flmSubscriptionsOf(client, id);
    await client.query("DELETE FROM chain_flm_subscriptions WHERE chain_id = $1 AND NOT (provider_id = ANY($2))", [id, providerIds]);
    await client.query(
      `INSERT INTO chain_flm_subscriptions (chain_id, provider_id, updated_by)
       SELECT $1, unnest($2::text[]), $3 ON CONFLICT DO NOTHING`, [id, providerIds, CURRENT_USER]);
    await client.query("UPDATE chains SET updated_by = $2 WHERE id = $1", [id, CURRENT_USER]);
    const after = await flmSubscriptionsOf(client, id);
    const names = (list: { name: string }[]) => list.map((p) => p.name).join(", ") || null;
    if (names(before) !== names(after)) {
      await writeLogs(client, id, [{ section: "Theatre Systems", field: "FLM Subscriptions", oldValue: names(before), newValue: names(after) }]);
    }
    return after;
  });
  return c.json({ flmSubscriptions });
});

/** The chain's theatres that aren't Deleted, as a CTE. */
const CHAIN_THEATRES = "chain_theatres AS (SELECT * FROM theatres WHERE chain_id = $1 AND status <> 'Deleted')";

/** Delivery methods of theatre `t` stored under `key` in delivery_settings, as rows `m` (non-arrays read as none). */
const deliveryRows = (key: string) =>
  `jsonb_array_elements(CASE WHEN jsonb_typeof(t.delivery_settings->'${key}') = 'array' THEN t.delivery_settings->'${key}' ELSE '[]' END) m`;

/** TMSes, ticketing systems and content delivery modes across the chain's theatres, with theatre counts. */
chains.get("/:id/systems", async (c) => {
  const chain = await liveChain(c.req.param("id"));
  const systemCounts = (kind: string) => query<ChainSystems["ticketingInUse"][number]>(
    `WITH ${CHAIN_THEATRES}
     SELECT d.id, ${SYSTEM_NAME} AS name, count(*)::int AS theatres
     FROM chain_theatres t JOIN theatre_systems s ON s.theatre_id = t.id AND s.kind = $2
     JOIN credential_devices d ON d.id = s.device_id
     GROUP BY d.id ORDER BY count(*) DESC, lower(${SYSTEM_NAME})`, [chain.id, kind]);
  const without = async (kind: string) => (await query<{ n: number }>(
    `WITH ${CHAIN_THEATRES} SELECT count(*)::int AS n FROM chain_theatres t
     WHERE NOT EXISTS (SELECT 1 FROM theatre_systems s WHERE s.theatre_id = t.id AND s.kind = $2)`, [chain.id, kind]))[0].n;
  const [tmsInUse, theatresWithoutTms, ticketingInUse, theatresWithoutTicketing, deliveryModes, flmSubscriptions, flmProviders] = await Promise.all([
    systemCounts("TMS"), without("TMS"), systemCounts("Ticketing System"), without("Ticketing System"),
    query<ChainSystems["deliveryModes"][number]>(
      `WITH ${CHAIN_THEATRES}, methods AS (
         SELECT t.id, 'Physical' AS mode, coalesce(nullif(trim(m->>'mediaType'), ''), 'Not specified') AS method
         FROM chain_theatres t, ${deliveryRows("dcpPhysicalDeliveryMethods")}
         UNION ALL
         SELECT t.id, 'Network', coalesce(nullif(trim(m->>'networkURL'), ''), 'Not specified')
         FROM chain_theatres t, ${deliveryRows("dcpNetworkDeliveryMethods")}
         UNION ALL
         SELECT t.id, 'Modem', 'Modem' FROM chain_theatres t, ${deliveryRows("dcpModemDeliveryMethods")})
       SELECT mode, method, count(DISTINCT id)::int AS theatres FROM methods
       GROUP BY mode, method ORDER BY array_position(ARRAY['Physical', 'Network', 'Modem'], mode), count(DISTINCT id) DESC, method`,
      [chain.id]),
    query<ChainSystems["flmSubscriptions"][number]>(
      `WITH ${CHAIN_THEATRES}
       SELECT p.id, p.name, (SELECT count(*)::int FROM flm_feeds f JOIN chain_theatres t ON t.id = f.mapped_theatre_id
                             WHERE f.source = p.name) AS "feedsReceived"
       FROM chain_flm_subscriptions s JOIN flm_providers p ON p.id = s.provider_id
       WHERE s.chain_id = $1 ORDER BY lower(p.name)`, [chain.id]),
    query<ChainSystems["flmProviders"][number]>("SELECT id, name FROM flm_providers ORDER BY lower(name)"),
  ]);
  const allowed = new Set((chain.tms ?? []).map((t) => t.id));
  const allowedTicketing = new Set((chain.ticketingSystems ?? []).map((t) => t.id));
  const result: ChainSystems = {
    tms: chain.tms ?? [],
    ticketingSystems: chain.ticketingSystems ?? [],
    theatreCount: chain.theatreCount,
    tmsInUse: tmsInUse.map((t) => ({ ...t, allowed: allowed.has(t.id) })),
    theatresWithoutTms,
    ticketingInUse: ticketingInUse.map((t) => ({ ...t, allowed: allowedTicketing.has(t.id) })),
    theatresWithoutTicketing,
    deliveryModes,
    flmSubscriptions,
    flmProviders,
  };
  return c.json(result);
});

// ---------------------------------------------------------------------------
// Device Credentials, Theatre List, Logs
// ---------------------------------------------------------------------------

/**
 * Device models used across the chain: screen devices matched to Credentials Manager models by brand
 * (manufacturer) and model, ignoring case, plus the theatres' TMS and ticketing systems and any model with chain
 * credentials for this chain. Each comes with the
 * credentials that apply to the chain: chain scope for this chain, theatre scope for its theatres, and global ones
 * ("Global" or a country of its theatres). Masked values are withheld as in the Credentials Manager.
 */
chains.get("/:id/device-credentials", async (c) => {
  const chain = await liveChain(c.req.param("id"));
  const screenModels = await query<{ deviceId: string | null; brand: string; model: string; theatres: number; screens: number }>(
    `WITH ${CHAIN_THEATRES}
     SELECT d.id AS "deviceId", coalesce(d.brand, min(sd.manufacturer)) AS brand, coalesce(d.model, min(sd.model)) AS model,
            count(DISTINCT t.id)::int AS theatres, count(DISTINCT s.id)::int AS screens
     FROM chain_theatres t JOIN screens s ON s.theatre_id = t.id AND s.status <> 'Deleted'
     JOIN screen_devices sd ON sd.screen_id = s.id
     LEFT JOIN credential_devices d ON lower(d.brand) = lower(trim(sd.manufacturer)) AND lower(d.model) = lower(trim(sd.model))
     WHERE trim(sd.manufacturer) <> '' OR trim(sd.model) <> ''
     GROUP BY d.id, CASE WHEN d.id IS NULL THEN lower(trim(sd.manufacturer)) END, CASE WHEN d.id IS NULL THEN lower(trim(sd.model)) END
     ORDER BY lower(coalesce(d.brand, min(sd.manufacturer))), lower(coalesce(d.model, min(sd.model)))`, [chain.id]);
  const systems = await query<{ deviceId: string; theatres: number }>(
    `WITH ${CHAIN_THEATRES}
     SELECT s.device_id AS "deviceId", count(DISTINCT t.id)::int AS theatres
     FROM chain_theatres t JOIN theatre_systems s ON s.theatre_id = t.id GROUP BY s.device_id`, [chain.id]);

  const usage = new Map<string, { theatres: number; screens: number | null }>();
  for (const m of screenModels) if (m.deviceId) usage.set(m.deviceId, { theatres: m.theatres, screens: m.screens });
  for (const s of systems) if (!usage.has(s.deviceId)) usage.set(s.deviceId, { theatres: s.theatres, screens: null });
  // Models with credentials for this chain are listed even when no theatre has one (yet)
  const withChainCredentials = await query<{ deviceId: string }>(
    `SELECT DISTINCT device_id AS "deviceId" FROM device_credentials WHERE scope = 'chain' AND ref = $1`, [chain.name]);
  for (const d of withChainCredentials) if (!usage.has(d.deviceId)) usage.set(d.deviceId, { theatres: 0, screens: 0 });
  const ids = [...usage.keys()];

  const [devices, rows] = await Promise.all([
    query<Pick<CredentialDeviceWithStatus, "id" | "brand" | "model" | "type" | "credentialFields">>(
      `SELECT id, brand, model, type, credential_fields AS "credentialFields" FROM credential_devices
       WHERE id = ANY($1) ORDER BY lower(brand), lower(model)`, [ids]),
    query<CredentialRow>(
      `WITH ${CHAIN_THEATRES}
       SELECT ${CREDENTIAL_COLUMNS} FROM device_credentials
       WHERE device_id = ANY($2) AND (
         (scope = 'chain' AND ref = $3)
         OR (scope = 'theatre' AND ref IN (SELECT name FROM chain_theatres))
         OR (scope = 'global' AND (ref = $4 OR ref IN (SELECT country FROM chain_theatres))))
       ORDER BY array_position(ARRAY['chain', 'theatre', 'global'], scope), ref = $4 DESC, lower(ref)`,
      [chain.id, ids, chain.name, GLOBAL_REF]),
  ]);
  const result: ChainDeviceCredentials = {
    models: devices.map((device) => ({
      device,
      ...usage.get(device.id)!,
      credentials: rows.filter((r) => r.deviceId === device.id).map((r) => toCredential(r, device.credentialFields)),
    })),
    unmatched: screenModels.filter((m) => !m.deviceId).map(({ brand, model, theatres, screens }) => ({ brand, model, theatres, screens })),
  };
  return c.json(result);
});

chains.get("/:id/theatres", async (c) => {
  const chain = await liveChain(c.req.param("id"));
  return c.json(await query<ChainTheatre>(
    `SELECT t.id, coalesce(t.name, '') AS name, coalesce(t.city, '') AS city, coalesce(t.state, '') AS state,
            coalesce(t.country, '') AS country, t.status,
            (SELECT count(*) FROM screens s WHERE s.theatre_id = t.id AND s.status <> 'Deleted') AS "screenCount"
     FROM theatres t WHERE t.chain_id = $1 AND t.status <> 'Deleted' ORDER BY lower(t.name), t.id`, [chain.id]));
});

/** Change history, newest first. */
chains.get("/:id/logs", async (c) => {
  const chain = await liveChain(c.req.param("id"));
  return c.json(await query<ChainLogEntry>(
    `SELECT l.id::text AS id, l.logged_at AS date, l.section, l.action, l.field,
            l.old_value AS "oldValue", l.new_value AS "newValue", l.updated_by AS "updatedBy"
     FROM chain_logs l WHERE l.chain_id = $1 ORDER BY l.logged_at DESC, l.id DESC`, [chain.id]));
});
