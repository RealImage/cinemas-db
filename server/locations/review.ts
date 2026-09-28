// The Reference sync review queue: listing items, and the admin's decision on
// each (Add, Link or fix, Ignore, Deactivate, Keep). Every decision is logged
// with the reference source and its ID.
import { query } from "../db";
import { CURRENT_USER, httpError, notFound } from "../http";
import { loadRecord, lockRow, setDeleted, updateCitiesAudited, updateRecord, writeLog, type Db } from "./records";
import { loadSettings, trackedCountryIds } from "./sync";
import {
  reviewEntities,
  reparentCode,
  reviewFlags,
  suggestCityCode,
  type LocationRef,
  type ReviewAction,
  type ReviewEntity,
  type ReviewFlag,
  type ReviewItem,
  type ReviewItemsParams,
  type ReviewPrefill,
  type ReviewResolution,
  type ReviewSummary,
  type SyncRun,
  type SyncSettings,
} from "../../src/data/locationsData";

type ItemRow = Omit<ReviewItem, "autoFix">;

const ITEM_COLUMNS = `i.id, i.entity, i.flag, i.record_id AS "recordId", i.source, i.source_ref AS "sourceRef",
  i.reference, i.local, i.differences, i.status, i.resolution, i.resolved_by AS "resolvedBy", i.resolved_at AS "resolvedAt",
  i.first_seen_at AS "firstSeenAt", i.last_seen_at AS "lastSeenAt",
  CASE i.entity
    WHEN 'countries' THEN (SELECT name FROM countries WHERE id = i.record_id)
    WHEN 'provinces' THEN (SELECT name FROM provinces WHERE id = i.record_id)
    WHEN 'cities' THEN (SELECT name FROM cities WHERE id = i.record_id)
    WHEN 'timezones' THEN (SELECT name FROM timezones WHERE id = i.record_id)
  END AS "recordLabel"`;

// ---------------------------------------------------------------------------
// What "Link or fix" can do without the edit form
// ---------------------------------------------------------------------------

interface FixPlan {
  description: string;
  apply: (db: Db) => Promise<void>;
}

const idBy = async (db: Db, sql: string, arg: unknown) => (await db.query<{ id: string }>(sql, [arg])).rows[0]?.id ?? null;

/** The automatic fix for a Mismatch item, or null when it needs the edit form. */
async function fixPlan(db: Db, item: ItemRow): Promise<FixPlan | null> {
  if (item.flag !== "mismatch" || !item.recordId) return null;
  const ref = item.reference ?? {};
  const fields = new Set(item.differences.map((d) => d.field));
  const id = item.recordId;

  switch (item.entity) {
    case "countries": {
      const columns: Record<string, unknown> = {};
      if (fields.has("ISO 3166-2")) columns.iso3166_2 = ref.iso2;
      if (fields.has("ISO 3166-3")) columns.iso3166_3 = ref.iso3;
      if (fields.has("Calling Code")) columns.calling_code = ref.callingCode;
      if (fields.has("Currency")) columns.currency_code = ref.currency;
      const names = item.differences.map((d) => d.field).join(", ");
      return { description: `Set ${names} from GeoNames`, apply: (db) => updateRecord(db, "countries", id, columns) };
    }
    case "provinces": {
      if (fields.has("ISO Code")) return null; // the right ISO code isn't in GeoNames
      const countryId = await idBy(db, "SELECT id FROM countries WHERE iso3166_2 = $1 AND NOT is_deleted", ref.country);
      if (!countryId) return null;
      // The ISO code moves with the country; one without the old country's prefix needs the edit form
      const current = (await db.query<{ iso_code: string; iso2: string }>(
        "SELECT p.iso_code, c.iso3166_2 AS iso2 FROM provinces p JOIN countries c ON c.id = p.country_id WHERE p.id = $1", [id])).rows[0];
      const isoCode = current && reparentCode(current.iso_code, current.iso2, String(ref.country));
      if (!isoCode) return null;
      return {
        description: `Move to country ${ref.country} and set ISO code to ${isoCode}`,
        apply: (db) => updateRecord(db, "provinces", id, { country_id: countryId, iso_code: isoCode }),
      };
    }
    case "cities": {
      const columns: Record<string, unknown> = {};
      const steps: string[] = [];
      let provinceCode: string | null = null;
      if (fields.has("Province")) {
        const row = (await db.query<{ id: string; iso_code: string }>(
          "SELECT id, iso_code FROM provinces WHERE geoname_key = $1 AND NOT is_deleted", [ref.provinceKey])).rows[0];
        if (!row) return null;
        columns.province_id = row.id;
        provinceCode = row.iso_code;
        steps.push(`move to ${ref.provinceName}`);
      }
      if (fields.has("Timezone")) {
        const tzId = await idBy(db, "SELECT id FROM timezones WHERE name = $1", ref.timezone);
        if (!tzId) return null;
        columns.timezone_id = tzId;
        steps.push(`set timezone to ${ref.timezone}`);
      }
      if (fields.has("Code") || provinceCode) {
        const city = (await db.query<{ name: string; code: string | null; province_id: string }>(
          "SELECT name, code, province_id FROM cities WHERE id = $1", [id])).rows[0];
        if (!city) return null;
        const code = provinceCode ?? (await db.query<{ iso_code: string }>(
          "SELECT iso_code FROM provinces WHERE id = $1", [city.province_id])).rows[0].iso_code;
        const next = suggestCityCode(String(city.name), code);
        if (next !== city.code) { columns.code = next; steps.push(`set code to ${next}`); }
      }
      if (!steps.length) return null;
      const text = steps.join(", ");
      return { description: text[0].toUpperCase() + text.slice(1), apply: (db) => updateRecord(db, "cities", id, columns) };
    }
    case "timezones": {
      const target = String(ref.name);
      const targetId = await idBy(db, "SELECT id FROM timezones WHERE name = $1", target);
      if (targetId) {
        return {
          description: `Move its cities to ${target} and set this alias inactive`,
          apply: async (db) => {
            const { rows } = await db.query<{ id: string }>("SELECT id FROM cities WHERE timezone_id = $1 ORDER BY id FOR UPDATE", [id]);
            await updateCitiesAudited(db, rows.map((r) => r.id), { timezone_id: targetId }, { source: "iana", ref: target });
            await updateRecord(db, "timezones", id, { is_active: false });
          },
        };
      }
      return { description: `Rename to ${target}`, apply: (db) => updateRecord(db, "timezones", id, { name: target }) };
    }
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function withAutoFix(db: Db, rows: ItemRow[]): Promise<ReviewItem[]> {
  return Promise.all(rows.map(async (r) => ({ ...r, autoFix: r.status === "open" ? (await fixPlan(db, r))?.description ?? null : null })));
}

export async function listItems(db: Db, params: ReviewItemsParams) {
  if (!reviewEntities.includes(params.entity)) throw httpError(400, "Unknown entity");
  const args: unknown[] = [params.entity, params.status ?? "open"];
  const where = ["i.entity = $1", "i.status = $2"];
  if (params.flag) { args.push(params.flag); where.push(`i.flag = $${args.length}`); }
  if (params.search?.trim()) {
    args.push(`%${params.search.trim()}%`);
    where.push(`(i.reference::text ILIKE $${args.length} OR i.local::text ILIKE $${args.length} OR i.source_ref ILIKE $${args.length})`);
  }
  const pageSize = Math.min(Math.max(Number(params.pageSize) || 100, 1), 500);
  const page = Math.max(Number(params.page) || 1, 1);
  const whereSql = where.join(" AND ");
  const { rows: [{ total }] } = await db.query<{ total: number }>(`SELECT count(*) AS total FROM location_review_items i WHERE ${whereSql}`, args);
  const { rows } = await db.query<ItemRow>(
    `SELECT ${ITEM_COLUMNS} FROM location_review_items i WHERE ${whereSql}
     ORDER BY CASE i.flag WHEN 'mismatch' THEN 0 WHEN 'duplicate' THEN 1 WHEN 'missing' THEN 2 ELSE 3 END,
       (i.reference->>'population')::bigint DESC NULLS LAST, i.id
     LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, args);
  return { rows: await withAutoFix(db, rows), total, page, pageSize };
}

async function lockItem(db: Db, id: number) {
  const { rows } = await db.query<ItemRow>(`SELECT ${ITEM_COLUMNS} FROM location_review_items i WHERE i.id = $1 FOR UPDATE OF i`, [id]);
  if (!rows[0]) throw notFound("Review item");
  return rows[0];
}

export async function lockOpenItem(db: Db, id: number, entity?: string) {
  const item = await lockItem(db, id);
  if (item.status !== "open") throw httpError(409, "This review item has already been decided");
  if (entity && item.entity !== entity) throw httpError(400, "The review item is for a different kind of record");
  return item;
}

async function markDecided(db: Db, id: number, status: "resolved" | "ignored", resolution: ReviewResolution) {
  await db.query(
    "UPDATE location_review_items SET status = $2, resolution = $3, resolved_by = $4, resolved_at = now() WHERE id = $1",
    [id, status, resolution, CURRENT_USER]);
}

const settingsOf = async (db: Db): Promise<SyncSettings> => {
  const { rows: [s] } = await db.query<{
    tracked_country_ids: string[] | null; population_threshold: number; nightly_enabled: boolean; updated_by: string; updated_at: string;
  }>("SELECT * FROM location_sync_settings");
  const ids = await trackedCountryIds(db);
  const { rows: tracked } = await db.query<LocationRef>("SELECT id, name FROM countries WHERE id = ANY($1) ORDER BY name", [ids]);
  return {
    trackedCountryIds: s.tracked_country_ids, trackedCountries: tracked, populationThreshold: s.population_threshold,
    nightlyEnabled: s.nightly_enabled, updatedBy: s.updated_by, updatedAt: s.updated_at,
  };
};

const RUN_COLUMNS = `id, trigger, status, started_at AS "startedAt", finished_at AS "finishedAt", error, summary, started_by AS "startedBy"`;

export async function summary(db: Db): Promise<ReviewSummary> {
  const { rows: runs } = await db.query<SyncRun>(`SELECT ${RUN_COLUMNS} FROM location_sync_runs ORDER BY id DESC LIMIT 1`);
  const { rows: counts } = await db.query<{ entity: ReviewEntity; flag: ReviewFlag; n: number }>(
    "SELECT entity, flag, count(*) AS n FROM location_review_items WHERE status = 'open' GROUP BY entity, flag");
  const table = Object.fromEntries(reviewEntities.map((e) => [e, Object.fromEntries(reviewFlags.map((f) => [f.id, 0]))])) as ReviewSummary["counts"];
  for (const c of counts) table[c.entity][c.flag] = c.n;
  return { lastRun: runs[0] ?? null, running: runs[0]?.status === "running", settings: await settingsOf(db), counts: table };
}

export async function updateSettings(db: Db, body: Record<string, unknown>) {
  const tracked = body.trackedCountryIds;
  if (tracked !== null && !Array.isArray(tracked)) throw httpError(400, "trackedCountryIds must be a list, or null for countries with theatres");
  const threshold = Number(body.populationThreshold);
  if (!Number.isInteger(threshold) || threshold < 0) throw httpError(400, "Population threshold must be a whole number of 0 or more");
  if (typeof body.nightlyEnabled !== "boolean") throw httpError(400, "nightlyEnabled must be true or false");
  if (Array.isArray(tracked) && tracked.length) {
    const { rows } = await db.query("SELECT id FROM countries WHERE id = ANY($1)", [tracked]);
    if (rows.length !== new Set(tracked).size) throw httpError(400, "One or more tracked countries do not exist");
  }
  await db.query(
    `UPDATE location_sync_settings SET tracked_country_ids = $1, population_threshold = $2, nightly_enabled = $3,
       updated_by = $4, updated_at = now()`,
    [Array.isArray(tracked) ? [...new Set(tracked.map(String))] : null, threshold, body.nightlyEnabled, CURRENT_USER]);
  return settingsOf(db);
}

export async function runs(limit = 10) {
  return query<SyncRun>(`SELECT ${RUN_COLUMNS} FROM location_sync_runs ORDER BY id DESC LIMIT $1`, [limit]);
}

/** Decisions taken from the Review page (log entries that carry a reference source), newest first. */
export async function decisions(page = 1, pageSize = 50) {
  const [{ total }] = await query<{ total: number }>("SELECT count(*) AS total FROM location_logs WHERE source IS NOT NULL AND updated_by <> 'Reference sync'");
  const rows = await query(
    `SELECT id, entity, record_id AS "recordId", action, updated_by AS "updatedBy", created_at AS "createdAt",
       current, previous, source, source_ref AS "sourceRef"
     FROM location_logs WHERE source IS NOT NULL AND updated_by <> 'Reference sync'
     ORDER BY id DESC LIMIT $1 OFFSET $2`, [pageSize, (Math.max(page, 1) - 1) * pageSize]);
  return { rows, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// Adding a New item: form prefill, and linking the record it creates
// ---------------------------------------------------------------------------

export async function prefill(db: Db, id: number): Promise<ReviewPrefill> {
  const item = await lockItem(db, id);
  if (item.flag !== "new") throw httpError(400, "Only New items can be added");
  const r = item.reference ?? {};
  const one = async (sql: string, arg: unknown) => (await db.query(sql, [arg])).rows[0];
  switch (item.entity) {
    case "countries":
      return { name: r.name, iso2: r.iso2, iso3: r.iso3, callingCode: r.callingCode, currencyCode: r.currency };
    case "provinces": {
      const country = await one("SELECT id, name, iso3166_2 FROM countries WHERE iso3166_2 = $1 AND NOT is_deleted", r.country);
      return {
        name: r.name, alternateName: r.asciiName !== r.name ? r.asciiName : null,
        country: country ? { id: country.id, label: `${country.name} (${country.iso3166_2})`, iso2: country.iso3166_2 } : null,
        isoCode: country ? `${country.iso3166_2}-` : "",
      };
    }
    case "cities": {
      const province = await one(`SELECT p.id, p.name, p.iso_code, c.iso3166_2 FROM provinces p JOIN countries c ON c.id = p.country_id
        WHERE p.geoname_key = $1 AND NOT p.is_deleted`, r.provinceKey);
      const tz = await one("SELECT id, name FROM timezones WHERE name = $1", r.timezone);
      return {
        name: r.name, alternateName: r.asciiName !== r.name ? r.asciiName : null,
        province: province ? { id: province.id, label: `${province.name}, ${province.iso3166_2}`, isoCode: province.iso_code } : null,
        timezone: tz ? { id: tz.id, label: tz.name } : null, latitude: r.latitude, longitude: r.longitude,
        code: province ? suggestCityCode(String(r.asciiName ?? r.name), province.iso_code) : null,
      };
    }
    default:
      throw httpError(400, "Timezones are added from the Review page directly");
  }
}

/** Reference columns a record created from a New item gets. */
export function linkColumns(item: ItemRow): Record<string, unknown> {
  const r = item.reference ?? {};
  switch (item.entity) {
    case "countries": return { geoname_id: r.geonameId };
    case "provinces": return { geoname_id: r.geonameId, geoname_key: r.key };
    case "cities": return { geoname_id: r.geonameId, population: r.population ?? null };
    default: return {};
  }
}

export const itemSource = (item: ItemRow) => ({ source: item.source, ref: item.sourceRef });

/** After a form save that resolves `item` (Add for New, a fix via Edit otherwise). */
export async function resolveFromForm(db: Db, item: ItemRow) {
  await markDecided(db, item.id, "resolved", item.flag === "new" ? "added" : "fixed");
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export async function decide(db: Db, id: number, body: ReviewAction | { action: "add" }) {
  const item = await lockOpenItem(db, id);
  const source = itemSource(item);
  const entity = item.entity;

  switch (body.action) {
    case "ignore": {
      const record = item.recordId ? await loadRecord(entity, item.recordId, db) : null;
      await writeLog(db, entity, item.recordId, "IGNORE", record, record, source);
      await markDecided(db, id, "ignored", "ignored");
      break;
    }
    case "add": {
      // Only timezones are added here; other entities go through the create form
      if (entity !== "timezones" || item.flag !== "new") throw httpError(400, "Use the create form to add this record");
      const { rows: [created] } = await db.query<{ id: string }>(
        "INSERT INTO timezones (name, display_name, updated_by) VALUES ($1, $2, $3) RETURNING id",
        [item.sourceRef, displayName(item.sourceRef), CURRENT_USER]);
      await writeLog(db, entity, created.id, "CREATE", null, await loadRecord(entity, created.id, db), source);
      await markDecided(db, id, "resolved", "added");
      break;
    }
    case "link": {
      if (item.flag !== "new") throw httpError(400, "Only New items can be linked to an existing record");
      const recordId = String(body.recordId ?? "");
      const row = await lockRow(db, entity, recordId);
      if (row.is_deleted) throw httpError(400, "That record is deactivated");
      const before = await loadRecord(entity, recordId, db);
      const columns = entity === "timezones" ? { name: item.sourceRef } : linkColumns(item);
      await updateRecord(db, entity, recordId, columns).catch((err) => {
        if (err?.code === "23505") throw httpError(409, `${item.sourceRef} is already in CinemaDB`);
        throw err;
      });
      await writeLog(db, entity, recordId, "LINK", before, await loadRecord(entity, recordId, db), source);
      await markDecided(db, id, "resolved", "linked");
      break;
    }
    case "fix": {
      const plan = await fixPlan(db, item);
      if (!plan) throw httpError(400, "This item can't be fixed automatically; edit the record instead");
      const before = await loadRecord(entity, item.recordId!, db);
      await plan.apply(db);
      await writeLog(db, entity, item.recordId!, "UPDATE", before, await loadRecord(entity, item.recordId!, db), source);
      await markDecided(db, id, "resolved", "fixed");
      break;
    }
    case "deactivate": {
      if (item.flag !== "missing" || !item.recordId) throw httpError(400, "Only Missing items can be deactivated");
      if (entity === "timezones") {
        const before = await loadRecord(entity, item.recordId, db);
        await updateRecord(db, entity, item.recordId, { is_active: false });
        await writeLog(db, entity, item.recordId, "UPDATE", before, await loadRecord(entity, item.recordId, db), source);
      } else {
        await setDeleted(db, entity, item.recordId, true, source);
      }
      await markDecided(db, id, "resolved", "deactivated");
      break;
    }
    case "keep": {
      if (item.flag !== "duplicate" || entity === "timezones") throw httpError(400, "Only Duplicate items have a record to keep");
      const records = ((item.local?.records ?? []) as LocationRef[]).map((r) => r.id);
      if (!records.includes(body.recordId)) throw httpError(400, "Choose one of the duplicate records");
      const clear = entity === "provinces" ? { geoname_id: null, geoname_key: null } : { geoname_id: null };
      for (const other of records.filter((r) => r !== body.recordId)) {
        const before = await loadRecord(entity, other, db);
        if (!before) continue;
        await updateRecord(db, entity, other, clear);
        await writeLog(db, entity, other, "LINK", before, await loadRecord(entity, other, db), source);
      }
      await markDecided(db, id, "resolved", "fixed");
      break;
    }
    default:
      throw httpError(400, "Unknown action");
  }
  const { rows } = await db.query<ItemRow>(`SELECT ${ITEM_COLUMNS} FROM location_review_items i WHERE i.id = $1`, [id]);
  return (await withAutoFix(db, rows))[0];
}

function displayName(tz: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longGeneric" })
      .formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? null;
  } catch {
    return null;
  }
}

export { loadSettings };
