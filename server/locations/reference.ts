// Downloads and parses the reference feeds Reference sync compares against:
// GeoNames (countries, provinces, cities; CC BY 4.0) and the IANA tz database.
import { inflateRawSync } from "node:zlib";

const GEONAMES = process.env.GEONAMES_BASE_URL ?? "https://download.geonames.org/export/dump";
const IANA = process.env.IANA_TZ_BASE_URL ?? "https://data.iana.org/time-zones/tzdb";
const TIMEOUT_MS = 180_000;

export interface RefCountry {
  geonameId: number;
  iso2: string;
  iso3: string;
  name: string;
  callingCode: string | null;
  currency: string | null;
}
export interface RefProvince {
  /** GeoNames admin1 key, e.g. IN.10 */
  key: string;
  geonameId: number;
  name: string;
  asciiName: string;
  country: string;
}
export interface RefCity {
  geonameId: number;
  name: string;
  asciiName: string;
  alternateNames: string[];
  country: string;
  /** GeoNames admin1 key of its province, e.g. IN.25 */
  provinceKey: string;
  population: number;
  timezone: string;
  latitude: number;
  longitude: number;
}
export interface RefZones {
  version: string;
  /** Canonical zone IDs (zone1970.tab). */
  canonical: Set<string>;
  /** Alias → canonical target (backward). */
  links: Map<string, string>;
}
export interface Reference {
  countries: RefCountry[];
  provinces: RefProvince[];
  cities: RefCity[];
  /** geonameids GeoNames deleted yesterday. */
  deletedCityIds: Set<number>;
  zones: RefZones;
  geonamesDate: string;
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`GET ${url} failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
const downloadText = async (url: string) => (await download(url)).toString("utf8");

/** The single file in a GeoNames .zip (read via its central directory, so data descriptors don't matter). */
export function unzipSingle(zip: Buffer): Buffer {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Not a zip file");
  const cd = zip.readUInt32LE(eocd + 16);
  if (zip.readUInt32LE(cd) !== 0x02014b50) throw new Error("Bad zip central directory");
  const method = zip.readUInt16LE(cd + 10);
  const size = zip.readUInt32LE(cd + 20);
  const local = zip.readUInt32LE(cd + 42);
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const data = zip.subarray(start, start + size);
  if (method === 0) return data;
  if (method === 8) return inflateRawSync(data);
  throw new Error(`Unsupported zip compression method ${method}`);
}

const rows = (text: string) =>
  text.split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.replace(/\r$/, "").split("\t"));

// Dissolved countries countryInfo still lists (Serbia and Montenegro, Netherlands Antilles)
const DISSOLVED = new Set(["CS", "AN"]);

export function parseCountries(text: string): RefCountry[] {
  return rows(text)
    .filter((r) => r[16] && !DISSOLVED.has(r[0]))
    .map((r) => ({
      geonameId: Number(r[16]),
      iso2: r[0],
      iso3: r[1],
      name: r[4],
      callingCode: /\d+/.exec(r[12] ?? "")?.[0] ?? null,
      currency: r[10] || null,
    }));
}

export function parseProvinces(text: string): RefProvince[] {
  return rows(text).map(([key, name, asciiName, id]) => ({
    key, geonameId: Number(id), name, asciiName, country: key.split(".")[0],
  }));
}

export function parseCities(text: string): RefCity[] {
  return rows(text).map((r) => ({
    geonameId: Number(r[0]),
    name: r[1],
    asciiName: r[2],
    alternateNames: r[3] ? r[3].split(",") : [],
    latitude: Number(r[4]),
    longitude: Number(r[5]),
    country: r[8],
    provinceKey: `${r[8]}.${r[10]}`,
    population: Number(r[14]) || 0,
    timezone: r[17],
  }));
}

export function parseZones(zone1970: string, backward: string, version: string): RefZones {
  const canonical = new Set(rows(zone1970).map((r) => r[2]).filter(Boolean));
  const links = new Map<string, string>();
  for (const line of backward.split("\n")) {
    const m = /^Link\s+(\S+)\s+(\S+)/.exec(line);
    if (m) links.set(m[2], m[1]);
  }
  return { version: version.trim(), canonical, links };
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export async function fetchReference(): Promise<Reference> {
  const yesterday = isoDate(new Date(Date.now() - 86_400_000));
  const [countries, provinces, citiesZip, deletes, zone1970, backward, version] = await Promise.all([
    downloadText(`${GEONAMES}/countryInfo.txt`),
    downloadText(`${GEONAMES}/admin1CodesASCII.txt`),
    download(`${GEONAMES}/cities5000.zip`),
    // Published daily; a missing file just means nothing to report
    downloadText(`${GEONAMES}/deletes-${yesterday}.txt`).catch(() => ""),
    downloadText(`${IANA}/zone1970.tab`),
    downloadText(`${IANA}/backward`),
    downloadText(`${IANA}/version`),
  ]);
  return {
    countries: parseCountries(countries),
    provinces: parseProvinces(provinces),
    cities: parseCities(unzipSingle(citiesZip).toString("utf8")),
    deletedCityIds: new Set(rows(deletes).map((r) => Number(r[0])).filter(Boolean)),
    zones: parseZones(zone1970, backward, version),
    geonamesDate: isoDate(new Date()),
  };
}
