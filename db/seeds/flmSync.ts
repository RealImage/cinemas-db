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
  providerId: string;
  /** Illustrative hosts only, not real vendor endpoints. */
  syncUrl: string;
  enabled: boolean;
  schedule: string;
  everyHours: number;
  runs: number;
  /** The schedule's time of day, in minutes after midnight UTC. */
  atMin: number;
  /** Typical size of the provider's FLM list (facilities on a full sync). */
  listSize: number;
};

// No usernames or passwords: the sync job reads those from the Credentials Manager.
const SOURCES: Source[] = [
  { providerId: "flm-maccs", syncUrl: "https://flm.maccs.example/api/v1/facilities", enabled: true, schedule: "Daily at 02:00 UTC", everyHours: 24, runs: 14, atMin: 120, listSize: 640 },
  { providerId: "flm-dcip", syncUrl: "https://flm.dcip.example/flmx/v1/facility-list.xml", enabled: true, schedule: "Daily at 04:30 UTC", everyHours: 24, runs: 14, atMin: 270, listSize: 1180 },
  { providerId: "flm-qube-radar", syncUrl: "https://radar.qube.example/api/v2/flm/facility-list?format=flmx&region=all&include=screens,devices", enabled: true, schedule: "Every 12 hours (00:15, 12:15 UTC)", everyHours: 12, runs: 20, atMin: 15, listSize: 2310 },
  { providerId: "flm-cinergy", syncUrl: "https://flm.cinergy.example/api/v1/facilities", enabled: true, schedule: "Daily at 06:00 UTC", everyHours: 24, runs: 14, atMin: 360, listSize: 870 },
  { providerId: "flm-sony", syncUrl: "https://flm.sony.example/api/v1/facilities", enabled: false, schedule: "Daily at 03:00 UTC", everyHours: 24, runs: 0, atMin: 180, listSize: 0 },
  { providerId: "flm-kdmx", syncUrl: "https://flm.kdmx.example/v1/flm/sitelist", enabled: true, schedule: "Daily at 01:00 UTC", everyHours: 24, runs: 12, atMin: 60, listSize: 410 },
];

/** Latest run's status where the page should show a state other than Success. */
const LATEST: Record<string, "Failed" | "Partial"> = { "flm-dcip": "Failed", "flm-kdmx": "Partial" };

const host = (url: string) => new URL(url).host;
const facilities = (n: number) => (n === 1 ? "1 facility" : `${n} facilities`);

const FAILURES = [
  () => "HTTP 401 Unauthorized fetching the FLM list; check the provider's credentials in Credentials Manager",
  (s: Source) => `Timed out after 120 s waiting for ${host(s.syncUrl)}`,
  () => "Could not parse the FLM list XML: unexpected end of document at line 1893",
  (s: Source) => `HTTP 503 Service Unavailable from ${host(s.syncUrl)}`,
  (s: Source) => `getaddrinfo ENOTFOUND ${host(s.syncUrl)}`,
];

const PARTIALS = [
  (errors: number, received: number) => `${errors} of ${received} facility records failed: facility XML returned HTTP 404`,
  (errors: number, received: number) => `${errors} of ${received} facility records failed validation (missing facility UUID)`,
  (errors: number, received: number) => `${errors} of ${received} facility records skipped: screen count mismatch with the FLM list`,
];

type Run = {
  provider_id: string; started_at: string; finished_at: string; status: string; theatres_received: number;
  theatres_updated: number; theatres_new: number; errors: number; message: string; triggered_by: string;
};

/** A provider's run history: mostly successful scheduled runs, a weekly full sync, a few partial or failed ones. */
function runsFor(s: Source, seed: number, now: number): Run[] {
  const rand = prng(seed);
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const runs: Run[] = [];
  // The most recent scheduled time at or before now.
  const every = s.everyHours * 3_600_000;
  const anchor = new Date(now).setUTCHours(0, s.atMin, 0, 0);
  const last = anchor + every * Math.floor((now - anchor) / every);
  for (let i = 0; i < s.runs; i++) {
    const started = new Date(last - i * every + Math.floor(rand() * 50) * 1000);
    const r = rand();
    const status = i === 0 ? LATEST[s.providerId] ?? "Success" : r < 0.07 ? "Failed" : r < 0.18 ? "Partial" : "Success";
    const fullSync = started.getUTCDay() === 0 && (s.everyHours >= 24 || started.getUTCHours() < 12);
    let received = 0, updated = 0, created = 0, errors = 0, message: string, seconds: number;
    if (status === "Failed") {
      const fail = pick(FAILURES);
      message = fail(s);
      errors = 1;
      seconds = message.startsWith("Timed out") ? 120 : 2 + Math.floor(rand() * 6);
    } else {
      received = fullSync ? s.listSize + Math.floor(rand() * 12) : Math.floor(rand() * rand() * 60);
      created = received ? Math.floor(rand() * (fullSync ? 6 : 3)) : 0;
      if (status === "Partial") {
        received = Math.max(received, 12);
        errors = 1 + Math.floor(rand() * 5);
        message = pick(PARTIALS)(errors, received);
      } else if (fullSync) {
        message = `Full sync: processed all ${received} facilities in the FLM list`;
      } else {
        message = received ? `Processed ${facilities(received)} modified in the last 2 days` : "FLM list unchanged since the last sync; nothing to process";
      }
      updated = Math.max(received - created - errors - (received ? Math.floor(rand() * received * 0.3) : 0), 0);
      seconds = 6 + Math.round(received * (0.8 + rand())) + Math.floor(rand() * 15);
    }
    runs.push({
      provider_id: s.providerId,
      started_at: started.toISOString(),
      finished_at: new Date(started.getTime() + seconds * 1000).toISOString(),
      status, theatres_received: received, theatres_updated: updated, theatres_new: created, errors, message,
      triggered_by: "Scheduler",
    });
    // A user re-ran a failed sync an hour later.
    if (status === "Failed" && i > 0) {
      const retry = new Date(started.getTime() + 62 * 60_000);
      const n = Math.floor(rand() * 40);
      runs.push({
        provider_id: s.providerId, started_at: retry.toISOString(),
        finished_at: new Date(retry.getTime() + (8 + n * 2) * 1000).toISOString(),
        status: "Success", theatres_received: n, theatres_updated: Math.max(n - 1, 0), theatres_new: n ? 1 : 0, errors: 0,
        message: n ? `Processed ${facilities(n)} modified in the last 2 days` : "FLM list unchanged since the last sync; nothing to process",
        triggered_by: "Harshit Thakkar",
      });
    }
  }
  return runs;
}

/**
 * FLM sync sources (one per provider; Sony disabled and never synced) and about two weeks of sync runs, relative to
 * now. Deterministic apart from the anchor time. Migration 024 backfills the same sources with a smaller sample.
 */
export const flmSyncSeeder: ExtraSeeder = {
  name: "flmSync",
  tables: ["flm_sync_runs", "flm_sync_sources"],
  async run(client) {
    const { rows: providers } = await client.query<{ id: string }>("SELECT id FROM flm_providers");
    const known = new Set(providers.map((p) => p.id));
    const sources = SOURCES.filter((s) => known.has(s.providerId));
    const now = Math.floor(Date.now() / 60_000) * 60_000;
    const runs = sources.flatMap((s, i) => runsFor(s, 7001 + i, now));

    await client.query(
      `INSERT INTO flm_sync_sources (provider_id, sync_url, enabled, schedule, last_status, last_synced_at, last_message, updated_by)
       SELECT v.provider_id, v.sync_url, v.enabled, v.schedule, 'Never', NULL, NULL, 'System'
       FROM json_to_recordset($1) AS v(provider_id text, sync_url text, enabled boolean, schedule text)
       ON CONFLICT (provider_id) DO UPDATE SET sync_url = excluded.sync_url, enabled = excluded.enabled,
         schedule = excluded.schedule, last_status = 'Never', last_synced_at = NULL, last_message = NULL,
         updated_by = excluded.updated_by, updated_at = now()`,
      [JSON.stringify(sources.map((s) => ({ provider_id: s.providerId, sync_url: s.syncUrl, enabled: s.enabled, schedule: s.schedule })))],
    );
    await client.query("DELETE FROM flm_sync_runs WHERE provider_id = ANY($1)", [sources.map((s) => s.providerId)]);
    await client.query(
      `INSERT INTO flm_sync_runs (provider_id, started_at, finished_at, status, theatres_received, theatres_updated,
                                  theatres_new, errors, message, triggered_by)
       SELECT * FROM json_to_recordset($1) AS v(provider_id text, started_at timestamptz, finished_at timestamptz,
         status text, theatres_received int, theatres_updated int, theatres_new int, errors int, message text, triggered_by text)
       ORDER BY started_at`,
      [JSON.stringify(runs)],
    );
    await client.query(
      `UPDATE flm_sync_sources s
       SET last_synced_at = coalesce(r.finished_at, r.started_at), last_status = r.status, last_message = r.message
       FROM (SELECT DISTINCT ON (provider_id) * FROM flm_sync_runs ORDER BY provider_id, started_at DESC) r
       WHERE r.provider_id = s.provider_id`,
    );
  },
};
