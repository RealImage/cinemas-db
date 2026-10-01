import { Hono } from "hono";
import { query } from "../db";
import { CURRENT_USER, notFound } from "../http";
import { SYNC_RUN_COUNTS, syncRunLimit } from "../syncStatus";
import type { TDLDevice } from "../../src/types";
import type { TdlSyncRun, TdlSyncSource } from "../../src/data/tdlSync";

export const tdl = new Hono();

const TDL_SELECT = `
  SELECT id, manufacturer, model, serial_number AS "serialNumber",
         coalesce(software_version, '') AS "softwareVersion", coalesce(device_role, '') AS "deviceRole",
         certificate_auto_sync AS "certificateAutoSync", valid_till AS "validTill",
         coalesce(public_key_thumbprint, '') AS "publicKeyThumbprint",
         coalesce(issuer_thumbprint, '') AS "issuerThumbprint", coalesce(source, '') AS source, retired,
         coalesce(updated_by, '') AS "updatedBy", updated_at AS "updatedOn",
         certificate_status AS "certificateStatus", coalesce(firmware_version, '') AS "firmwareVersion",
         auto_update_certificate AS "autoUpdateCertificate"
  FROM tdl_devices`;

// ---------------------------------------------------------------------------
// Certificate sync status (read-only). Registered before GET /:id, which would otherwise match "sync-status".
// ---------------------------------------------------------------------------

/** Every manufacturer's certificate FTP site, last outcome and run counts for the last 24 hours and 7 days. */
export const tdlSyncSources = () =>
  query<TdlSyncSource>(`
    SELECT s.manufacturer, s.ftp_url AS "ftpUrl", s.root_dir AS "rootDir", s.enabled, s.schedule,
           s.last_synced_at AS "lastSyncedAt", s.last_status AS "lastStatus", s.last_message AS "lastMessage",
           s.updated_by AS "updatedBy", s.updated_at AS "updatedAt",
           ${SYNC_RUN_COUNTS}
    FROM tdl_sync_sources s
    LEFT JOIN tdl_sync_runs r ON r.manufacturer = s.manufacturer AND r.started_at > now() - interval '7 days'
    GROUP BY s.manufacturer
    ORDER BY lower(s.manufacturer)`);

export const tdlSyncRuns = (manufacturer: string | null, limit: number) =>
  query<TdlSyncRun>(
    `SELECT id::text AS id, manufacturer, started_at AS "startedAt", finished_at AS "finishedAt", status,
            files_found AS "filesFound", certificates_parsed AS "certificatesParsed", devices_added AS "devicesAdded",
            devices_updated AS "devicesUpdated", invalid_certificates AS "invalidCertificates", errors, message,
            triggered_by AS "triggeredBy"
     FROM tdl_sync_runs
     WHERE ($1::text IS NULL OR manufacturer = $1)
     ORDER BY started_at DESC, id DESC LIMIT $2`,
    [manufacturer, limit],
  );

tdl.get("/sync-status", async (c) => c.json(await tdlSyncSources()));

/** Runs of every manufacturer, newest first. ?limit= (default 500, at most 2000) */
tdl.get("/sync-status/runs", async (c) => c.json(await tdlSyncRuns(null, syncRunLimit(c.req.query("limit"), 500))));

/** One manufacturer's runs, newest first. ?limit= (default 100, at most 2000) */
tdl.get("/sync-status/:manufacturer/runs", async (c) => {
  const manufacturer = c.req.param("manufacturer");
  const [source] = await query("SELECT 1 FROM tdl_sync_sources WHERE manufacturer = $1", [manufacturer]);
  if (!source) throw notFound("TDL sync source");
  return c.json(await tdlSyncRuns(manufacturer, syncRunLimit(c.req.query("limit"), 100)));
});

/** The whole Trusted Device List (~10k rows; the page filters client-side). */
tdl.get("/", async (c) => c.json(await query<TDLDevice>(`${TDL_SELECT} ORDER BY manufacturer, model, serial_number`)));

tdl.get("/:id", async (c) => {
  const [row] = await query<TDLDevice>(`${TDL_SELECT} WHERE id = $1`, [c.req.param("id")]);
  if (!row) throw notFound("TDL device");
  return c.json(row);
});

/** Retire a device (Retire Device action). */
tdl.post("/:id/retire", async (c) => {
  const [row] = await query<{ id: string }>(
    "UPDATE tdl_devices SET retired = true, updated_by = $2 WHERE id = $1 RETURNING id",
    [c.req.param("id"), CURRENT_USER],
  );
  if (!row) throw notFound("TDL device");
  const [device] = await query<TDLDevice>(`${TDL_SELECT} WHERE id = $1`, [row.id]);
  return c.json(device);
});

/** Undo a retirement. */
tdl.post("/:id/unretire", async (c) => {
  const [row] = await query<{ id: string }>(
    "UPDATE tdl_devices SET retired = false, updated_by = $2 WHERE id = $1 RETURNING id",
    [c.req.param("id"), CURRENT_USER],
  );
  if (!row) throw notFound("TDL device");
  const [device] = await query<TDLDevice>(`${TDL_SELECT} WHERE id = $1`, [row.id]);
  return c.json(device);
});
