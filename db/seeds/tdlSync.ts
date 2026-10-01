import type { ExtraSeeder } from "./types";

/** mulberry32: small deterministic PRNG. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Source = {
  /** As in tdl_devices.manufacturer. */
  manufacturer: string;
  /** Illustrative hosts only, not real vendor FTP sites. */
  ftpUrl: string;
  rootDir: string;
  enabled: boolean;
  schedule: string;
  everyHours: number;
  runs: number;
  /** The schedule's time of day, in minutes after midnight UTC. */
  atMin: number;
  /** Certificate files on the site (what a full sync lists). */
  siteFiles: number;
  /** Certificates per file: >1 where the manufacturer ships zip / tar.gz bundles. */
  certsPerFile: number;
};

// No usernames or passwords: the sync job reads those from the Credentials Manager.
const SOURCES: Source[] = [
  { manufacturer: "Barco", ftpUrl: "ftps://certs.barco.example/dcinema", rootDir: "/certificates", enabled: true, schedule: "Daily at 01:30 UTC", everyHours: 24, runs: 14, atMin: 90, siteFiles: 1840, certsPerFile: 1 },
  { manufacturer: "Christie", ftpUrl: "ftps://ftp.christiedigital.example", rootDir: "/Certificates/Series4", enabled: true, schedule: "Daily at 02:00 UTC", everyHours: 24, runs: 14, atMin: 120, siteFiles: 1320, certsPerFile: 1 },
  { manufacturer: "Dolby", ftpUrl: "ftps://certs.dolby.example/cinema", rootDir: "/IMS3000/leaf", enabled: true, schedule: "Every 12 hours (03:00, 15:00 UTC)", everyHours: 12, runs: 28, atMin: 180, siteFiles: 640, certsPerFile: 3 },
  { manufacturer: "GDC", ftpUrl: "ftp://ftp.gdc-tech.example", rootDir: "/DeviceCerts/SR-1000", enabled: true, schedule: "Daily at 04:00 UTC", everyHours: 24, runs: 14, atMin: 240, siteFiles: 960, certsPerFile: 2 },
  { manufacturer: "IMAX", ftpUrl: "ftps://certs.imax.example/dcinema", rootDir: "/leaf-certificates", enabled: true, schedule: "Daily at 05:00 UTC", everyHours: 24, runs: 14, atMin: 300, siteFiles: 210, certsPerFile: 1 },
  { manufacturer: "JBL", ftpUrl: "ftps://certs.jblpro.example/cinema", rootDir: "/certificates", enabled: false, schedule: "Daily at 05:30 UTC", everyHours: 24, runs: 0, atMin: 330, siteFiles: 0, certsPerFile: 1 },
  { manufacturer: "NEC", ftpUrl: "ftps://dcinema-certs.nec-display.example", rootDir: "/NC-Series/certs", enabled: true, schedule: "Daily at 06:00 UTC", everyHours: 24, runs: 14, atMin: 360, siteFiles: 1150, certsPerFile: 1 },
  { manufacturer: "Panasonic", ftpUrl: "ftps://certs.panasonic-pro.example", rootDir: "/projector/dcinema", enabled: true, schedule: "Daily at 06:30 UTC", everyHours: 24, runs: 14, atMin: 390, siteFiles: 380, certsPerFile: 1 },
  { manufacturer: "QSC", ftpUrl: "ftps://certs.qsc.example", rootDir: "/DCP-Series", enabled: true, schedule: "Daily at 07:00 UTC", everyHours: 24, runs: 14, atMin: 420, siteFiles: 290, certsPerFile: 2 },
  { manufacturer: "Sony", ftpUrl: "ftps://ftp.sony-dcinema.example", rootDir: "/SRX/certificates", enabled: true, schedule: "Daily at 07:30 UTC", everyHours: 24, runs: 14, atMin: 450, siteFiles: 720, certsPerFile: 1 },
];

/** Latest run's status where the page should show a state other than Success. */
const LATEST: Record<string, "Failed" | "Partial"> = { Christie: "Failed", NEC: "Partial" };
/** Forced failure messages (by manufacturer and run index), so the log always shows each kind. */
const FORCED_FAILURE: Record<string, Record<number, number>> = { Christie: { 0: 0 }, GDC: { 3: 2 }, Sony: { 5: 3 }, Barco: { 9: 1 } };

const host = (url: string) => new URL(url).host;
const n = (x: number) => x.toLocaleString("en-US");
const plural = (x: number, one: string, many = `${one}s`) => `${n(x)} ${x === 1 ? one : many}`;

/** Failed runs: the FTP connection or listing failed, so nothing was fetched. */
const FAILURES: ((s: Source) => string)[] = [
  () => "530 Login incorrect; check the manufacturer's FTP credentials in Credentials Manager",
  (s) => `Connection to ${host(s.ftpUrl)}:21 timed out after 60 s`,
  (s) => `550 ${s.rootDir}: Directory not found`,
  (s) => `TLS handshake failed with ${host(s.ftpUrl)}: certificate has expired`,
  () => "421 Too many connections from this IP; try again later",
];

/** Partial runs: some certificates or files were rejected, the rest saved. */
const PARTIALS: ((invalid: number, parsed: number, errors: number) => string)[] = [
  (invalid, parsed) => `${invalid} of ${plural(parsed, "certificate")} rejected: This certificate is already expired`,
  (invalid, parsed) => `${invalid} of ${plural(parsed, "certificate")} rejected: This is not a SHA256 certificate (SHA-1 certificates are not processed)`,
  (invalid, parsed) => `${invalid} of ${plural(parsed, "certificate")} rejected: Invalid model for the serial number`,
  (invalid, parsed) => `${invalid} of ${plural(parsed, "certificate")} rejected: This is not a leaf certificate`,
  (_invalid, _parsed, errors) => `${plural(errors, "file")} could not be extracted: Zip end of central directory signature not found`,
];

type Run = {
  manufacturer: string; started_at: string; finished_at: string; status: string; files_found: number;
  certificates_parsed: number; devices_added: number; devices_updated: number; invalid_certificates: number;
  errors: number; message: string; triggered_by: string;
};

const successMessage = (files: number, parsed: number, added: number, updated: number, full: boolean) =>
  full
    ? `Full sync: ${plural(files, "file")} listed, ${plural(parsed, "certificate")} parsed; ${n(added)} added, ${n(updated)} updated`
    : files
      ? `Fetched ${plural(files, "new or changed file")}; ${plural(parsed, "certificate")} parsed, ${n(added)} added, ${n(updated)} updated`
      : "No new or changed certificate files since the last sync";

/** A manufacturer's run history: mostly successful scheduled runs, a weekly full sync, a few partial or failed ones. */
function runsFor(s: Source, seed: number, now: number): Run[] {
  // The most recent scheduled time at or before now, stepping back a slot while the history would end after now
  // (a run started just before now, or a long full sync, still finishing)
  const every = s.everyHours * 3_600_000;
  const anchor = new Date(now).setUTCHours(0, s.atMin, 0, 0);
  for (let last = anchor + every * Math.floor((now - anchor) / every); ; last -= every) {
    const runs = runsFrom(s, seed, last);
    if (runs.every((r) => Date.parse(r.finished_at) <= now)) return runs;
  }
}

function runsFrom(s: Source, seed: number, last: number): Run[] {
  const rand = prng(seed);
  const int = (n: number) => Math.floor(rand() * n);
  const runs: Run[] = [];
  const every = s.everyHours * 3_600_000;
  for (let i = 0; i < s.runs; i++) {
    const started = new Date(last - i * every + int(50) * 1000);
    const forced = FORCED_FAILURE[s.manufacturer]?.[i];
    const r = rand();
    const status = forced !== undefined ? "Failed" : i === 0 ? LATEST[s.manufacturer] ?? "Success" : r < 0.05 ? "Failed" : r < 0.17 ? "Partial" : "Success";
    const fullSync = started.getUTCDay() === 0 && (s.everyHours >= 24 || started.getUTCHours() < 12);
    let files = 0, parsed = 0, added = 0, updated = 0, invalid = 0, errors = 0, message = "", seconds: number;
    if (status === "Failed") {
      message = FAILURES[forced ?? int(FAILURES.length)](s);
      errors = 1;
      seconds = message.includes("timed out") ? 60 : 1 + int(5);
    } else {
      files = fullSync ? s.siteFiles + int(8) : Math.floor(rand() * rand() * 40);
      if (status === "Partial") files = Math.max(files, 6);
      parsed = files * s.certsPerFile - (s.certsPerFile > 1 && files ? int(s.certsPerFile) : 0);
      // A full sync re-reads every file: the expired ones are skipped without failing the run.
      invalid = fullSync ? 3 + int(12) : 0;
      if (status === "Partial") {
        const kind = int(PARTIALS.length);
        if (kind === PARTIALS.length - 1) {
          errors = 1 + int(2);
          parsed = Math.max(parsed - errors * s.certsPerFile, 0);
        } else {
          invalid += 1 + int(4);
        }
        message = PARTIALS[kind](invalid, parsed, errors);
      }
      invalid = Math.min(invalid, parsed);
      const valid = parsed - invalid;
      added = valid ? Math.min(valid, int(fullSync ? 8 : 4)) : 0;
      updated = valid - added;
      if (status === "Success") {
        message = successMessage(files, parsed, added, updated, fullSync);
        if (fullSync && invalid) message += `; ${n(invalid)} expired skipped`;
      }
      seconds = 3 + Math.round(files * (0.6 + rand() * 0.8)) + int(10);
    }
    runs.push({
      manufacturer: s.manufacturer,
      started_at: started.toISOString(),
      finished_at: new Date(started.getTime() + seconds * 1000).toISOString(),
      status, files_found: files, certificates_parsed: parsed, devices_added: added, devices_updated: updated,
      invalid_certificates: invalid, errors, message, triggered_by: "Scheduler",
    });
    // A user re-ran a failed sync about an hour later, once the FTP site was reachable again.
    if (status === "Failed" && i > 0) {
      const retry = new Date(started.getTime() + 64 * 60_000);
      const f = Math.floor(rand() * 20);
      const p = f * s.certsPerFile;
      const a = p ? Math.min(p, 1 + int(2)) : 0;
      runs.push({
        manufacturer: s.manufacturer, started_at: retry.toISOString(),
        finished_at: new Date(retry.getTime() + (4 + f) * 1000).toISOString(),
        status: "Success", files_found: f, certificates_parsed: p, devices_added: a, devices_updated: p - a,
        invalid_certificates: 0, errors: 0, message: successMessage(f, p, a, p - a, false), triggered_by: "Harshit Thakkar",
      });
    }
  }
  return runs;
}

/**
 * TDL sync sources (one per manufacturer in tdl_devices; JBL disabled and never synced) and about two weeks of
 * certificate sync runs, relative to now. Deterministic apart from the anchor time. Migration 025 backfills the same
 * sources with a smaller sample.
 */
export const tdlSyncSeeder: ExtraSeeder = {
  name: "tdlSync",
  tables: ["tdl_sync_runs", "tdl_sync_sources"],
  async run(client) {
    const { rows } = await client.query<{ manufacturer: string }>("SELECT DISTINCT manufacturer FROM tdl_devices");
    const known = new Set(rows.map((r) => r.manufacturer));
    const sources = SOURCES.filter((s) => known.has(s.manufacturer));
    const now = Math.floor(Date.now() / 60_000) * 60_000;
    const runs = sources.flatMap((s, i) => runsFor(s, 8101 + i, now));

    await client.query(
      `INSERT INTO tdl_sync_sources (manufacturer, ftp_url, root_dir, enabled, schedule, last_status, last_synced_at, last_message, updated_by)
       SELECT v.manufacturer, v.ftp_url, v.root_dir, v.enabled, v.schedule, 'Never', NULL, NULL, 'System'
       FROM json_to_recordset($1) AS v(manufacturer text, ftp_url text, root_dir text, enabled boolean, schedule text)
       ON CONFLICT (manufacturer) DO UPDATE SET ftp_url = excluded.ftp_url, root_dir = excluded.root_dir,
         enabled = excluded.enabled, schedule = excluded.schedule, last_status = 'Never', last_synced_at = NULL,
         last_message = NULL, updated_by = excluded.updated_by, updated_at = now()`,
      [JSON.stringify(sources.map((s) => ({ manufacturer: s.manufacturer, ftp_url: s.ftpUrl, root_dir: s.rootDir, enabled: s.enabled, schedule: s.schedule })))],
    );
    await client.query("DELETE FROM tdl_sync_runs WHERE manufacturer = ANY($1)", [sources.map((s) => s.manufacturer)]);
    await client.query(
      `INSERT INTO tdl_sync_runs (manufacturer, started_at, finished_at, status, files_found, certificates_parsed,
                                  devices_added, devices_updated, invalid_certificates, errors, message, triggered_by)
       SELECT * FROM json_to_recordset($1) AS v(manufacturer text, started_at timestamptz, finished_at timestamptz,
         status text, files_found int, certificates_parsed int, devices_added int, devices_updated int,
         invalid_certificates int, errors int, message text, triggered_by text)
       ORDER BY started_at`,
      [JSON.stringify(runs)],
    );
    await client.query(
      `UPDATE tdl_sync_sources s
       SET last_synced_at = coalesce(r.finished_at, r.started_at), last_status = r.status, last_message = r.message
       FROM (SELECT DISTINCT ON (manufacturer) * FROM tdl_sync_runs ORDER BY manufacturer, started_at DESC) r
       WHERE r.manufacturer = s.manufacturer`,
    );
  },
};
