import { Hono } from "hono";
import type pg from "pg";
import { query, transaction } from "../db";
import { CURRENT_USER, httpError, notFound } from "../http";
import { IMAX_INTEGRATION_TYPES, SCREEN_STATUS_REASON_TYPES, type IPAddress, type Screen, type ScreenDevice, type StatusReason, type Suite, type TemporaryClosure } from "../../src/types";
import { normalizeScreenNumber, screenIdentityErrors } from "../../src/data/screenRules";

export const screens = new Hono();

// ---------------------------------------------------------------------------
// Shared SQL / write helpers (also used by routes/theatres.ts)
// ---------------------------------------------------------------------------

/** Screen as the UI's `Screen` type, for a row aliased `s`. */
export const SCREEN_JSON = `json_build_object(
  'id', s.id, 'theatreId', s.theatre_id, 'number', coalesce(s.number, ''), 'name', coalesce(s.name, ''),
  'uuid', coalesce(s.uuid, ''), 'thirdPartyId', s.third_party_id, 'operators', s.operators,
  'autoScreenUpdateLock', s.auto_screen_update_lock, 'flmManagementLock', s.flm_management_lock,
  'multiThumbprintKdmScreen', s.multi_thumbprint_kdm_screen, 'automation', s.automation,
  'imaxIntegrated', s.imax_integrated, 'imaxIntegrationType', s.imax_integration_type, 'status', s.status,
  'statusReasonId', s.status_reason_id, 'statusComments', s.status_comments,
  'statusReason', (SELECT r.reason FROM status_reasons r WHERE r.id = s.status_reason_id),
  'closureNotes', s.closure_notes, 'seatingCapacity', s.seating_capacity, 'coolingType', s.cooling_type,
  'wheelchairAccessibility', s.wheelchair_accessibility, 'motionSeats', s.motion_seats,
  'dimensions', s.dimensions, 'projection', s.projection,
  'sound', '{"soundMixes": []}'::jsonb || s.sound,
  'devices', coalesce((SELECT json_agg(json_build_object(
      'id', d.id, 'manufacturer', d.manufacturer, 'model', d.model, 'serialNumber', d.serial_number,
      'role', d.role, 'certificateStatus', d.certificate_status, 'certificateLockStatus', d.certificate_lock_status,
      'softwareVersion', coalesce(d.software_version, ''), 'certificateAutoSync', d.certificate_auto_sync,
      'ipAddress', host(d.ip_address), 'subnetMask', host(d.subnet_mask), 'gateway', host(d.gateway))
      ORDER BY d.manufacturer, d.model, d.serial_number)
    FROM screen_devices d WHERE d.screen_id = s.id), '[]'),
  'ipAddresses', coalesce((SELECT json_agg(json_build_object(
      'address', host(ip.address), 'subnet', coalesce(host(ip.subnet), ''), 'gateway', coalesce(host(ip.gateway), ''))
      ORDER BY ip.id)
    FROM screen_ip_addresses ip WHERE ip.screen_id = s.id), '[]'),
  'suites', coalesce((SELECT json_agg(json_build_object(
      'id', su.id, 'name', su.name, 'status', su.status, 'ipAddresses', '[]'::json,
      'effectiveFrom', su.effective_from, 'createdAt', su.created_at,
      'devices', coalesce((SELECT json_agg(sd.device_id) FROM suite_devices sd WHERE sd.suite_id = su.id), '[]'))
      ORDER BY su.name)
    FROM suites su WHERE su.screen_id = s.id), '[]'),
  'temporaryClosures', coalesce((SELECT json_agg(json_build_object(
      'id', tc.id, 'startDate', tc.start_date, 'endDate', tc.end_date, 'reason', tc.reason,
      'notes', tc.notes, 'active', tc.active) ORDER BY tc.start_date DESC)
    FROM screen_temporary_closures tc WHERE tc.screen_id = s.id), '[]'),
  'createdAt', s.created_at, 'updatedAt', s.updated_at, 'createdBy', s.created_by, 'updatedBy', s.updated_by)`;

/** Natural screen order: numeric screen number, then name. */
export const SCREEN_ORDER = `nullif(regexp_replace(coalesce(s.number, ''), '\\D', '', 'g'), '')::numeric NULLS LAST, s.name`;

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/;
const CERT_STATUSES = ["Valid", "Invalid", "Expired", "Unknown"];

/** Optional IPv4 → value for an inet column (null when blank); 400 when malformed. */
const inet = (value: unknown, label: string) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !IPV4.test(value.trim())) throw httpError(400, `${label} "${value}" is not a valid IPv4 address`);
  return value.trim();
};

const nonEmpty = (value: unknown, label: string) => {
  if (typeof value !== "string" || !value.trim()) throw httpError(400, `${label} is required`);
  return value.trim();
};

export type DeviceInput = ScreenDevice & {
  certificateAutoSync?: boolean;
  ipAddress?: string;
  subnetMask?: string;
  gateway?: string;
};
export type SuiteInput = Suite & { effectiveFrom?: string | null };
export type DeviceConfig = { devices?: DeviceInput[]; ipAddresses?: IPAddress[]; suites?: SuiteInput[] };

/**
 * Replace a screen's devices / IP addresses / suites with the given lists
 * (only the lists present). Devices are upserted by id so suite links and
 * anything else referencing a kept device survive.
 */
export async function saveDeviceConfig(client: pg.PoolClient, screenId: string, config: DeviceConfig) {
  if (config.devices) {
    if (!Array.isArray(config.devices)) throw httpError(400, "devices must be an array");
    const ids: string[] = [];
    for (const d of config.devices) {
      const model = nonEmpty(d.model, "Device model");
      const serial = nonEmpty(d.serialNumber, "Device serial number");
      const status = d.certificateStatus ?? "Unknown";
      if (!CERT_STATUSES.includes(status)) throw httpError(400, `Invalid certificate status "${status}"`);
      const lock = d.certificateLockStatus === "Locked" ? "Locked" : "Unlocked";
      const { rows } = await client.query<{ id: string; screen_id: string }>(
        `INSERT INTO screen_devices (id, screen_id, manufacturer, model, serial_number, role, certificate_status,
                                     certificate_lock_status, software_version, certificate_auto_sync,
                                     ip_address, subnet_mask, gateway)
         VALUES (coalesce($1, gen_random_uuid()::text), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET manufacturer = EXCLUDED.manufacturer, model = EXCLUDED.model,
           serial_number = EXCLUDED.serial_number, role = EXCLUDED.role,
           certificate_status = EXCLUDED.certificate_status, certificate_lock_status = EXCLUDED.certificate_lock_status,
           software_version = EXCLUDED.software_version, certificate_auto_sync = EXCLUDED.certificate_auto_sync,
           ip_address = EXCLUDED.ip_address, subnet_mask = EXCLUDED.subnet_mask, gateway = EXCLUDED.gateway
         WHERE screen_devices.screen_id = EXCLUDED.screen_id
         RETURNING id, screen_id`,
        [d.id || null, screenId, (d.manufacturer ?? "").trim(), model, serial, d.role || null, status, lock,
          d.softwareVersion ?? null, !!d.certificateAutoSync,
          inet(d.ipAddress, "Device IP address"), inet(d.subnetMask, "Device subnet mask"), inet(d.gateway, "Device gateway")],
      );
      if (rows.length === 0) throw httpError(409, `Device ${d.id} belongs to another screen`);
      ids.push(rows[0].id);
    }
    await client.query("DELETE FROM screen_devices WHERE screen_id = $1 AND NOT (id = ANY($2))", [screenId, ids]);
  }

  if (config.ipAddresses) {
    if (!Array.isArray(config.ipAddresses)) throw httpError(400, "ipAddresses must be an array");
    await client.query("DELETE FROM screen_ip_addresses WHERE screen_id = $1", [screenId]);
    for (const ip of config.ipAddresses) {
      await client.query(
        "INSERT INTO screen_ip_addresses (screen_id, address, subnet, gateway) VALUES ($1, $2, $3, $4)",
        [screenId, inet(nonEmpty(ip.address, "IP address"), "IP address"), inet(ip.subnet, "Subnet mask"), inet(ip.gateway, "Gateway")],
      );
    }
  }

  if (config.suites) {
    if (!Array.isArray(config.suites)) throw httpError(400, "suites must be an array");
    const { rows: deviceRows } = await client.query<{ id: string }>("SELECT id FROM screen_devices WHERE screen_id = $1", [screenId]);
    const deviceIds = new Set(deviceRows.map((r) => r.id));
    const { rows: oldSuites } = await client.query<{ id: string; created_at: string }>(
      "SELECT id, created_at FROM suites WHERE screen_id = $1", [screenId],
    );
    const createdAt = new Map(oldSuites.map((s) => [s.id, s.created_at]));
    await client.query("DELETE FROM suites WHERE screen_id = $1", [screenId]);
    for (const su of config.suites) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO suites (id, screen_id, name, status, effective_from, created_at)
         VALUES (coalesce($1, gen_random_uuid()::text), $2, $3, $4, $5, coalesce($6, now())) RETURNING id`,
        [su.id || null, screenId, nonEmpty(su.name, "Suite name"), su.status === "Invalid" ? "Invalid" : "Valid",
          su.effectiveFrom || null, createdAt.get(su.id) ?? null],
      );
      for (const deviceId of new Set(su.devices ?? [])) {
        if (!deviceIds.has(deviceId)) continue; // device was removed from the screen
        await client.query("INSERT INTO suite_devices (suite_id, device_id) VALUES ($1, $2)", [rows[0].id, deviceId]);
      }
    }
  }
}

const SCREEN_STATUSES = ["Active", "Inactive", "Deleted"];

/** Insert or update one screen of `theatreId` (incl. its device config and closures). */
export async function saveScreen(client: pg.PoolClient, theatreId: string, s: Partial<Screen> & DeviceConfig) {
  const status = s.status ?? "Active";
  if (!SCREEN_STATUSES.includes(status)) throw httpError(400, `Invalid screen status "${status}"`);
  // Uniqueness within the theatre is checked on the whole list (theatres.ts) and by the database at commit
  const errors = screenIdentityErrors({ number: s.number ?? "", name: s.name ?? "", status }, []);
  if (errors.number || errors.name) throw httpError(400, (errors.number ?? errors.name)!);
  const number = normalizeScreenNumber(s.number) || null;
  const name = typeof s.name === "string" && s.name.trim() ? s.name.trim() : null;
  // Inactive and Deleted need a reason of the matching type; an Active screen keeps none
  const reasonType = status === "Active" ? null : SCREEN_STATUS_REASON_TYPES[status as "Inactive" | "Deleted"];
  const reasonId = reasonType ? s.statusReasonId || null : null;
  if (reasonType) {
    const verb = status === "Inactive" ? "deactivating" : "deleting";
    if (!reasonId) throw httpError(400, `Choose a reason for ${verb} the screen`);
    const { rows: [reason] } = await client.query<{ reason_type: string }>(
      "SELECT reason_type FROM status_reasons WHERE id = $1", [reasonId]);
    if (!reason || reason.reason_type !== reasonType) throw httpError(400, `That isn't a reason for ${verb} a screen`);
  }
  const comments = reasonType && typeof s.statusComments === "string" && s.statusComments.trim() ? s.statusComments.trim() : null;
  const imaxIntegrated = !!s.imaxIntegrated;
  const imaxType = imaxIntegrated ? s.imaxIntegrationType ?? null : null;
  if (imaxIntegrated && !IMAX_INTEGRATION_TYPES.includes(imaxType as never)) {
    throw httpError(400, `IMAX integration type must be one of ${IMAX_INTEGRATION_TYPES.join(", ")}`);
  }
  const seating = s.seatingCapacity === undefined || s.seatingCapacity === null || (s.seatingCapacity as unknown) === ""
    ? null : Number(s.seatingCapacity);
  if (seating !== null && (!Number.isInteger(seating) || seating < 0)) throw httpError(400, "Seating capacity must be a whole number");
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO screens (id, theatre_id, number, name, uuid, third_party_id, status, auto_screen_update_lock,
                          flm_management_lock, multi_thumbprint_kdm_screen, seating_capacity, cooling_type,
                          wheelchair_accessibility, motion_seats, closure_notes, operators, dimensions, projection,
                          sound, automation, imax_integrated, imax_integration_type, status_reason_id, status_comments,
                          created_by, updated_by)
     VALUES (coalesce($1, gen_random_uuid()::text), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
             $16, $17, $18, $19, $21, $22, $23, $24, $25, $20, $20)
     ON CONFLICT (id) DO UPDATE SET number = EXCLUDED.number, name = EXCLUDED.name, uuid = EXCLUDED.uuid,
       third_party_id = EXCLUDED.third_party_id, status = EXCLUDED.status,
       auto_screen_update_lock = EXCLUDED.auto_screen_update_lock, flm_management_lock = EXCLUDED.flm_management_lock,
       multi_thumbprint_kdm_screen = EXCLUDED.multi_thumbprint_kdm_screen, seating_capacity = EXCLUDED.seating_capacity,
       cooling_type = EXCLUDED.cooling_type, wheelchair_accessibility = EXCLUDED.wheelchair_accessibility,
       motion_seats = EXCLUDED.motion_seats, closure_notes = EXCLUDED.closure_notes, operators = EXCLUDED.operators,
       dimensions = EXCLUDED.dimensions, projection = EXCLUDED.projection, sound = EXCLUDED.sound,
       automation = EXCLUDED.automation, imax_integrated = EXCLUDED.imax_integrated,
       imax_integration_type = EXCLUDED.imax_integration_type, status_reason_id = EXCLUDED.status_reason_id,
       status_comments = EXCLUDED.status_comments, updated_by = EXCLUDED.updated_by
     WHERE screens.theatre_id = EXCLUDED.theatre_id
     RETURNING id`,
    [s.id || null, theatreId, number, name, s.uuid || null, s.thirdPartyId || null, status,
      !!s.autoScreenUpdateLock, !!s.flmManagementLock, !!s.multiThumbprintKdmScreen, seating, s.coolingType || null,
      !!s.wheelchairAccessibility, !!s.motionSeats, s.closureNotes || null,
      JSON.stringify((s.operators ?? []).filter((o) => o && (o.name || o.email || o.phone))),
      JSON.stringify(s.dimensions ?? {}), JSON.stringify(s.projection ?? {}), JSON.stringify(s.sound ?? {}), CURRENT_USER,
      !!s.automation, imaxIntegrated, imaxType, reasonId, comments],
  );
  if (rows.length === 0) throw httpError(409, `Screen ${s.id} belongs to another theatre`);
  const screenId = rows[0].id;
  await saveDeviceConfig(client, screenId, s);

  if (Array.isArray(s.temporaryClosures)) {
    await client.query("DELETE FROM screen_temporary_closures WHERE screen_id = $1", [screenId]);
    for (const tc of s.temporaryClosures as TemporaryClosure[]) {
      if (!tc.startDate) throw httpError(400, "Temporary closure start date is required");
      await client.query(
        `INSERT INTO screen_temporary_closures (id, screen_id, start_date, end_date, reason, notes, active)
         VALUES (coalesce($1, gen_random_uuid()::text), $2, $3, $4, $5, $6, $7)`,
        [tc.id || null, screenId, tc.startDate, tc.endDate || null, nonEmpty(tc.reason, "Temporary closure reason"),
          tc.notes || null, tc.active !== false],
      );
    }
  }
  return screenId;
}

export async function loadScreen(id: string) {
  const [row] = await query<{ screen: Screen }>(`SELECT ${SCREEN_JSON} AS screen FROM screens s WHERE s.id = $1`, [id]);
  return row?.screen;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Reasons for deactivating and deleting a screen, in display order. */
screens.get("/status-reasons", async (c) => c.json(await query<StatusReason>(
  `SELECT id, reason_type AS "reasonType", reason FROM status_reasons ORDER BY reason_type, sort_order, reason`)));

screens.get("/:id", async (c) => {
  const screen = await loadScreen(c.req.param("id"));
  if (!screen) throw notFound("Screen");
  return c.json(screen);
});

/**
 * Save the Screen Device List page: devices, IP addresses and suites of
 * several screens in one transaction.
 * Body: { screens: [{ id, devices?, ipAddresses?, suites? }] }
 */
screens.put("/device-config", async (c) => {
  const { screens: items } = await c.req.json<{ screens?: (DeviceConfig & { id: string })[] }>();
  if (!Array.isArray(items)) throw httpError(400, "screens must be an array");
  await transaction(async (client) => {
    const touched = new Set<string>();
    for (const item of items) {
      const { rows } = await client.query<{ theatre_id: string }>("SELECT theatre_id FROM screens WHERE id = $1", [item.id]);
      if (rows.length === 0) throw notFound(`Screen ${item.id}`);
      await saveDeviceConfig(client, item.id, item);
      await client.query("UPDATE screens SET updated_by = $2 WHERE id = $1", [item.id, CURRENT_USER]);
      touched.add(rows[0].theatre_id);
    }
    for (const theatreId of touched) {
      await client.query("UPDATE theatres SET updated_by = $2 WHERE id = $1", [theatreId, CURRENT_USER]);
      await client.query(
        `INSERT INTO theatre_logs (theatre_id, section, action, updated_by, new_value)
         VALUES ($1, 'IP & Suites', 'Updated', $2, 'Screen device list updated')`,
        [theatreId, CURRENT_USER],
      );
    }
  });
  const ids = items.map((i) => i.id);
  const rows = await query<{ screen: Screen }>(`SELECT ${SCREEN_JSON} AS screen FROM screens s WHERE s.id = ANY($1)`, [ids]);
  return c.json(rows.map((r) => r.screen));
});
