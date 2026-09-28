import { Hono } from "hono";
import { subDays, subMonths, startOfYear, format } from "date-fns";
import { query, transaction } from "../db";
import { CURRENT_USER, httpError, notFound } from "../http";
import type { EnvironmentScreenRecord } from "../../src/data/environmentManagerData";
import type { ProjectionScreenRecord } from "../../src/data/projectionManagerData";
import type { ScreenRecord } from "../../src/data/screenManagerData";
import {
  generateScreenTimeSeries,
  TIME_RANGES,
  type ScreenTimeSeries,
  type TimeRange,
  type TimeSeriesPoint,
} from "../../src/data/environmentTimeSeriesData";
import type {
  PulseDashboardData,
  PulseMonitoredTheatre,
  ScoreHistogramBin,
  ScreenInstallUpdate,
  ScreenTimeSeriesResponse,
} from "../../src/types/screenPulse";

export const screenPulse = new Hono();

const LOCATION = `coalesce(t.city, '') AS city, coalesce(t.state, '') AS state, coalesce(t.country, '') AS country`;

/** Latest quality check per screen. */
const LATEST_QUALITY = `
  SELECT DISTINCT ON (screen_id) * FROM screen_quality_checks ORDER BY screen_id, checked_at DESC, id DESC`;

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Ten bins "1-10" … "91-100"; out-of-range scores fall into the end bins. */
async function histogram(scoresSql: string): Promise<ScoreHistogramBin[]> {
  const rows = await query<{ bucket: number; count: number }>(
    `SELECT least(greatest(ceil(score / 10.0), 1), 10)::int AS bucket, count(*) AS count
     FROM (${scoresSql}) scores GROUP BY 1`,
  );
  const counts = new Map(rows.map((r) => [r.bucket, r.count]));
  return Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10 + 1}-${(i + 1) * 10}`, count: counts.get(i + 1) ?? 0 }));
}

screenPulse.get("/dashboard", async (c) => {
  const [theatres, environmentHistogram, projectionHistogram] = await Promise.all([
    query<PulseMonitoredTheatre>(`
      SELECT t.id, t.name, coalesce(t.city, '') AS city, coalesce(t.country, '') AS country,
             count(s.id) AS screens,
             count(e.screen_id) AS environment,
             count(q.screen_id) AS projection
      FROM theatre_appliance_configs cfg
      JOIN theatres t ON t.id = cfg.theatre_id
      JOIN screens s  ON s.theatre_id = t.id AND s.status <> 'Deleted'
      LEFT JOIN screen_environment_summaries e ON e.screen_id = s.id
      LEFT JOIN (SELECT DISTINCT screen_id FROM screen_quality_checks) q ON q.screen_id = s.id
      WHERE cfg.appliance_type = 'pulse'
      GROUP BY t.id
      ORDER BY t.name`),
    histogram("SELECT score FROM screen_environment_summaries"),
    histogram(`SELECT score FROM (${LATEST_QUALITY}) q WHERE score IS NOT NULL`),
  ]);
  return c.json<PulseDashboardData>({ theatres, environmentHistogram, projectionHistogram });
});

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const metric = (col: string, unit: string) =>
  `json_build_object('value', e.${col}, 'unit', '${unit}', 'status', e.${col}_status)`;

screenPulse.get("/environment", async (c) =>
  c.json(await query<EnvironmentScreenRecord>(`
    SELECT s.id, s.name AS "screenName", t.id AS "theatreId", t.name AS "theatreName", coalesce(ch.name, '') AS "chainName", ${LOCATION},
           e.score,
           ${metric("on_temperature", "°C")} AS "onTemperature",
           ${metric("on_humidity", "%")} AS "onHumidity",
           ${metric("on_dust", "µg/m³")} AS "onDust",
           ${metric("off_temperature", "°C")} AS "offTemperature",
           ${metric("off_humidity", "%")} AS "offHumidity",
           ${metric("off_dust", "µg/m³")} AS "offDust"
    FROM screen_environment_summaries e
    JOIN screens s   ON s.id = e.screen_id
    JOIN theatres t  ON t.id = s.theatre_id
    LEFT JOIN chains ch ON ch.id = t.chain_id
    WHERE s.status <> 'Deleted'
    ORDER BY e.score DESC, t.name, s.id`)),
);

function rangeStart(range: TimeRange, now = new Date()) {
  switch (range) {
    case "1D": return subDays(now, 1);
    case "5D": return subDays(now, 5);
    case "1M": return subMonths(now, 1);
    case "3M": return subMonths(now, 3);
    case "6M": return subMonths(now, 6);
    case "YTD": return startOfYear(now);
    case "Max": return subMonths(now, 12);
  }
}

const METRICS = ["temperature", "humidity", "dust"] as const;
type Metric = (typeof METRICS)[number];

screenPulse.get("/environment/:screenId/series", async (c) => {
  const screenId = c.req.param("screenId");
  const range = (c.req.query("range") ?? "5D") as TimeRange;
  if (!TIME_RANGES.includes(range)) throw httpError(400, `range must be one of ${TIME_RANGES.join(", ")}`);

  const [screen] = await query("SELECT id FROM screens WHERE id = $1", [screenId]);
  if (!screen) throw notFound("Screen");

  const [readings, thresholdRows] = await Promise.all([
    query<{ metric: Metric; recordedAt: string; value: number; isOnPeriod: boolean }>(
      `SELECT metric, recorded_at AS "recordedAt", value, is_on_period AS "isOnPeriod"
       FROM screen_sensor_readings WHERE screen_id = $1 AND recorded_at >= $2 ORDER BY recorded_at`,
      [screenId, rangeStart(range)],
    ),
    query<{ metric: Metric; onUpper: number; onLower: number; offUpper: number; offLower: number }>(
      `SELECT metric, on_upper AS "onUpper", on_lower AS "onLower", off_upper AS "offUpper", off_lower AS "offLower"
       FROM screen_sensor_thresholds WHERE screen_id = $1`,
      [screenId],
    ),
  ]);

  // No telemetry for this screen/range: fall back to the simulated series so
  // the chart still renders.
  if (readings.length === 0) {
    return c.json<ScreenTimeSeriesResponse>({ ...generateScreenTimeSeries(screenId, range), source: "simulated" });
  }

  const thresholds: ScreenTimeSeries["thresholds"] = { ...generateScreenTimeSeries(screenId, "1D").thresholds };
  for (const { metric, ...t } of thresholdRows) thresholds[metric] = t;

  const series = { temperature: [], humidity: [], dust: [] } as Record<Metric, TimeSeriesPoint[]>;
  for (const r of readings) {
    const t = thresholds[r.metric];
    const [lower, upper] = r.isOnPeriod ? [t.onLower, t.onUpper] : [t.offLower, t.offUpper];
    const timestamp = Date.parse(r.recordedAt);
    series[r.metric].push({
      timestamp,
      dateLabel: format(timestamp, range === "1D" ? "HH:mm" : "dd MMM HH:mm"),
      value: r.value,
      isBreach: r.value > upper || r.value < lower,
      isOnPeriod: r.isOnPeriod,
    });
  }
  return c.json<ScreenTimeSeriesResponse>({ ...series, thresholds, source: "readings" });
});

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

screenPulse.get("/projection", async (c) =>
  c.json(await query<ProjectionScreenRecord>(`
    SELECT s.id, s.name AS "screenName", t.id AS "theatreId", t.name AS "theatreName", coalesce(ch.name, '') AS "chainName", ${LOCATION},
           q.score,
           CASE WHEN q.score >= 71 THEN 'good' WHEN q.score >= 41 THEN 'average' ELSE 'poor' END AS "scoreCategory",
           json_build_object('value', coalesce(q.projection_quality, ''),
                             'status', CASE WHEN q.projection_ok THEN 'within_limits' ELSE 'outside_limits' END) AS "projectionQuality",
           json_build_object('value', coalesce(q.sound_quality, ''),
                             'status', CASE WHEN q.sound_ok THEN 'within_limits' ELSE 'outside_limits' END) AS "soundQuality"
    FROM (${LATEST_QUALITY}) q
    JOIN screens s   ON s.id = q.screen_id
    JOIN theatres t  ON t.id = s.theatre_id
    LEFT JOIN chains ch ON ch.id = t.chain_id
    WHERE s.status <> 'Deleted' AND q.score IS NOT NULL
    ORDER BY q.score DESC, t.name, s.id`)),
);

// ---------------------------------------------------------------------------
// Screens (Pulse / Lionis installs)
// ---------------------------------------------------------------------------

// Pulse devices are identified by appliance_id ("PULSE-1100"); Lionis by serial_number.
const SCREEN_SELECT = `
  SELECT s.id, t.id AS "theatreId", t.name AS "theatreName", coalesce(ch.name, '') AS "chainName", s.name AS "screenName", ${LOCATION},
         coalesce(p.status <> 'Inactive', false) AS "pulseInstalled",
         coalesce(l.status <> 'Inactive', false) AS "lionisInstalled",
         CASE WHEN p.status <> 'Inactive' THEN p.appliance_id END AS "pulseSerialNumber",
         CASE WHEN p.status <> 'Inactive' THEN p.installed_at END AS "pulseInstalledOn",
         CASE WHEN p.status <> 'Inactive' THEN p.installed_by END AS "pulseInstalledBy",
         CASE WHEN l.status <> 'Inactive' THEN l.serial_number END AS "lionisSerialNumber",
         CASE WHEN l.status <> 'Inactive' THEN l.installed_at END AS "lionisInstalledOn",
         CASE WHEN l.status <> 'Inactive' THEN l.installed_by END AS "lionisInstalledBy",
         coalesce(u.at, s.updated_at) AS "updatedOn",
         coalesce(u.by, s.updated_by, '') AS "updatedBy"
  FROM screens s
  JOIN theatres t ON t.id = s.theatre_id
  LEFT JOIN chains ch ON ch.id = t.chain_id
  LEFT JOIN screen_appliances p ON p.screen_id = s.id AND p.appliance_type = 'pulse'
  LEFT JOIN screen_appliances l ON l.screen_id = s.id AND l.appliance_type = 'lionis'
  LEFT JOIN LATERAL (
    SELECT v.at, v.by FROM (VALUES (p.updated_at, p.updated_by), (l.updated_at, l.updated_by)) v(at, by)
    WHERE v.at IS NOT NULL ORDER BY v.at DESC LIMIT 1
  ) u ON true
  WHERE s.status <> 'Deleted'`;

const SCREEN_SCOPE = `
  AND (p.id IS NOT NULL OR l.id IS NOT NULL OR EXISTS (
    SELECT 1 FROM theatre_appliance_configs cfg WHERE cfg.theatre_id = t.id AND cfg.appliance_type = 'pulse'))`;

/** ScreenRecord's install fields are optional, so drop nulls rather than send them. */
const omitNulls = <T extends object>(row: T) =>
  Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null)) as T;

screenPulse.get("/screens", async (c) => {
  const rows = await query<ScreenRecord>(
    `${SCREEN_SELECT} ${SCREEN_SCOPE} ORDER BY t.name, s.theatre_id, nullif(regexp_replace(s.number, '\\D', '', 'g'), '')::int NULLS LAST, s.id`,
  );
  return c.json(rows.map(omitNulls));
});

interface InstallInput {
  installed: boolean;
  serial: string | null;
  installedOn: string | null;
  installedBy: string | null;
}

function parseInstall(body: Record<string, unknown>, key: "pulse" | "lionis", label: string): InstallInput {
  const installed = body[`${key}Installed`];
  if (typeof installed !== "boolean") throw httpError(400, `${key}Installed must be true or false`);
  const text = (field: string) => {
    const v = body[`${key}${field}`];
    if (v === undefined || v === null) return null;
    if (typeof v !== "string") throw httpError(400, `${key}${field} must be a string`);
    return v.trim() || null;
  };
  const serial = text("SerialNumber");
  const installedOn = text("InstalledOn");
  const installedBy = text("InstalledBy");
  if (!installed) return { installed, serial: null, installedOn: null, installedBy: null };
  if (!serial) throw httpError(400, `${label} serial number is required when ${label} is installed`);
  if (installedOn && Number.isNaN(Date.parse(installedOn))) throw httpError(400, `${label} installed-on date is not a valid date`);
  if (installedOn && Date.parse(installedOn) > Date.now()) throw httpError(400, `${label} installed-on date cannot be in the future`);
  return { installed, serial, installedOn, installedBy };
}

screenPulse.patch("/screens/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => null)) as Partial<ScreenInstallUpdate> | null;
  if (!body || typeof body !== "object") throw httpError(400, "Request body must be a JSON object");
  const record = body as Record<string, unknown>;
  const installs = [
    { type: "pulse", column: "appliance_id", input: parseInstall(record, "pulse", "Pulse") },
    { type: "lionis", column: "serial_number", input: parseInstall(record, "lionis", "Lionis") },
  ] as const;

  await transaction(async (tx) => {
    const { rowCount } = await tx.query("SELECT 1 FROM screens WHERE id = $1 AND status <> 'Deleted'", [id]);
    if (!rowCount) throw notFound("Screen");
    for (const { type, column, input } of installs) {
      if (input.installed) {
        await tx.query(
          `INSERT INTO screen_appliances AS sa (screen_id, appliance_type, ${column}, installed_at, installed_by, status, updated_by)
           VALUES ($1, $2, $3, $4, $5, 'Active', $6)
           ON CONFLICT (screen_id, appliance_type) DO UPDATE SET
             ${column} = EXCLUDED.${column},
             installed_at = EXCLUDED.installed_at,
             installed_by = EXCLUDED.installed_by,
             status = CASE WHEN sa.status = 'Inactive' THEN 'Active'::appliance_status ELSE sa.status END,
             updated_by = EXCLUDED.updated_by
           WHERE (sa.${column}, sa.installed_at, sa.installed_by, sa.status = 'Inactive')
                 IS DISTINCT FROM (EXCLUDED.${column}, EXCLUDED.installed_at, EXCLUDED.installed_by, false)`,
          [id, type, input.serial, input.installedOn, input.installedBy, CURRENT_USER],
        );
      } else {
        await tx.query(
          `UPDATE screen_appliances SET status = 'Inactive', updated_by = $3
           WHERE screen_id = $1 AND appliance_type = $2 AND status <> 'Inactive'`,
          [id, type, CURRENT_USER],
        );
      }
    }
  });

  const [row] = await query<ScreenRecord>(`${SCREEN_SELECT} AND s.id = $1`, [id]);
  return c.json(omitNulls(row));
});
