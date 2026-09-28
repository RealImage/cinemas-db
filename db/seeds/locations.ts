// Locations master data from db/seeds/data/locations.json: every country, and
// the provinces and cities (population ≥ 100,000) of the countries that have
// theatres, from GeoNames (CC BY 4.0, geonames.org); timezones from the IANA
// tz database. Then links theatres to their city.
//
// A few records reproduce data-quality problems seen in production, so the
// Reference sync Review page has something to show: a test province, a city
// code with another province's prefix, a city filed under the wrong province,
// a second city linked to Mumbai's GeoNames record, and legacy timezone aliases.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import type { ExtraSeeder } from "./types";

interface SeedData {
  timezones: { name: string; displayName: string | null }[];
  countries: {
    geonameId: number; name: string; iso2: string; iso3: string; callingCode: string | null; currency: string | null;
    localLanguageName: string | null; timezones: string[];
  }[];
  provinces: { geonameKey: string; geonameId: number; country: string; name: string; isoCode: string }[];
  cities: {
    geonameId: number; name: string; alternateName?: string; province: string; timezone: string; population: number;
    latitude: number; longitude: number; code: string;
  }[];
  metroAreas: { name: string; cities: number[] }[];
}

const SEED_USER = "GeoNames import";

const data = (): SeedData =>
  JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "locations.json"), "utf8"));

/** Bulk insert rows (objects keyed by column) and return {key column → id}. */
async function insertRows(client: pg.Client, table: string, key: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return new Map<string, string>();
  const columns = Object.keys(rows[0]);
  const types = await columnTypes(client, table, columns);
  const ids = new Map<string, string>();
  for (let i = 0; i < rows.length; i += 1000) {
    const { rows: out } = await client.query<{ id: string; k: string }>(
      `INSERT INTO ${table} (${columns.join(", ")})
       SELECT ${columns.join(", ")} FROM jsonb_to_recordset($1::jsonb) AS x(${columns.map((c) => `${c} ${types[c]}`).join(", ")})
       RETURNING id, ${key}::text AS k`,
      [JSON.stringify(rows.slice(i, i + 1000))],
    );
    for (const r of out) ids.set(r.k, r.id);
  }
  return ids;
}

async function columnTypes(client: pg.Client, table: string, columns: string[]) {
  const { rows } = await client.query<{ column_name: string; data_type: string; udt_name: string }>(
    "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = $1 AND column_name = ANY($2)",
    [table, columns]);
  return Object.fromEntries(rows.map((r) => [r.column_name, r.data_type === "ARRAY" ? `${r.udt_name.slice(1)}[]` : r.data_type]));
}

// Theatre country/state/city text as the mock data spells it → the seeded record
const COUNTRY_ALIASES: Record<string, string> = { USA: "US", UK: "GB", "South Korea": "KR" };
const CITY_ALIASES: Record<string, string> = { "New York": "New York City" };

export const locationsSeeder: ExtraSeeder = {
  name: "locations",
  // Reset in run(): TRUNCATE … CASCADE on cities would also empty theatres, which reference them
  tables: [],
  async run(client) {
    await refuseToDiscardEdits(client);
    await client.query("UPDATE theatres SET city_id = NULL WHERE city_id IS NOT NULL");
    await client.query(`DELETE FROM location_review_items; DELETE FROM location_sync_runs; DELETE FROM location_logs;
      DELETE FROM timezone_popular_cities; DELETE FROM country_timezones; DELETE FROM cities; DELETE FROM metro_areas;
      DELETE FROM provinces; DELETE FROM countries; DELETE FROM timezones;
      UPDATE location_sync_settings SET tracked_country_ids = NULL, population_threshold = 5000, nightly_enabled = true`);

    const d = data();
    // Legacy aliases a real CinemaDB carries (e.g. Asia/Calcutta for Asia/Kolkata); Reference sync flags them
    const aliases = [{ name: "Asia/Calcutta", displayName: "India Standard Time" }, { name: "Europe/Kiev", displayName: "Eastern European Time" }];
    const tzIds = await insertRows(client, "timezones", "name",
      [...d.timezones, ...aliases].map((t) => ({ name: t.name, display_name: t.displayName, updated_by: SEED_USER })));

    const countryIds = await insertRows(client, "countries", "iso3166_2", d.countries.map((c) => ({
      name: c.name, iso3166_2: c.iso2, iso3166_3: c.iso3, calling_code: c.callingCode, currency_code: c.currency,
      local_language_name: c.localLanguageName, geoname_id: c.geonameId, updated_by: SEED_USER,
    })));
    const links = d.countries.flatMap((c) => c.timezones.map((tz) => [countryIds.get(c.iso2), tzIds.get(tz)]));
    await client.query(
      "INSERT INTO country_timezones (country_id, timezone_id) SELECT * FROM unnest($1::text[], $2::text[])",
      [links.map((l) => l[0]), links.map((l) => l[1])]);

    const provinceIds = await insertRows(client, "provinces", "geoname_key", d.provinces.map((p) => ({
      country_id: countryIds.get(p.country), name: p.name, iso_code: p.isoCode, geoname_id: p.geonameId,
      geoname_key: p.geonameKey, updated_by: SEED_USER,
    })));
    const provinceByKey = new Map(d.provinces.map((p) => [p.geonameKey, p]));

    const metroIds = await insertRows(client, "metro_areas", "name", d.metroAreas.map((m) => ({ name: m.name, updated_by: SEED_USER })));
    const metroOf = new Map(d.metroAreas.flatMap((m) => m.cities.map((id) => [id, metroIds.get(m.name)])));

    const cityIds = await insertRows(client, "cities", "geoname_id", d.cities.map((c) => ({
      province_id: provinceIds.get(c.province), timezone_id: tzIds.get(c.timezone), metro_area_id: metroOf.get(c.geonameId) ?? null,
      name: c.name, code: c.code, alternate_name: c.alternateName ?? null, latitude: c.latitude, longitude: c.longitude,
      population: c.population, geoname_id: c.geonameId, updated_by: SEED_USER,
    })));

    // Popular cities: each zone's three largest seeded cities
    await client.query(`INSERT INTO timezone_popular_cities (timezone_id, city_id, position)
      SELECT timezone_id, id, rn FROM (
        SELECT timezone_id, id, row_number() OVER (PARTITION BY timezone_id ORDER BY population DESC NULLS LAST) AS rn FROM cities
      ) ranked WHERE rn <= 3`);

    await seedQuirks(client, { countryIds, provinceIds, cityIds, tzIds, provinceByKey });
    const linked = await linkTheatres(client);
    console.log(`  locations: ${countryIds.size} countries, ${provinceIds.size} provinces, ${cityIds.size} cities, ` +
      `${metroIds.size} metro areas, ${tzIds.size} timezones; ${linked} theatres linked to a city`);
  },
};

/**
 * Re-seeding replaces every location record, its audit log and the review queue.
 * Once admins have changed anything (a log entry exists), that needs an explicit --force.
 */
async function refuseToDiscardEdits(client: pg.Client) {
  if (process.argv.includes("--force")) return;
  const { rows } = await client.query<{ edited: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM location_logs) OR EXISTS (SELECT 1 FROM location_review_items WHERE status <> 'open') AS edited");
  if (rows[0].edited) {
    throw new Error("Locations have been edited or reviewed; re-seeding would discard those changes and their logs. " +
      "Re-run with --force to replace them (e.g. npm run db:seed:one -- locations --force).");
  }
}

async function seedQuirks(
  client: pg.Client,
  ids: { countryIds: Map<string, string>; provinceIds: Map<string, string>; cityIds: Map<string, string>; tzIds: Map<string, string>;
    provinceByKey: Map<string, SeedData["provinces"][number]> },
) {
  const q = (sql: string, args: unknown[]) => client.query(sql, args);
  // Test record in production (not in GeoNames → Missing)
  await q("INSERT INTO provinces (country_id, name, iso_code, updated_by) VALUES ($1, 'test', 'SDFDF', '')", [ids.countryIds.get("IN")]);
  // Pasadena, CA with an Oregon code (→ Mismatch: Code)
  await q("UPDATE cities SET code = 'US-OR-PASAD' WHERE geoname_id = 5381396", []);
  // Navi Mumbai filed under Gujarat (→ Mismatch: Province)
  await q("UPDATE cities SET province_id = $1, code = 'IN-GJ-NAVIM' WHERE geoname_id = 6619347", [ids.provinceIds.get("IN.09")]);
  // Mumbai's old name as a second record linked to the same GeoNames city (→ Duplicate)
  await q(`INSERT INTO cities (province_id, timezone_id, name, code, geoname_id, updated_by)
    VALUES ($1, $2, 'Bombay', 'IN-MH-BOMAY', 1275339, '')`, [ids.provinceIds.get("IN.16"), ids.tzIds.get("Asia/Calcutta")]);
}

/** Point each theatre at the seeded city its country/state/city text names. */
async function linkTheatres(client: pg.Client) {
  const { rows: theatres } = await client.query<{ id: string; city: string | null; state: string | null; country: string | null }>(
    "SELECT id, city, state, country FROM theatres WHERE city IS NOT NULL AND city <> ''");
  const { rows: cities } = await client.query<{
    id: string; name: string; alternate_name: string | null; province: string; province_iso: string; country: string; iso2: string;
    tz: string; population: number | null;
  }>(`SELECT ci.id, ci.name, ci.alternate_name, p.name AS province, p.iso_code AS province_iso, c.name AS country, c.iso3166_2 AS iso2,
        tz.name AS tz, ci.population
      FROM cities ci JOIN provinces p ON p.id = ci.province_id JOIN countries c ON c.id = p.country_id
      JOIN timezones tz ON tz.id = ci.timezone_id WHERE NOT ci.is_deleted`);
  const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

  let linked = 0;
  for (const t of theatres) {
    const iso2 = COUNTRY_ALIASES[t.country ?? ""] ?? t.country ?? "";
    const cityName = norm(CITY_ALIASES[t.city!] ?? t.city);
    const inCountry = cities.filter((c) => (c.iso2 === iso2 || norm(c.country) === norm(t.country))
      && (norm(c.name) === cityName || norm(c.alternate_name) === cityName));
    const state = norm(t.state);
    const match = inCountry.find((c) => norm(c.province) === state || norm(c.province_iso) === `${norm(c.iso2)}-${state}`)
      ?? inCountry.sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];
    if (!match) continue;
    await client.query(
      "UPDATE theatres SET city_id = $2, city = $3, state = $4, country = $5, timezone = coalesce($6, timezone) WHERE id = $1",
      [t.id, match.id, match.name, match.province, match.country, match.tz]);
    linked++;
  }
  return linked;
}
