// Reads, validation and writes for the five location entities. Every write
// runs in a transaction, locks the row it changes, and appends a full
// before/after snapshot to location_logs.
import type pg from "pg";
import { query } from "../db";
import { CURRENT_USER, httpError, notFound } from "../http";
import {
  codePrefixError,
  isCurrencyCode,
  zoneOffsets,
  type LocationEntity,
  type LocationListParams,
  type LocationLogAction,
  type LocationPage,
  type LocationRecord,
  type ReferenceSource,
} from "../../src/data/locationsData";

export type Db = Pick<pg.PoolClient, "query">;

const reviewCount = (entity: LocationEntity, alias: string) =>
  `(SELECT count(*) FROM location_review_items r WHERE r.status = 'open' AND r.entity = '${entity}' AND r.record_id = ${alias}.id)`;

const NAMED = (a: string) => `${a}.name, ${a}.alternate_name AS "alternateName", ${a}.local_language_name AS "localLanguageName",
  ${a}.translations, ${a}.last_regional_modification_date AS "lastRegionalModificationDate"`;
const AUDIT = (a: string) => `${a}.updated_by AS "updatedBy", ${a}.updated_at AS "updatedAt"`;

const CITY_REF = (a: string) =>
  `json_build_object('id', ${a}.id, 'name', ${a}.name, 'provinceName', pp.name, 'countryCode', pc.iso3166_2)`;

interface EntitySql {
  table: string;
  alias: string;
  select: string;
  from: string;
  /** Columns matched by the list's search box. */
  search: string[];
  /** Sort key (a record field) → SQL expression. */
  sorts: Record<string, string>;
  softDelete: boolean;
}

// Standard offset in minutes, for sorting timezones; NULL for IDs Postgres doesn't know
const TZ_OFFSET_SORT = `(CASE WHEN tz.name IN (SELECT name FROM pg_timezone_names) THEN
  extract(epoch FROM greatest(
    (timestamp '2026-01-15 12:00' AT TIME ZONE tz.name) - (timestamp '2026-01-15 12:00' AT TIME ZONE 'UTC'),
    (timestamp '2026-07-15 12:00' AT TIME ZONE tz.name) - (timestamp '2026-07-15 12:00' AT TIME ZONE 'UTC'))) * -1 END)`;

export const ENTITY_SQL: Record<LocationEntity, EntitySql> = {
  countries: {
    table: "countries",
    alias: "c",
    select: `c.id, ${NAMED("c")}, c.iso3166_2 AS iso2, c.iso3166_3 AS iso3, c.calling_code AS "callingCode",
      c.currency_code AS "currencyCode", c.geoname_id AS "geonameId", c.is_deleted AS "isDeleted", ${AUDIT("c")},
      coalesce((SELECT json_agg(json_build_object('id', tz.id, 'name', tz.name) ORDER BY tz.name)
        FROM country_timezones ct JOIN timezones tz ON tz.id = ct.timezone_id WHERE ct.country_id = c.id), '[]') AS timezones,
      (SELECT count(*) FROM provinces p WHERE p.country_id = c.id AND NOT p.is_deleted) AS "provinceCount",
      ${reviewCount("countries", "c")} AS "reviewCount"`,
    from: "countries c",
    search: ["c.name", "c.alternate_name", "c.local_language_name", "c.iso3166_2", "c.iso3166_3"],
    sorts: { name: "lower(c.name)", iso2: "c.iso3166_2", iso3: "c.iso3166_3", updatedBy: "c.updated_by", updatedAt: "c.updated_at" },
    softDelete: true,
  },
  provinces: {
    table: "provinces",
    alias: "p",
    select: `p.id, ${NAMED("p")}, p.country_id AS "countryId", pc.name AS "countryName", pc.iso3166_2 AS "countryCode",
      p.iso_code AS "isoCode", p.code, p.geoname_id AS "geonameId", p.geoname_key AS "geonameKey",
      p.is_deleted AS "isDeleted", ${AUDIT("p")},
      (SELECT count(*) FROM cities ci WHERE ci.province_id = p.id AND NOT ci.is_deleted) AS "cityCount",
      ${reviewCount("provinces", "p")} AS "reviewCount"`,
    from: "provinces p JOIN countries pc ON pc.id = p.country_id",
    search: ["p.name", "p.alternate_name", "p.iso_code", "p.code", "pc.name"],
    sorts: {
      name: "lower(p.name)", isoCode: "p.iso_code", countryName: "lower(pc.name)", countryCode: "pc.iso3166_2",
      updatedBy: "p.updated_by", updatedAt: "p.updated_at",
    },
    softDelete: true,
  },
  cities: {
    table: "cities",
    alias: "ci",
    select: `ci.id, ${NAMED("ci")}, ci.province_id AS "provinceId", pp.name AS "provinceName", pp.iso_code AS "provinceCode",
      pc.id AS "countryId", pc.name AS "countryName", pc.iso3166_2 AS "countryCode",
      ci.timezone_id AS "timezoneId", tz.name AS "timezoneName", ci.metro_area_id AS "metroAreaId", ma.name AS "metroAreaName",
      ci.code, ci.latitude, ci.longitude, ci.population, ci.geoname_id AS "geonameId", ci.is_deleted AS "isDeleted", ${AUDIT("ci")},
      (SELECT count(*) FROM theatres t WHERE t.city_id = ci.id) AS "theatreCount",
      ${reviewCount("cities", "ci")} AS "reviewCount"`,
    from: `cities ci JOIN provinces pp ON pp.id = ci.province_id JOIN countries pc ON pc.id = pp.country_id
      JOIN timezones tz ON tz.id = ci.timezone_id LEFT JOIN metro_areas ma ON ma.id = ci.metro_area_id`,
    search: ["ci.name", "ci.alternate_name", "ci.code", "pp.name", "pc.name"],
    sorts: {
      name: "lower(ci.name)", code: "ci.code", provinceName: "lower(pp.name)", provinceCode: "pp.iso_code",
      metroAreaName: "lower(ma.name)", updatedBy: "ci.updated_by", updatedAt: "ci.updated_at",
    },
    softDelete: true,
  },
  metro_areas: {
    table: "metro_areas",
    alias: "ma",
    select: `ma.id, ma.name, ma.is_deleted AS "isDeleted", ${AUDIT("ma")},
      coalesce((SELECT json_agg(${CITY_REF("ci")} ORDER BY ci.name)
        FROM cities ci JOIN provinces pp ON pp.id = ci.province_id JOIN countries pc ON pc.id = pp.country_id
        WHERE ci.metro_area_id = ma.id AND NOT ci.is_deleted), '[]') AS cities,
      (SELECT count(*) FROM cities ci WHERE ci.metro_area_id = ma.id AND NOT ci.is_deleted) AS "cityCount",
      0 AS "reviewCount"`,
    from: "metro_areas ma",
    search: ["ma.name"],
    sorts: {
      name: "lower(ma.name)", cityCount: `(SELECT count(*) FROM cities ci WHERE ci.metro_area_id = ma.id AND NOT ci.is_deleted)`,
      updatedBy: "ma.updated_by", updatedAt: "ma.updated_at",
    },
    softDelete: true,
  },
  timezones: {
    table: "timezones",
    alias: "tz",
    select: `tz.id, tz.name, tz.display_name AS "displayName", tz.is_active AS "isActive", ${AUDIT("tz")},
      coalesce((SELECT json_agg(${CITY_REF("ci")} ORDER BY tpc.position, ci.name)
        FROM timezone_popular_cities tpc JOIN cities ci ON ci.id = tpc.city_id
        JOIN provinces pp ON pp.id = ci.province_id JOIN countries pc ON pc.id = pp.country_id
        WHERE tpc.timezone_id = tz.id), '[]') AS "popularCities",
      (SELECT count(*) FROM cities ci WHERE ci.timezone_id = tz.id AND NOT ci.is_deleted) AS "cityCount",
      ${reviewCount("timezones", "tz")} AS "reviewCount"`,
    from: "timezones tz",
    search: ["tz.name", "tz.display_name"],
    sorts: {
      name: "tz.name", displayName: "lower(tz.display_name)", utcOffset: TZ_OFFSET_SORT, isActive: "tz.is_active",
      updatedBy: "tz.updated_by", updatedAt: "tz.updated_at",
    },
    softDelete: false,
  },
};

/** Adds offsets derived from the IANA ID to timezone rows. */
function finish(entity: LocationEntity, row: Record<string, unknown>) {
  if (entity === "timezones") Object.assign(row, zoneOffsets(row.name as string));
  return row as unknown as LocationRecord;
}

export async function listRecords(entity: LocationEntity, params: LocationListParams): Promise<LocationPage<LocationRecord>> {
  const def = ENTITY_SQL[entity];
  const where: string[] = [];
  const args: unknown[] = [];
  const arg = (v: unknown) => { args.push(v); return `$${args.length}`; };

  if (def.softDelete && !params.includeDeleted) where.push(`NOT ${def.alias}.is_deleted`);
  if (params.search?.trim()) {
    const p = arg(`%${params.search.trim()}%`);
    where.push(`(${def.search.map((col) => `${col} ILIKE ${p}`).join(" OR ")})`);
  }
  if (params.needsReview) where.push(`${reviewCount(entity, def.alias)} > 0`);
  if (params.countryId && entity === "provinces") where.push(`p.country_id = ${arg(params.countryId)}`);
  if (params.countryId && entity === "cities") where.push(`pc.id = ${arg(params.countryId)}`);
  if (params.provinceId && entity === "cities") where.push(`ci.province_id = ${arg(params.provinceId)}`);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sortExpr = (params.sort && def.sorts[params.sort]) || def.sorts.updatedAt;
  const direction = params.direction === "asc" ? "ASC" : params.direction === "desc" ? "DESC" : params.sort ? "ASC" : "DESC";
  const pageSize = Math.min(Math.max(Number(params.pageSize) || 100, 1), 1000);
  const page = Math.max(Number(params.page) || 1, 1);

  const [{ total }] = await query<{ total: number }>(`SELECT count(*) AS total FROM ${def.from} ${whereSql}`, args);
  const rows = await query(
    `SELECT ${def.select} FROM ${def.from} ${whereSql}
     ORDER BY ${sortExpr} ${direction} NULLS LAST, ${def.alias}.id
     LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    args,
  );
  return { rows: rows.map((r) => finish(entity, r)), total, page, pageSize };
}

export async function loadRecord(entity: LocationEntity, id: string, db?: Db) {
  const def = ENTITY_SQL[entity];
  const sql = `SELECT ${def.select} FROM ${def.from} WHERE ${def.alias}.id = $1`;
  const rows = db ? (await db.query(sql, [id])).rows : await query(sql, [id]);
  return rows[0] ? finish(entity, rows[0]) : undefined;
}

export async function mustLoad(entity: LocationEntity, id: string, db?: Db) {
  const record = await loadRecord(entity, id, db);
  if (!record) throw notFound(singular(entity));
  return record;
}

const singular = (entity: LocationEntity) =>
  ({ countries: "Country", provinces: "Province", cities: "City", metro_areas: "Metro area", timezones: "Timezone" })[entity];

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

/** Derived values left out of log snapshots, so a diff shows only stored fields. */
const DERIVED = ["reviewCount", "provinceCount", "cityCount", "theatreCount", "utcOffset", "dstOffset"];
export const snapshot = (record: LocationRecord | undefined | null) =>
  record ? Object.fromEntries(Object.entries(record).filter(([k]) => !DERIVED.includes(k))) : null;

export async function writeLog(
  db: Db,
  entity: LocationEntity,
  recordId: string | null,
  action: LocationLogAction,
  previous: LocationRecord | null | undefined,
  current: LocationRecord | null | undefined,
  source?: { source: ReferenceSource; ref: string },
) {
  await db.query(
    `INSERT INTO location_logs (entity, record_id, action, updated_by, previous, current, source, source_ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [entity, recordId, action, CURRENT_USER, snapshot(previous), snapshot(current), source?.source ?? null, source?.ref ?? null],
  );
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

type Body = Record<string, unknown>;

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const required = (v: unknown, label: string) => {
  const t = text(v);
  if (!t) throw httpError(400, `${label} is required`);
  return t;
};
const stringList = (v: unknown, label: string) => {
  if (v == null) return [];
  if (!Array.isArray(v)) throw httpError(400, `${label} must be a list`);
  return [...new Set(v.map((x) => String(x).trim()).filter(Boolean))];
};
const dateOrNull = (v: unknown, label: string) => {
  const t = text(v);
  if (t && !/^\d{4}-\d{2}-\d{2}$/.test(t)) throw httpError(400, `${label} must be a date (YYYY-MM-DD)`);
  return t;
};
const numberOrNull = (v: unknown, label: string, min: number, max: number) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw httpError(400, `${label} must be a number between ${min} and ${max}`);
  return n;
};

const namedColumns = (body: Body) => ({
  name: required(body.name, "Name"),
  alternate_name: text(body.alternateName),
  local_language_name: text(body.localLanguageName),
  translations: stringList(body.translations, "Translations"),
  last_regional_modification_date: dateOrNull(body.lastRegionalModificationDate, "Last Regional Modification Date"),
});

async function one<T extends pg.QueryResultRow>(db: Db, sql: string, args: unknown[]) {
  return (await db.query<T>(sql, args)).rows[0] as T | undefined;
}

/** A parent a record may point at: it must exist, and must be active unless the record already points at it. */
async function activeParent<T extends pg.QueryResultRow>(
  db: Db, table: string, id: unknown, label: string, currentId: string | null, columns: string,
) {
  const parentId = required(id, label);
  const row = await one<T & { is_deleted: boolean }>(db, `SELECT ${columns}, is_deleted FROM ${table} WHERE id = $1`, [parentId]);
  if (!row) throw httpError(400, `${label} ${parentId} does not exist`);
  if (row.is_deleted && parentId !== currentId) throw httpError(400, `${label} is deactivated`);
  return row;
}

async function assertAllExist(db: Db, table: string, ids: string[], label: string, activeOnly = true) {
  if (!ids.length) return;
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM ${table} WHERE id = ANY($1)${activeOnly ? " AND NOT is_deleted" : ""}`, [ids]);
  const found = new Set(rows.map((r) => r.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) throw httpError(400, `${label} not found or deactivated: ${missing.join(", ")}`);
}

export interface ParsedWrite {
  columns: Record<string, unknown>;
  /** Writes to link tables once the row exists. */
  links?: (db: Db, id: string) => Promise<void>;
}

type Existing = Record<string, unknown> | undefined;

export async function parseInput(entity: LocationEntity, body: Body, db: Db, existing: Existing): Promise<ParsedWrite> {
  switch (entity) {
    case "countries": {
      const iso2 = required(body.iso2, "ISO 3166-2").toUpperCase();
      const iso3 = required(body.iso3, "ISO 3166-3").toUpperCase();
      if (!/^[A-Z]{2}$/.test(iso2)) throw httpError(400, "ISO 3166-2 must be 2 letters, e.g. TR");
      if (!/^[A-Z]{3}$/.test(iso3)) throw httpError(400, "ISO 3166-3 must be 3 letters, e.g. TUR");
      const calling = text(body.callingCode)?.replace(/^\+/, "").replace(/\s/g, "") ?? null;
      if (calling && !/^\d{1,4}$/.test(calling)) throw httpError(400, "Calling Code must be 1–4 digits, e.g. 90");
      const currency = text(body.currencyCode)?.toUpperCase() ?? null;
      if (currency && !isCurrencyCode(currency)) throw httpError(400, `${currency} is not an ISO 4217 currency`);
      const timezoneIds = stringList(body.timezoneIds, "Timezones");
      if (timezoneIds.length) {
        const { rows } = await db.query<{ id: string }>("SELECT id FROM timezones WHERE id = ANY($1)", [timezoneIds]);
        if (rows.length !== timezoneIds.length) throw httpError(400, "One or more timezones do not exist");
      }
      return {
        columns: { ...namedColumns(body), iso3166_2: iso2, iso3166_3: iso3, calling_code: calling, currency_code: currency },
        links: async (db, id) => {
          await db.query("DELETE FROM country_timezones WHERE country_id = $1", [id]);
          await db.query(
            "INSERT INTO country_timezones (country_id, timezone_id) SELECT $1, unnest($2::text[])", [id, timezoneIds]);
        },
      };
    }
    case "provinces": {
      const country = await activeParent<{ id: string; iso3166_2: string }>(
        db, "countries", body.countryId, "Country", (existing?.country_id as string) ?? null, "id, iso3166_2");
      const isoCode = required(body.isoCode, "ISO Code").toUpperCase();
      const prefix = codePrefixError("ISO Code", isoCode, country.iso3166_2, "country");
      if (prefix) throw httpError(400, prefix);
      return { columns: { ...namedColumns(body), country_id: country.id, iso_code: isoCode, code: text(body.code) } };
    }
    case "cities": {
      const province = await activeParent<{ id: string; iso_code: string }>(
        db, "provinces", body.provinceId, "Province", (existing?.province_id as string) ?? null, "id, iso_code");
      const timezoneId = required(body.timezoneId, "Timezone");
      const tz = await one<{ is_active: boolean }>(db, "SELECT is_active FROM timezones WHERE id = $1", [timezoneId]);
      if (!tz) throw httpError(400, `Timezone ${timezoneId} does not exist`);
      if (!tz.is_active && timezoneId !== existing?.timezone_id) throw httpError(400, "Timezone is inactive");
      const code = text(body.code)?.toUpperCase() ?? null;
      if (code) {
        const prefix = codePrefixError("Code", code, province.iso_code, "province");
        if (prefix) throw httpError(400, prefix);
      }
      return {
        columns: {
          ...namedColumns(body), province_id: province.id, timezone_id: timezoneId, code,
          latitude: numberOrNull(body.latitude, "Latitude", -90, 90),
          longitude: numberOrNull(body.longitude, "Longitude", -180, 180),
        },
      };
    }
    case "metro_areas": {
      const cityIds = stringList(body.cityIds, "Cities");
      if (!cityIds.length) throw httpError(400, "A metro area needs at least one city");
      await assertAllExist(db, "cities", cityIds, "Cities");
      return {
        columns: { name: required(body.name, "Name") },
        // A city belongs to at most one metro area: listing it here moves it from any other
        links: async (db, id) => {
          await db.query("UPDATE cities SET metro_area_id = NULL WHERE metro_area_id = $1 AND NOT (id = ANY($2))", [id, cityIds]);
          await db.query("UPDATE cities SET metro_area_id = $1 WHERE id = ANY($2)", [id, cityIds]);
        },
      };
    }
    case "timezones": {
      if (typeof body.isActive !== "boolean") throw httpError(400, "Is Active must be true or false");
      const popularCityIds = stringList(body.popularCityIds, "Popular Cities");
      await assertAllExist(db, "cities", popularCityIds, "Popular cities", false);
      return {
        columns: { display_name: text(body.displayName), is_active: body.isActive },
        links: async (db, id) => {
          await db.query("DELETE FROM timezone_popular_cities WHERE timezone_id = $1", [id]);
          await db.query(
            `INSERT INTO timezone_popular_cities (timezone_id, city_id, position)
             SELECT $1, city_id, ord FROM unnest($2::text[]) WITH ORDINALITY AS u(city_id, ord)`,
            [id, popularCityIds]);
        },
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const UNIQUE_MESSAGES: Record<string, string> = {
  countries_iso2_key: "Another country already has this ISO 3166-2 code",
  countries_iso3_key: "Another country already has this ISO 3166-3 code",
  countries_name_key: "Another country already has this name",
  provinces_name_key: "This country already has a province with this name",
  cities_name_key: "This province already has a city with this name",
  metro_areas_name_key: "Another metro area already has this name",
};

/** Turns a unique-index violation into a 409 with a readable message. */
export function conflictMessage(err: unknown) {
  const e = err as { code?: string; constraint?: string };
  if (e?.code === "23505" && e.constraint && UNIQUE_MESSAGES[e.constraint]) return httpError(409, UNIQUE_MESSAGES[e.constraint]);
  return err;
}

export async function insertRecord(db: Db, entity: LocationEntity, parsed: ParsedWrite, extra: Record<string, unknown> = {}) {
  const columns = { ...parsed.columns, ...extra, updated_by: CURRENT_USER };
  const keys = Object.keys(columns);
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO ${ENTITY_SQL[entity].table} (${keys.join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
    Object.values(columns),
  ).catch((err) => { throw conflictMessage(err); });
  await parsed.links?.(db, rows[0].id);
  return rows[0].id;
}

export async function updateRecord(db: Db, entity: LocationEntity, id: string, columns: Record<string, unknown>, links?: ParsedWrite["links"]) {
  const all = { ...columns, updated_by: CURRENT_USER };
  const keys = Object.keys(all);
  await db.query(
    `UPDATE ${ENTITY_SQL[entity].table} SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1`,
    [id, ...Object.values(all)],
  ).catch((err) => { throw conflictMessage(err); });
  await links?.(db, id);
}

/** Locks and returns the stored row, or 404s. */
export async function lockRow(db: Db, entity: LocationEntity, id: string) {
  const row = await one(db, `SELECT * FROM ${ENTITY_SQL[entity].table} WHERE id = $1 FOR UPDATE`, [id]);
  if (!row) throw notFound(singular(entity));
  return row;
}

// ---------------------------------------------------------------------------
// Deactivate / restore
// ---------------------------------------------------------------------------

/** Why a record can't be deactivated yet (it is still referenced), or null. */
export async function deactivateBlocker(db: Db, entity: LocationEntity, id: string): Promise<string | null> {
  const count = async (sql: string) => Number((await one<{ n: number }>(db, sql, [id]))?.n ?? 0);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  switch (entity) {
    case "countries": {
      const n = await count("SELECT count(*) AS n FROM provinces WHERE country_id = $1 AND NOT is_deleted");
      return n ? `${plural(n, "active province", "active provinces")} still belong to this country` : null;
    }
    case "provinces": {
      const n = await count("SELECT count(*) AS n FROM cities WHERE province_id = $1 AND NOT is_deleted");
      return n ? `${plural(n, "active city", "active cities")} still belong to this province` : null;
    }
    case "cities": {
      const n = await count("SELECT count(*) AS n FROM theatres WHERE city_id = $1");
      return n ? `${plural(n, "theatre", "theatres")} still reference this city` : null;
    }
    default:
      return null;
  }
}

export async function setDeleted(db: Db, entity: LocationEntity, id: string, deleted: boolean, source?: { source: ReferenceSource; ref: string }) {
  if (!ENTITY_SQL[entity].softDelete) throw httpError(400, `${singular(entity)} records can't be deactivated; use Is Active`);
  const row = await lockRow(db, entity, id);
  if (row.is_deleted === deleted) throw httpError(409, `${singular(entity)} is already ${deleted ? "deactivated" : "active"}`);
  if (deleted) {
    const blocker = await deactivateBlocker(db, entity, id);
    if (blocker) throw httpError(409, `Can't deactivate: ${blocker}`);
  } else {
    const parent =
      entity === "provinces" ? await one<{ is_deleted: boolean }>(db, "SELECT is_deleted FROM countries WHERE id = $1", [row.country_id])
      : entity === "cities" ? await one<{ is_deleted: boolean }>(db, "SELECT is_deleted FROM provinces WHERE id = $1", [row.province_id])
      : null;
    if (parent?.is_deleted) throw httpError(409, `Can't restore: its ${entity === "provinces" ? "country" : "province"} is deactivated`);
  }
  const before = await loadRecord(entity, id, db);
  // A deactivated metro area lets go of its cities; its snapshot keeps the list
  if (deleted && entity === "metro_areas") await db.query("UPDATE cities SET metro_area_id = NULL WHERE metro_area_id = $1", [id]);
  await updateRecord(db, entity, id, { is_deleted: deleted });
  const after = await loadRecord(entity, id, db);
  await writeLog(db, entity, id, deleted ? "DEACTIVATE" : "RESTORE", before, after, source);
  return after!;
}
