// Reference sync: compares CinemaDB's locations with GeoNames and the IANA tz
// database and records every difference as a review item. Nothing is changed
// automatically except linking unlinked records to the reference record they
// match (the one-time backfill), which is logged. Admins decide each item on
// the Review page (server/locations/review.ts).
import { createHash } from "node:crypto";
import { pool, query, transaction } from "../db";
import { CURRENT_USER, httpError } from "../http";
import { writeLog, loadRecord, type Db } from "./records";
import { fetchReference, type Reference, type RefCity } from "./reference";
import { suggestCityCode, type ReferenceSource, type ReviewDifference, type ReviewEntity, type ReviewFlag } from "../../src/data/locationsData";

export const SYNC_USER = "Reference sync";

export interface Finding {
  entity: ReviewEntity;
  flag: ReviewFlag;
  recordId: string | null;
  source: ReferenceSource;
  sourceRef: string;
  reference: Record<string, unknown> | null;
  local: Record<string, unknown> | null;
  differences: ReviewDifference[];
}

export const itemKey = (f: Pick<Finding, "entity" | "flag" | "recordId" | "sourceRef">) =>
  `${f.entity}:${f.flag}:${f.recordId ?? ""}:${f.sourceRef}`;

const fingerprint = (f: Finding) =>
  createHash("sha1").update(JSON.stringify([f.reference, f.local, f.differences])).digest("hex");

/** Accent-, case- and punctuation-insensitive name for matching. */
export const normName = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// ---------------------------------------------------------------------------
// CinemaDB side
// ---------------------------------------------------------------------------

interface DbCountry { id: string; name: string; iso2: string; iso3: string; calling_code: string | null; currency_code: string | null; geoname_id: number | null }
interface DbProvince { id: string; name: string; alternate_name: string | null; iso_code: string; country_id: string; country_iso2: string; geoname_id: number | null; geoname_key: string | null }
interface DbCity {
  id: string; name: string; alternate_name: string | null; code: string | null; province_id: string; province_name: string;
  province_key: string | null; province_iso: string; country_iso2: string; timezone: string; geoname_id: number | null;
}
interface DbZone { id: string; name: string; is_active: boolean }

async function loadLocal(db: Db) {
  const q = async <T>(sql: string) => (await db.query(sql)).rows as T[];
  return {
    countries: await q<DbCountry>(`SELECT id, name, iso3166_2 AS iso2, iso3166_3 AS iso3, calling_code, currency_code, geoname_id
      FROM countries WHERE NOT is_deleted`),
    provinces: await q<DbProvince>(`SELECT p.id, p.name, p.alternate_name, p.iso_code, p.country_id, c.iso3166_2 AS country_iso2,
      p.geoname_id, p.geoname_key FROM provinces p JOIN countries c ON c.id = p.country_id WHERE NOT p.is_deleted`),
    cities: await q<DbCity>(`SELECT ci.id, ci.name, ci.alternate_name, ci.code, ci.province_id, p.name AS province_name,
      p.geoname_key AS province_key, p.iso_code AS province_iso, c.iso3166_2 AS country_iso2, tz.name AS timezone, ci.geoname_id
      FROM cities ci JOIN provinces p ON p.id = ci.province_id JOIN countries c ON c.id = p.country_id
      JOIN timezones tz ON tz.id = ci.timezone_id WHERE NOT ci.is_deleted`),
    timezones: await q<DbZone>("SELECT id, name, is_active FROM timezones"),
  };
}

export async function loadSettings(db: Db = pool) {
  const { rows } = await db.query<{ tracked_country_ids: string[] | null; population_threshold: number; nightly_enabled: boolean }>(
    "SELECT tracked_country_ids, population_threshold, nightly_enabled FROM location_sync_settings");
  return rows[0];
}

/** Country ids whose New provinces and cities are flagged: the setting, or the countries that have theatres. */
export async function trackedCountryIds(db: Db = pool) {
  const settings = await loadSettings(db);
  if (settings.tracked_country_ids) return settings.tracked_country_ids;
  const { rows } = await db.query<{ id: string }>(`SELECT DISTINCT p.country_id AS id FROM theatres t
    JOIN cities ci ON ci.id = t.city_id JOIN provinces p ON p.id = ci.province_id`);
  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Backfill: link unlinked records to the reference record they match
// ---------------------------------------------------------------------------

async function link(db: Db, entity: "countries" | "provinces" | "cities", id: string, columns: Record<string, unknown>, ref: string) {
  const before = await loadRecord(entity, id, db);
  const keys = Object.keys(columns);
  await db.query(
    `UPDATE ${entity} SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`, [id, ...Object.values(columns)]);
  await writeLog(db, entity, id, "LINK", before, await loadRecord(entity, id, db), { source: "geonames", ref });
}

// A reference record another CinemaDB record already links to isn't linked again: that would
// recreate a Duplicate an admin resolved with Keep.
async function backfill(db: Db, ref: Reference, local: Awaited<ReturnType<typeof loadLocal>>) {
  let linked = 0;
  const countryByIso = new Map(ref.countries.map((c) => [c.iso2, c]));
  const takenCountries = new Set(local.countries.map((c) => c.geoname_id));
  for (const c of local.countries.filter((c) => c.geoname_id == null)) {
    const match = countryByIso.get(c.iso2);
    if (!match || takenCountries.has(match.geonameId)) continue;
    takenCountries.add(match.geonameId);
    await link(db, "countries", c.id, { geoname_id: match.geonameId }, String(match.geonameId));
    c.geoname_id = match.geonameId;
    linked++;
  }

  const provincesByCountry = group(ref.provinces, (p) => p.country);
  const takenProvinces = new Set(local.provinces.map((p) => p.geoname_key));
  for (const p of local.provinces.filter((p) => p.geoname_key == null)) {
    const names = [normName(p.name), normName(p.alternate_name)].filter(Boolean);
    const match = (provincesByCountry.get(p.country_iso2) ?? []).find((r) => names.includes(normName(r.name)) || names.includes(normName(r.asciiName)));
    if (!match || takenProvinces.has(match.key)) continue;
    takenProvinces.add(match.key);
    await link(db, "provinces", p.id, { geoname_id: match.geonameId, geoname_key: match.key }, match.key);
    p.geoname_key = match.key;
    p.geoname_id = match.geonameId;
    linked++;
  }

  const citiesByProvince = group(ref.cities, (c) => c.provinceKey);
  const takenCities = new Set(local.cities.map((c) => c.geoname_id));
  for (const c of local.cities.filter((c) => c.geoname_id == null)) {
    const provinceKey = local.provinces.find((p) => p.id === c.province_id)?.geoname_key;
    if (!provinceKey) continue;
    const names = [normName(c.name), normName(c.alternate_name)].filter(Boolean);
    const match = (citiesByProvince.get(provinceKey) ?? [])
      .filter((r) => [r.name, r.asciiName, ...r.alternateNames].some((n) => names.includes(normName(n))))
      .sort((a, b) => b.population - a.population)[0];
    if (!match || takenCities.has(match.geonameId)) continue;
    takenCities.add(match.geonameId);
    await link(db, "cities", c.id, { geoname_id: match.geonameId }, String(match.geonameId));
    c.geoname_id = match.geonameId;
    linked++;
  }
  return linked;
}

function group<T, K>(items: T[], key: (t: T) => K) {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item); else map.set(k, [item]);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

const diff = (field: string, local: unknown, reference: unknown): ReviewDifference[] =>
  (reference ?? null) !== null && String(local ?? "") !== String(reference)
    ? [{ field, local: local == null ? null : String(local), reference: String(reference) }]
    : [];

function duplicates<T extends { id: string; name: string }>(
  entity: ReviewEntity, items: T[], key: (t: T) => string | number | null, reference: (k: string) => Record<string, unknown> | null,
): Finding[] {
  const findings: Finding[] = [];
  for (const [k, list] of group(items.filter((i) => key(i) != null), (i) => String(key(i)))) {
    if (list.length < 2) continue;
    findings.push({
      entity, flag: "duplicate", recordId: null, source: "geonames", sourceRef: k, reference: reference(k),
      local: { records: list.map((r) => ({ id: r.id, name: r.name })) }, differences: [],
    });
  }
  return findings;
}

export function compare(
  ref: Reference,
  local: Awaited<ReturnType<typeof loadLocal>>,
  scope: { trackedIso2: Set<string>; populationThreshold: number },
): Finding[] {
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);

  // Countries
  const refCountryById = new Map(ref.countries.map((c) => [c.geonameId, c]));
  const refCountryByIso = new Map(ref.countries.map((c) => [c.iso2, c]));
  for (const c of local.countries) {
    const r = (c.geoname_id != null && refCountryById.get(c.geoname_id)) || refCountryByIso.get(c.iso2);
    const localData = { name: c.name, iso2: c.iso2, iso3: c.iso3, callingCode: c.calling_code, currency: c.currency_code };
    if (!r) {
      add({ entity: "countries", flag: "missing", recordId: c.id, source: "geonames", sourceRef: "", reference: null, local: localData, differences: [] });
      continue;
    }
    const differences = [
      ...diff("ISO 3166-2", c.iso2, r.iso2), ...diff("ISO 3166-3", c.iso3, r.iso3),
      ...diff("Calling Code", c.calling_code, r.callingCode), ...diff("Currency", c.currency_code, r.currency),
    ];
    if (differences.length) {
      add({ entity: "countries", flag: "mismatch", recordId: c.id, source: "geonames", sourceRef: String(r.geonameId),
        reference: { ...r }, local: localData, differences });
    }
  }
  findings.push(...duplicates("countries", local.countries, (c) => c.geoname_id,
    (k) => { const r = refCountryById.get(Number(k)); return r ? { ...r } : null; }));
  const localIso = new Set(local.countries.map((c) => c.iso2));
  const linkedCountries = new Set(local.countries.map((c) => c.geoname_id));
  for (const r of ref.countries) {
    if (localIso.has(r.iso2) || linkedCountries.has(r.geonameId)) continue;
    add({ entity: "countries", flag: "new", recordId: null, source: "geonames", sourceRef: String(r.geonameId), reference: { ...r }, local: null, differences: [] });
  }

  // Provinces
  const refProvinceByKey = new Map(ref.provinces.map((p) => [p.key, p]));
  for (const p of local.provinces) {
    const r = p.geoname_key ? refProvinceByKey.get(p.geoname_key) : undefined;
    const localData = { name: p.name, isoCode: p.iso_code, country: p.country_iso2 };
    const prefix = p.iso_code.toUpperCase().startsWith(`${p.country_iso2}-`)
      ? [] : [{ field: "ISO Code", local: p.iso_code, reference: `${p.country_iso2}-…` }];
    if (!r) {
      add({ entity: "provinces", flag: "missing", recordId: p.id, source: "geonames", sourceRef: p.geoname_key ?? "", reference: null, local: localData, differences: prefix });
      continue;
    }
    const differences = [...diff("Country", p.country_iso2, r.country), ...prefix];
    if (differences.length) {
      add({ entity: "provinces", flag: "mismatch", recordId: p.id, source: "geonames", sourceRef: r.key,
        reference: { ...r }, local: localData, differences });
    }
  }
  findings.push(...duplicates("provinces", local.provinces, (p) => p.geoname_key,
    (k) => { const r = refProvinceByKey.get(k); return r ? { ...r } : null; }));
  const linkedProvinces = new Set(local.provinces.map((p) => p.geoname_key));
  for (const r of ref.provinces) {
    if (!scope.trackedIso2.has(r.country) || linkedProvinces.has(r.key)) continue;
    add({ entity: "provinces", flag: "new", recordId: null, source: "geonames", sourceRef: r.key, reference: { ...r }, local: null, differences: [] });
  }

  // Cities
  const refCityById = new Map(ref.cities.map((c) => [c.geonameId, c]));
  const provinceByKey = new Map(local.provinces.filter((p) => p.geoname_key).map((p) => [p.geoname_key!, p]));
  // From the provinces, which the backfill may just have linked
  const provinceKeyOf = new Map(local.provinces.map((p) => [p.id, p.geoname_key]));
  const provinceLabel = (key: string) => provinceByKey.get(key)?.name ?? refProvinceByKey.get(key)?.name ?? key;
  const cityRef = (r: RefCity) => ({
    geonameId: r.geonameId, name: r.name, asciiName: r.asciiName, provinceKey: r.provinceKey, provinceName: provinceLabel(r.provinceKey),
    country: r.country, population: r.population, timezone: r.timezone, latitude: r.latitude, longitude: r.longitude,
  });
  for (const c of local.cities) {
    const localData = { name: c.name, code: c.code, province: c.province_name, timezone: c.timezone };
    const code = c.code && !c.code.toUpperCase().startsWith(`${c.province_iso}-`)
      ? [{ field: "Code", local: c.code, reference: suggestCityCode(c.name, c.province_iso) }] : [];
    if (c.geoname_id == null || ref.deletedCityIds.has(c.geoname_id)) {
      add({ entity: "cities", flag: "missing", recordId: c.id, source: "geonames", sourceRef: c.geoname_id ? String(c.geoname_id) : "",
        reference: null, local: localData, differences: code });
      continue;
    }
    // Cities below the reference's population cut-off aren't in cities5000; only the code rule applies to them
    const r = refCityById.get(c.geoname_id);
    const differences = [
      ...(r && r.provinceKey !== provinceKeyOf.get(c.province_id) ? [{ field: "Province", local: c.province_name, reference: provinceLabel(r.provinceKey) }] : []),
      ...(r ? diff("Timezone", c.timezone, r.timezone) : []),
      ...code,
    ];
    if (differences.length) {
      add({ entity: "cities", flag: "mismatch", recordId: c.id, source: "geonames", sourceRef: String(c.geoname_id),
        reference: r ? cityRef(r) : null, local: localData, differences });
    }
  }
  findings.push(...duplicates("cities", local.cities, (c) => c.geoname_id,
    (k) => { const r = refCityById.get(Number(k)); return r ? cityRef(r) : null; }));
  const linkedCities = new Set(local.cities.map((c) => c.geoname_id));
  for (const r of ref.cities) {
    if (!scope.trackedIso2.has(r.country) || r.population < scope.populationThreshold || linkedCities.has(r.geonameId)) continue;
    add({ entity: "cities", flag: "new", recordId: null, source: "geonames", sourceRef: String(r.geonameId), reference: cityRef(r), local: null, differences: [] });
  }

  // Timezones
  const localZones = new Set(local.timezones.map((z) => z.name));
  for (const z of local.timezones) {
    // An inactive zone is already retired (e.g. an alias after Link or fix)
    if (ref.zones.canonical.has(z.name) || !z.is_active) continue;
    const target = ref.zones.links.get(z.name);
    if (target) {
      add({ entity: "timezones", flag: "mismatch", recordId: z.id, source: "iana", sourceRef: target,
        reference: { name: target, targetInCinemaDB: localZones.has(target) }, local: { name: z.name, isActive: z.is_active },
        differences: [{ field: "Name (alias)", local: z.name, reference: target }] });
    } else {
      add({ entity: "timezones", flag: "missing", recordId: z.id, source: "iana", sourceRef: "", reference: null,
        local: { name: z.name, isActive: z.is_active }, differences: [] });
    }
  }
  for (const name of ref.zones.canonical) {
    if (localZones.has(name)) continue;
    add({ entity: "timezones", flag: "new", recordId: null, source: "iana", sourceRef: name, reference: { name }, local: null, differences: [] });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Recording findings
// ---------------------------------------------------------------------------

async function recordFindings(db: Db, runId: number, findings: Finding[]) {
  const { rows: existing } = await db.query<{ item_key: string; status: string; fingerprint: string }>(
    "SELECT item_key, status, fingerprint FROM location_review_items");
  const before = new Map(existing.map((e) => [e.item_key, e]));
  let opened = 0;
  let reopened = 0;

  const records = findings.map((f) => {
    const key = itemKey(f);
    const fp = fingerprint(f);
    const prev = before.get(key);
    if (!prev) opened++;
    else if (prev.status === "resolved" || (prev.status === "ignored" && prev.fingerprint !== fp)) reopened++;
    return {
      entity: f.entity, flag: f.flag, record_id: f.recordId, source: f.source, source_ref: f.sourceRef, item_key: key,
      fingerprint: fp, reference: f.reference, local: f.local, differences: f.differences,
    };
  });

  // An open item stays open; an ignored one reopens only when the reference or CinemaDB values change;
  // a resolved one that is detected again reopens.
  for (let i = 0; i < records.length; i += 2000) {
    await db.query(
      `INSERT INTO location_review_items
         (entity, flag, record_id, source, source_ref, item_key, fingerprint, reference, local, differences, last_run_id)
       SELECT x.entity, x.flag, x.record_id, x.source, x.source_ref, x.item_key, x.fingerprint, x.reference, x.local, x.differences, $2
       FROM jsonb_to_recordset($1::jsonb) AS x(entity text, flag text, record_id text, source text, source_ref text,
         item_key text, fingerprint text, reference jsonb, local jsonb, differences jsonb)
       ON CONFLICT (item_key) DO UPDATE SET
         reference = EXCLUDED.reference, local = EXCLUDED.local, differences = EXCLUDED.differences,
         last_seen_at = now(), last_run_id = EXCLUDED.last_run_id, fingerprint = EXCLUDED.fingerprint,
         status = CASE WHEN location_review_items.status = 'ignored' AND location_review_items.fingerprint = EXCLUDED.fingerprint
                       THEN 'ignored' ELSE 'open' END,
         resolution = CASE WHEN location_review_items.status = 'ignored' AND location_review_items.fingerprint = EXCLUDED.fingerprint
                           THEN location_review_items.resolution END,
         resolved_by = CASE WHEN location_review_items.status = 'ignored' AND location_review_items.fingerprint = EXCLUDED.fingerprint
                            THEN location_review_items.resolved_by END,
         resolved_at = CASE WHEN location_review_items.status = 'ignored' AND location_review_items.fingerprint = EXCLUDED.fingerprint
                            THEN location_review_items.resolved_at END`,
      [JSON.stringify(records.slice(i, i + 2000)), runId],
    );
  }

  // Open items this run no longer detects were fixed some other way
  const { rowCount: closed } = await db.query(
    `UPDATE location_review_items SET status = 'resolved', resolution = 'cleared', resolved_by = $2, resolved_at = now()
     WHERE status = 'open' AND last_run_id IS DISTINCT FROM $1`, [runId, SYNC_USER]);
  return { opened, reopened, closed: closed ?? 0 };
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

/** Compares against `ref` and records the findings; exported for tests and seeding. */
export async function syncWith(db: Db, runId: number, ref: Reference) {
  const local = await loadLocal(db);
  const settings = await loadSettings(db);
  const tracked = await trackedCountryIds(db);
  const trackedIso2 = new Set(local.countries.filter((c) => tracked.includes(c.id)).map((c) => c.iso2));
  const linked = await backfill(db, ref, local);
  const findings = compare(ref, local, { trackedIso2, populationThreshold: settings.population_threshold });
  const counts = await recordFindings(db, runId, findings);
  return { linked, detected: findings.length, ...counts };
}

/** Starts a run in the background; returns its id. 409 if one is already running. */
export async function startSync(trigger: "nightly" | "manual") {
  const [run] = await query<{ id: number }>(
    "INSERT INTO location_sync_runs (trigger, started_by) VALUES ($1, $2) RETURNING id",
    [trigger, trigger === "manual" ? CURRENT_USER : SYNC_USER],
  ).catch((err) => {
    if (err?.code === "23505") throw httpError(409, "A reference sync is already running");
    throw err;
  });
  void runSync(run.id);
  return run.id;
}

async function runSync(runId: number) {
  try {
    const ref = await fetchReference();
    const counts = await transaction((db) => syncWith(db, runId, ref));
    const summary = {
      ...counts,
      sources: { geonames: ref.geonamesDate, iana: ref.zones.version, runtimeTz: process.versions.tz ?? null },
    };
    await query("UPDATE location_sync_runs SET status = 'succeeded', finished_at = now(), summary = $2 WHERE id = $1", [runId, summary]);
  } catch (err) {
    console.error("Reference sync failed", err);
    await query("UPDATE location_sync_runs SET status = 'failed', finished_at = now(), error = $2 WHERE id = $1",
      [runId, err instanceof Error ? err.message : String(err)]).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Nightly schedule
// ---------------------------------------------------------------------------

const NIGHTLY_HOUR = Number(process.env.LOCATION_SYNC_HOUR ?? 2);

/** Runs the sync every night at LOCATION_SYNC_HOUR (server time) while nightly runs are enabled. */
export async function startNightlySync() {
  if (process.env.LOCATION_SYNC_SCHEDULE === "off") return;
  // A run the server was killed during will never finish
  await query("UPDATE location_sync_runs SET status = 'failed', finished_at = now(), error = 'Interrupted' WHERE status = 'running'")
    .catch(() => {});
  const scheduleNext = () => {
    const next = new Date();
    next.setHours(NIGHTLY_HOUR, 0, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
    setTimeout(async () => {
      try {
        if ((await loadSettings()).nightly_enabled) await startSync("nightly");
      } catch (err) {
        console.error("Nightly reference sync did not start", err);
      }
      scheduleNext();
    }, next.getTime() - Date.now()).unref();
  };
  scheduleNext();
}
