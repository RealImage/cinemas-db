import { Hono } from "hono";
import type pg from "pg";
import { query, transaction } from "../db";
import { CURRENT_USER, httpError, notFound } from "../http";
import { assertNotDeleted } from "../theatreDeletion";
import type { WireTAPDevice, WireTAPDeviceDetail, WireTAPTheatreOption } from "../../src/types/wireTAP";

export const wiretap = new Hono();

// theatreId is theatres.id: WireTAP theatres were resolved by UUID and have no
// business code, and the id is what the mapping form sends back.
const DEVICE_COLUMNS = `
  d.id, d.hardware_serial_number AS "hardwareSerialNumber",
  coalesce(d.application_serial_number, '') AS "applicationSerialNumber",
  coalesce(d.host_name, '') AS "hostName", d.cluster_name AS "clusterName",
  coalesce(d.connectivity_type, '') AS "connectivityType", coalesce(d.isp_name, '') AS "ispName",
  coalesce(t.id, '') AS "theatreId", coalesce(t.name, '') AS "theatreName",
  coalesce(t.uuid, '') AS "theatreUUID", coalesce(t.address, '') AS "theatreAddress",
  coalesce(t.alternate_names, '{}') AS "theatreAlternateNames",
  coalesce(d.storage_capacity, '') AS "storageCapacity", coalesce(d.bandwidth, '') AS "bandwidth",
  d.activation_status AS "activationStatus", d.mapping_status AS "mappingStatus",
  d.vpn_status AS "vpnStatus", d.appliance_type AS "wireTapApplianceType",
  d.pull_out_status AS "pullOutStatus", coalesce(d.updated_by, '') AS "updatedBy",
  d.updated_at AS "updatedAt", d.connectivity`;

const FROM = `FROM wiretap_devices d LEFT JOIN theatres t ON t.id = d.theatre_id`;

const stripNullConnectivity = <T extends { connectivity?: unknown }>(rows: T[]) =>
  rows.map((r) => (r.connectivity == null ? { ...r, connectivity: undefined } : r));

/** Devices in the inventory portal. */
wiretap.get("/", async (c) =>
  c.json(stripNullConnectivity(await query<WireTAPDevice>(
    `SELECT ${DEVICE_COLUMNS} ${FROM} WHERE d.in_inventory ORDER BY d.id`,
  ))),
);

/** Devices registered by the fleet but not yet in the inventory ("Fetch new devices"). */
wiretap.get("/new", async (c) =>
  c.json(stripNullConnectivity(await query<WireTAPDevice>(
    `SELECT ${DEVICE_COLUMNS} ${FROM} WHERE NOT d.in_inventory ORDER BY d.id`,
  ))),
);

/** Pull new devices into the inventory. Body: { ids: string[] } */
wiretap.post("/inventory", async (c) => {
  const { ids } = await c.req.json<{ ids?: unknown }>();
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((i) => typeof i === "string")) {
    throw httpError(400, "ids must be a non-empty array of device ids");
  }
  const unique = Array.from(new Set(ids as string[]));
  // Lock and validate every id before updating, so a bad id rolls back the whole request
  const added = await transaction(async (client) => {
    const { rows: found } = await client.query<{ id: string }>(
      "SELECT id FROM wiretap_devices WHERE id = ANY($1) AND NOT in_inventory FOR UPDATE",
      [unique],
    );
    if (found.length !== unique.length) {
      const ok = new Set(found.map((r) => r.id));
      throw notFound(`New device ${unique.filter((i) => !ok.has(i)).join(", ")}`);
    }
    await client.query(
      "UPDATE wiretap_devices SET in_inventory = true, updated_by = $2 WHERE id = ANY($1)",
      [unique, CURRENT_USER],
    );
    return found.length;
  });
  return c.json({ added });
});

/** Theatres a device can be mapped to. */
wiretap.get("/theatres", async (c) =>
  c.json(await query<WireTAPTheatreOption>(
    `SELECT id, name, code FROM theatres WHERE status <> 'Deleted' ORDER BY name, id`,
  )),
);

wiretap.get("/:id", async (c) => {
  const [row] = await query<WireTAPDeviceDetail>(
    `SELECT ${DEVICE_COLUMNS}, d.no_mapping_reason AS "noMappingReason",
            to_char(d.pull_out_date, 'YYYY-MM-DD') AS "pullOutDate", d.pull_out_reason AS "pullOutReason",
            d.deactivation_reason AS "deactivationReason", d.details
     ${FROM} WHERE d.id = $1`,
    [c.req.param("id")],
  );
  if (!row) throw notFound("WireTAP device");
  return c.json(stripNullConnectivity([row])[0]);
});

// ---------------------------------------------------------------------------
// Add / edit form
// ---------------------------------------------------------------------------

/** The add/edit page's form state (src/pages/AddWireTAPDevice.tsx). */
type DeviceForm = {
  hardwareSerialNumber?: string;
  applicationSerialNumber?: string;
  hostName?: string;
  clusterName?: string;
  mappingStatus?: "Yes" | "No";
  theatreId?: string;
  noMappingReason?: string;
  pullOutStatus?: boolean;
  pullOutDate?: string | null;
  pullOutReason?: string;
  storage?: string;
  theatreBandwidth?: string;
  theatreBandwidthUnit?: string;
  connectivityType?: string;
  ispCompany?: string;
  [key: string]: unknown;
};

// Form keys persisted in their own columns (or derived); everything else goes to `details`.
const COLUMN_KEYS = new Set([
  "hardwareSerialNumber", "applicationSerialNumber", "applianceSerialNumber", "hostName", "clusterName",
  "mappingStatus", "theatreId", "theatreName", "noMappingReason", "pullOutStatus", "pullOutDate",
  "pullOutReason", "storage", "theatreBandwidth", "connectivityType", "ispCompany",
]);

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

async function validateForm(form: DeviceForm, client: pg.PoolClient) {
  const hardwareSerialNumber = str(form.hardwareSerialNumber);
  const applicationSerialNumber = str(form.applicationSerialNumber);
  if (!hardwareSerialNumber) throw httpError(400, "Hardware Serial Number is required");
  if (!applicationSerialNumber) throw httpError(400, "Application Serial Number is required");
  if (form.mappingStatus !== "Yes" && form.mappingStatus !== "No") {
    throw httpError(400, "mappingStatus must be \"Yes\" or \"No\"");
  }
  const mapped = form.mappingStatus === "Yes";
  let theatreId: string | null = null;
  if (mapped) {
    theatreId = str(form.theatreId);
    if (!theatreId) throw httpError(400, "Theatre selection is required when mapping status is Yes");
    const { rows: [t] } = await client.query<{ status: string }>(
      "SELECT status FROM theatres WHERE id = $1 FOR UPDATE", [theatreId],
    );
    if (!t) throw notFound("Theatre");
    assertNotDeleted(t);
  } else if (!str(form.noMappingReason)) {
    throw httpError(400, "Reason for no mapping is required");
  }
  const pulledOut = form.pullOutStatus === true;
  const pullOutDate = pulledOut ? str(form.pullOutDate) : null;
  if (pulledOut && !pullOutDate) throw httpError(400, "Pull out date is required when pull out status is enabled");
  if (pullOutDate && !/^\d{4}-\d{2}-\d{2}$/.test(pullOutDate)) throw httpError(400, "pullOutDate must be YYYY-MM-DD");

  const details: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(form)) if (!COLUMN_KEYS.has(k)) details[k] = v;

  return {
    hardwareSerialNumber, applicationSerialNumber, mapped, theatreId, pulledOut, pullOutDate,
    hostName: str(form.hostName),
    clusterName: str(form.clusterName),
    noMappingReason: mapped ? null : str(form.noMappingReason),
    pullOutReason: pulledOut ? str(form.pullOutReason) : null,
    storage: str(form.storage),
    bandwidth: str(form.theatreBandwidth),
    connectivityType: str(form.connectivityType),
    ispName: str(form.ispCompany),
    details,
  };
}

const uniqueViolation = (err: unknown) =>
  (err as { code?: string })?.code === "23505"
    ? httpError(409, "A WireTAP device with this hardware serial number already exists")
    : err;

wiretap.post("/", async (c) => {
  const form = await c.req.json<DeviceForm>();
  try {
    const row = await transaction(async (client) => {
      const f = await validateForm(form, client);
      const { rows: [created] } = await client.query<{ id: string }>(
        `INSERT INTO wiretap_devices (
           hardware_serial_number, application_serial_number, host_name, cluster_name, theatre_id,
           mapping_status, no_mapping_reason, pull_out_status, pull_out_date, pull_out_reason,
           storage_capacity, bandwidth, connectivity_type, isp_name, details, in_inventory, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true, $16)
         RETURNING id`,
        [f.hardwareSerialNumber, f.applicationSerialNumber, f.hostName, f.clusterName, f.theatreId,
          f.mapped ? "Mapped" : "Unmapped", f.noMappingReason, f.pulledOut ? "Pulled Out" : "Installed",
          f.pullOutDate, f.pullOutReason, f.storage, f.bandwidth, f.connectivityType, f.ispName,
          f.details, CURRENT_USER],
      );
      return created;
    });
    return c.json(row, 201);
  } catch (err) {
    throw uniqueViolation(err);
  }
});

/**
 * Update from the edit page. Connectivity specs are theatre properties and
 * read-only there, so they are not written here.
 */
wiretap.put("/:id", async (c) => {
  const form = await c.req.json<DeviceForm>();
  try {
    const id = c.req.param("id");
    await transaction(async (client) => {
      const f = await validateForm(form, client);
      const { rows: [current] } = await client.query<{ status: string }>(
        `SELECT t.status FROM wiretap_devices d
         JOIN theatres t ON t.id = d.theatre_id
         WHERE d.id = $1 FOR UPDATE`, [id],
      );
      if (current) assertNotDeleted(current);
      const { rows } = await client.query(
        `UPDATE wiretap_devices SET
           hardware_serial_number = $2, application_serial_number = $3, host_name = $4, cluster_name = $5,
           theatre_id = CASE WHEN $6::boolean THEN $7 ELSE NULL END,
           mapping_status = CASE WHEN $6::boolean THEN 'Mapped' ELSE 'Unmapped' END,
           no_mapping_reason = $8,
           pull_out_status = CASE WHEN $9::boolean THEN 'Pulled Out'
                                  WHEN pull_out_status = 'Pulled Out' THEN 'Installed'
                                  ELSE pull_out_status END,
           pull_out_date = $10, pull_out_reason = $11,
           storage_capacity = coalesce($12, storage_capacity),
           details = details || $13::jsonb, updated_by = $14
         WHERE id = $1 RETURNING id`,
        [id, f.hardwareSerialNumber, f.applicationSerialNumber, f.hostName, f.clusterName,
          f.mapped, f.theatreId, f.noMappingReason, f.pulledOut, f.pullOutDate, f.pullOutReason,
          f.storage, f.details, CURRENT_USER],
      );
      if (rows.length === 0) throw notFound("WireTAP device");
    });
    return c.json({ id });
  } catch (err) {
    throw uniqueViolation(err);
  }
});

/** Activate / deactivate. Body: { status: "Active" | "Inactive", reason?: string } */
wiretap.patch("/:id/activation", async (c) => {
  const { status, reason } = await c.req.json<{ status?: string; reason?: string }>();
  if (status !== "Active" && status !== "Inactive") throw httpError(400, "status must be \"Active\" or \"Inactive\"");
  if (status === "Inactive" && !str(reason)) throw httpError(400, "A reason is required to deactivate a device");
  const rows = await query(
    `UPDATE wiretap_devices SET activation_status = $2,
         vpn_status = CASE WHEN $2 = 'Active' THEN 'Enabled' ELSE 'Disabled' END,
         deactivation_reason = CASE WHEN $2 = 'Active' THEN NULL ELSE $3 END, updated_by = $4
     WHERE id = $1 RETURNING id`,
    [c.req.param("id"), status, str(reason), CURRENT_USER],
  );
  if (rows.length === 0) throw notFound("WireTAP device");
  return c.json({ id: c.req.param("id"), activationStatus: status });
});
