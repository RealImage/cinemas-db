import { Hono } from "hono";
import type pg from "pg";
import { query, transaction } from "../db";
import { CURRENT_USER, httpError, notFound } from "../http";
import {
  FLEET_TASK_TYPES,
  PROVIDER_SHORT_NAMES,
  type FleetNode,
  type FleetTask,
  type FleetTaskDetail,
  type FleetTaskOptions,
  type FleetTheatre,
  type ImageItem,
  type ImageLog,
  type SaveFleetTaskInput,
  type TaskAppliance,
  type TaskApplianceProgress,
  type VersionItem,
} from "../../src/data/fleetData";

export const fleet = new Hono();

const isUniqueViolation = (err: unknown) => (err as pg.DatabaseError)?.code === "23505";
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

const IMAGE_SELECT = `
  SELECT i.id, i.provider, i.agent_os_name AS "agentOsName",
         COALESCE((SELECT v.version FROM fleet_image_versions v WHERE v.image_id = i.id
                   ORDER BY v.release_date DESC, v.added_on DESC LIMIT 1), '') AS "latestVersion",
         (SELECT v.version FROM fleet_image_versions v WHERE v.image_id = i.id AND v.is_default) AS "defaultVersion",
         GREATEST(i.updated_at, COALESCE((SELECT max(v.added_on) FROM fleet_image_versions v WHERE v.image_id = i.id), i.updated_at)) AS "updatedOn",
         COALESCE(i.updated_by, '') AS "updatedBy", i.default_install AS "defaultInstall"
  FROM fleet_images i`;

async function getImage(id: string) {
  const [row] = await query<ImageItem>(`${IMAGE_SELECT} WHERE i.id = $1`, [id]);
  if (!row) throw notFound("Image");
  return row;
}

const logImage = (client: pg.PoolClient, imageId: string, action: string, details: string, status: ImageLog["status"]) =>
  client.query(
    "INSERT INTO fleet_image_logs (image_id, action, details, user_name, status) VALUES ($1, $2, $3, $4, $5)",
    [imageId, action, details, CURRENT_USER, status],
  );

fleet.get("/images", async (c) =>
  c.json(await query<ImageItem>(`${IMAGE_SELECT} ORDER BY (i.id ~ '^[0-9]+$') DESC, CASE WHEN i.id ~ '^[0-9]+$' THEN i.id::int END, i.agent_os_name`)));

fleet.get("/images/:id", async (c) => c.json(await getImage(c.req.param("id"))));

fleet.patch("/images/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.defaultInstall !== "boolean") throw httpError(400, "defaultInstall must be true or false");
  const image = await getImage(id);
  await transaction(async (client) => {
    await client.query("UPDATE fleet_images SET default_install = $2, updated_by = $3 WHERE id = $1", [id, body.defaultInstall, CURRENT_USER]);
    if (image.defaultInstall !== body.defaultInstall) {
      await logImage(client, id, "Configuration Changed",
        body.defaultInstall ? "Marked as Default Install on New WireTAP" : "Unmarked as Default Install on New WireTAP", "info");
    }
  });
  return c.json(await getImage(id));
});

fleet.get("/images/:id/logs", async (c) => {
  const id = c.req.param("id");
  await getImage(id);
  return c.json(await query<ImageLog>(
    `SELECT id::text, logged_at AS "timestamp", action, details, COALESCE(user_name, '') AS "user", status
     FROM fleet_image_logs WHERE image_id = $1 ORDER BY logged_at DESC, id DESC`, [id]));
});

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

const VERSION_SELECT = `
  SELECT id, version, release_date AS "releaseDate", status, image_url AS "imageUrl",
         release_notes AS "releaseNotes", internal_notes AS "internalNotes",
         added_on AS "addedOn", COALESCE(added_by, '') AS "addedBy",
         deprecated_on AS "deprecatedOn", deprecation_notes AS "deprecationNotes",
         deprecated_by AS "deprecatedBy", is_default AS "isDefault"
  FROM fleet_image_versions`;

type VersionRow = Omit<VersionItem, "deprecatedOn" | "deprecationNotes" | "deprecatedBy"> & {
  deprecatedOn: string | null; deprecationNotes: string | null; deprecatedBy: string | null;
};
const toVersion = (r: VersionRow): VersionItem => {
  const { deprecatedOn, deprecationNotes, deprecatedBy, ...rest } = r;
  return {
    ...rest,
    ...(deprecatedOn ? { deprecatedOn } : {}),
    ...(deprecationNotes != null ? { deprecationNotes } : {}),
    ...(deprecatedBy ? { deprecatedBy } : {}),
  };
};

async function getVersion(imageId: string, versionId: string) {
  const [row] = await query<VersionRow>(`${VERSION_SELECT} WHERE image_id = $1 AND id = $2`, [imageId, versionId]);
  if (!row) throw notFound("Version");
  return toVersion(row);
}

fleet.get("/images/:id/versions", async (c) => {
  const id = c.req.param("id");
  await getImage(id);
  const rows = await query<VersionRow>(`${VERSION_SELECT} WHERE image_id = $1 ORDER BY release_date DESC, added_on DESC`, [id]);
  return c.json(rows.map(toVersion));
});

fleet.post("/images/:id/versions", async (c) => {
  const id = c.req.param("id");
  const image = await getImage(id);
  const body = await c.req.json().catch(() => ({}));
  const version = str(body.version);
  if (!version) throw httpError(400, "Version number is required");
  if (version.length > 50) throw httpError(400, "Version number is too long");
  try {
    const created = await transaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO fleet_image_versions (image_id, version, image_url, release_notes, internal_notes, added_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [id, version, str(body.imageUrl), str(body.releaseNotes), str(body.internalNotes), CURRENT_USER],
      );
      await client.query("UPDATE fleet_images SET updated_by = $2 WHERE id = $1", [id, CURRENT_USER]);
      await logImage(client, id, "Version Added", `Added ${version}`, "success");
      return rows[0].id;
    });
    return c.json(await getVersion(id, created), 201);
  } catch (err) {
    if (isUniqueViolation(err)) throw httpError(409, `${image.agentOsName} already has version ${version}`);
    throw err;
  }
});

fleet.post("/images/:id/versions/:versionId/default", async (c) => {
  const { id, versionId } = c.req.param();
  const v = await getVersion(id, versionId);
  if (v.status === "deprecated") throw httpError(400, "A deprecated version cannot be the default");
  await transaction(async (client) => {
    await client.query("UPDATE fleet_image_versions SET is_default = false WHERE image_id = $1 AND is_default AND id <> $2", [id, versionId]);
    await client.query("UPDATE fleet_image_versions SET is_default = true WHERE id = $1", [versionId]);
    await client.query("UPDATE fleet_images SET updated_by = $2 WHERE id = $1", [id, CURRENT_USER]);
    await logImage(client, id, "Version Updated", `Set ${v.version} as default`, "success");
  });
  return c.json(await getVersion(id, versionId));
});

fleet.post("/images/:id/versions/:versionId/deprecate", async (c) => {
  const { id, versionId } = c.req.param();
  const v = await getVersion(id, versionId);
  if (v.status === "deprecated") throw httpError(400, `${v.version} is already deprecated`);
  const body = await c.req.json().catch(() => ({}));
  await transaction(async (client) => {
    await client.query(
      `UPDATE fleet_image_versions SET status = 'deprecated', is_default = false, deprecated_on = now(),
              deprecated_by = $2, deprecation_notes = $3 WHERE id = $1`,
      [versionId, CURRENT_USER, str(body.notes)],
    );
    await client.query("UPDATE fleet_images SET updated_by = $2 WHERE id = $1", [id, CURRENT_USER]);
    await logImage(client, id, "Version Deprecated", `Deprecated ${v.version}`, "warning");
  });
  return c.json(await getVersion(id, versionId));
});

// ---------------------------------------------------------------------------
// Fleet status, appliances, theatres
// ---------------------------------------------------------------------------

fleet.get("/status", async (c) => {
  const imageId = c.req.query("imageId");
  if (!imageId) throw httpError(400, "imageId is required");
  await getImage(imageId);
  return c.json(await query<FleetNode>(
    `SELECT n.id || ':' || ni.image_id AS id, n.id AS "applianceId", n.node_id AS "nodeId",
            COALESCE(ch.name, n.chain_name, '') AS "theatreChain",
            COALESCE(t.name, n.theatre_name) AS "theatreName",
            COALESCE(t.code, n.theatre_code, t.id, '') AS "theatreId",
            COALESCE(t.city, n.city, '') AS city, COALESCE(t.state, n.state, '') AS state,
            COALESCE(t.country, n.country, '') AS country,
            ni.version, ni.status, COALESCE(v.status = 'deprecated', false) AS deprecated,
            ni.last_heartbeat AS "lastHeartbeat", ni.last_update_task AS "lastUpdateTask",
            CASE WHEN cardinality(t.alternate_names) > 0 THEN t.alternate_names ELSE n.alternate_names END AS "alternateNames",
            COALESCE(t.uuid, n.theatre_uuid, '') AS uuid, COALESCE(t.address, n.address, '') AS address,
            t.display_name AS "displayName", t.postal_code AS "postalCode",
            n.cluster_name AS "clusterName", n.appliance_serial_number AS "applianceSerialNumber",
            n.hardware_serial_number AS "hardwareSerialNumber"
     FROM fleet_node_images ni
     JOIN fleet_nodes n ON n.id = ni.node_id
     LEFT JOIN theatres t ON t.id = n.theatre_id
     LEFT JOIN chains ch ON ch.id = t.chain_id
     LEFT JOIN fleet_image_versions v ON v.image_id = ni.image_id AND v.version = ni.version
     WHERE ni.image_id = $1
     ORDER BY n.id`, [imageId]));
});

const APPLIANCE_COLUMNS = `
  n.id, n.appliance_serial_number AS "applianceSerialNumber", n.hardware_serial_number AS "hardwareSerialNumber",
  n.node_id AS "nodeId", n.cluster_name AS "clusterName", n.theatre_id AS "theatreId",
  COALESCE(t.name, n.theatre_name) AS "theatreName",
  json_build_object('city', COALESCE(t.city, n.city, ''), 'state', COALESCE(t.state, n.state, ''), 'country', COALESCE(t.country, n.country, '')) AS "theatreLocation",
  COALESCE(ch.name, n.chain_name, '') AS "chainName",
  json_build_object('city', COALESCE(n.chain_city, ''), 'state', COALESCE(n.chain_state, ''), 'country', COALESCE(n.chain_country, '')) AS "chainAddress"`;
const APPLIANCE_JOINS = `
  LEFT JOIN theatres t ON t.id = n.theatre_id
  LEFT JOIN chains ch ON ch.id = t.chain_id`;

/** Every appliance a task can target (Add Appliance dialog searches this). */
fleet.get("/appliances", async (c) =>
  c.json(await query<TaskAppliance>(
    `SELECT ${APPLIANCE_COLUMNS}, 'Pending' AS "updateStatus", n.updated_at AS "updatedOn"
     FROM fleet_nodes n ${APPLIANCE_JOINS} ORDER BY n.id`)));

fleet.get("/theatres", async (c) =>
  c.json(await query<FleetTheatre>(
    `SELECT id, code, third_party_id AS "thirdPartyId", name FROM theatres
     WHERE status <> 'Deleted' ORDER BY name, code NULLS LAST`)));

/** Version pickers for the Add / Edit Task dialogs. */
fleet.get("/task-options", async (c) => {
  const rows = await query<{ id: string; provider: string; agentOsName: string; versions: string[] }>(
    `SELECT i.id, i.provider, i.agent_os_name AS "agentOsName",
            COALESCE(array_agg(v.version ORDER BY v.release_date DESC) FILTER (WHERE v.status = 'stable'), '{}') AS versions
     FROM fleet_images i LEFT JOIN fleet_image_versions v ON v.image_id = i.id
     GROUP BY i.id ORDER BY i.provider, i.agent_os_name`);
  const byName = (name: string) => rows.find((r) => r.provider === "Appliance OS" && r.agentOsName === name)?.versions ?? [];
  const options: FleetTaskOptions = {
    wireOSVersions: byName("WireOS"),
    partnerOSVersions: byName("PartnerOS"),
    agents: rows
      .filter((r) => r.provider !== "Appliance OS")
      .map((r) => ({ id: r.id, name: `${PROVIDER_SHORT_NAMES[r.provider] ?? r.provider} - ${r.agentOsName}`, versions: r.versions }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
  return c.json(options);
});

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

const TASK_SELECT = `
  SELECT ft.id, ft.task_id AS "taskId", ft.task_type AS "taskType",
         to_char(ft.trigger_date, 'YYYY-MM-DD') || ' ' || ft.trigger_time AS "triggerDate",
         to_char(ft.trigger_date, 'YYYY-MM-DD') AS "triggerDay", ft.trigger_time AS "triggerTime",
         ft.trigger_timezone AS "triggerTimezone", ft.description, COALESCE(ft.created_by, '') AS "createdBy",
         to_char(ft.created_on, 'YYYY-MM-DD') AS "createdOn", ft.status, ft.target_version AS "targetVersion",
         (SELECT count(*) FROM fleet_task_targets tt WHERE tt.task_id = ft.id) AS "affectedDevices",
         ft.image_id AS "selectedAgent",
         CASE WHEN i.id IS NULL THEN NULL
              ELSE COALESCE(${providerShortSql("i.provider")} || ' - ', '') || i.agent_os_name END AS "agentName"
  FROM fleet_tasks ft LEFT JOIN fleet_images i ON i.id = ft.image_id`;

function providerShortSql(col: string) {
  const cases = Object.entries(PROVIDER_SHORT_NAMES).map(([k, v]) => `WHEN '${k.replace(/'/g, "''")}' THEN '${v}'`).join(" ");
  return `(CASE ${col} ${cases} WHEN 'Appliance OS' THEN NULL ELSE ${col} END)`;
}

type TaskRow = FleetTask & { triggerDay: string; triggerTime: string; targetVersion: string | null; selectedAgent: string | null; agentName: string | null };
const toTask = ({ triggerDay: _d, triggerTime: _t, targetVersion, selectedAgent, agentName, ...rest }: TaskRow): FleetTask => ({
  ...rest,
  ...(targetVersion ? { targetVersion } : {}),
  ...(selectedAgent ? { selectedAgent } : {}),
  ...(agentName ? { agentName } : {}),
});

fleet.get("/tasks", async (c) => {
  const rows = await query<TaskRow>(`${TASK_SELECT} ORDER BY ft.created_on DESC, ft.task_id DESC`);
  return c.json(rows.map(toTask));
});

async function getTask(id: string): Promise<FleetTaskDetail> {
  const [row] = await query<TaskRow>(`${TASK_SELECT} WHERE ft.id = $1`, [id]);
  if (!row) throw notFound("Task");
  const appliances = await query<TaskApplianceProgress>(
    `SELECT ${APPLIANCE_COLUMNS}, n.cluster_name AS "clusterId",
            tt.update_status AS "updateStatus", tt.updated_on AS "updatedOn", tt.added_on AS "addedOn",
            COALESCE((SELECT json_agg(json_build_object(
                        'attemptNumber', l.attempt_number, 'timestamp', l.attempted_at,
                        'status', l.status, 'message', l.message) ORDER BY l.attempt_number)
                      FROM fleet_task_attempt_logs l WHERE l.target_id = tt.id), '[]') AS "attemptLogs"
     FROM fleet_task_targets tt JOIN fleet_nodes n ON n.id = tt.node_id ${APPLIANCE_JOINS}
     WHERE tt.task_id = $1 ORDER BY tt.id`, [id]);
  return { ...toTask(row), triggerDay: row.triggerDay, triggerTime: row.triggerTime, appliances };
}

fleet.get("/tasks/:id", async (c) => c.json(await getTask(c.req.param("id"))));

async function parseTaskInput(body: Partial<SaveFleetTaskInput>) {
  const taskType = body.taskType;
  if (!taskType || !FLEET_TASK_TYPES.includes(taskType)) throw httpError(400, `taskType must be one of: ${FLEET_TASK_TYPES.join(", ")}`);
  const triggerDate = str(body.triggerDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(triggerDate) || Number.isNaN(Date.parse(triggerDate))) throw httpError(400, "triggerDate must be YYYY-MM-DD");
  const triggerTime = str(body.triggerTime);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(triggerTime)) throw httpError(400, "triggerTime must be HH:mm");
  const triggerTimezone = str(body.triggerTimezone);
  if (!triggerTimezone) throw httpError(400, "triggerTimezone is required");
  const targetVersion = str(body.targetVersion) || null;
  let imageId = str(body.imageId) || null;
  if (taskType === "WireOS Update" || taskType === "PartnerOS Update") {
    if (!targetVersion) throw httpError(400, `Please select a target version for ${taskType.replace(" Update", "")}`);
    const name = taskType === "WireOS Update" ? "WireOS" : "PartnerOS";
    const [img] = await query<{ id: string }>("SELECT id FROM fleet_images WHERE provider = 'Appliance OS' AND agent_os_name = $1", [name]);
    imageId = img?.id ?? null;
  }
  if (taskType === "Agent Update" && (!imageId || !targetVersion)) throw httpError(400, "Please select an agent and target version");
  if (taskType === "Agent Deactivate" && !imageId) throw httpError(400, "Please select an agent to deactivate");
  if (imageId) {
    const [img] = await query("SELECT 1 FROM fleet_images WHERE id = $1", [imageId]);
    if (!img) throw httpError(400, "Unknown agent / image");
    if (targetVersion) {
      const [v] = await query("SELECT 1 FROM fleet_image_versions WHERE image_id = $1 AND version = $2", [imageId, targetVersion]);
      if (!v) throw httpError(400, `Version ${targetVersion} does not exist for this image`);
    }
  }
  if (!Array.isArray(body.nodeIds) || body.nodeIds.some((n) => typeof n !== "string")) throw httpError(400, "nodeIds must be an array of appliance ids");
  const nodeIds = [...new Set(body.nodeIds)];
  if (nodeIds.length) {
    const found = await query<{ id: string }>("SELECT id FROM fleet_nodes WHERE id = ANY($1)", [nodeIds]);
    if (found.length !== nodeIds.length) {
      const known = new Set(found.map((f) => f.id));
      throw httpError(400, `Unknown appliance(s): ${nodeIds.filter((n) => !known.has(n)).slice(0, 5).join(", ")}`);
    }
  }
  return {
    taskType, triggerDate, triggerTime, triggerTimezone,
    description: str(body.description), targetVersion: taskType === "Agent Deactivate" || taskType === "Others" ? null : targetVersion,
    imageId: taskType === "Others" ? null : imageId, nodeIds,
  };
}

async function syncTargets(client: pg.PoolClient, taskId: string, nodeIds: string[]) {
  await client.query("DELETE FROM fleet_task_targets WHERE task_id = $1 AND NOT (node_id = ANY($2))", [taskId, nodeIds]);
  await client.query(
    `INSERT INTO fleet_task_targets (task_id, node_id) SELECT $1, unnest($2::text[])
     ON CONFLICT (task_id, node_id) DO NOTHING`, [taskId, nodeIds]);
}

fleet.post("/tasks", async (c) => {
  const input = await parseTaskInput(await c.req.json().catch(() => ({})));
  const id = await transaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO fleet_tasks (task_id, task_type, image_id, target_version, trigger_date, trigger_time, trigger_timezone,
                                description, created_by, updated_by)
       VALUES ('FT-' || lpad(nextval('fleet_task_number_seq')::text, 3, '0'), $1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING id`,
      [input.taskType, input.imageId, input.targetVersion, input.triggerDate, input.triggerTime, input.triggerTimezone,
        input.description, CURRENT_USER],
    );
    await syncTargets(client, rows[0].id, input.nodeIds);
    return rows[0].id;
  });
  return c.json(await getTask(id), 201);
});

fleet.put("/tasks/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await getTask(id);
  if (existing.status === "Completed" || existing.status === "Cancelled") {
    throw httpError(409, `${existing.status} tasks cannot be edited`);
  }
  const input = await parseTaskInput(await c.req.json().catch(() => ({})));
  await transaction(async (client) => {
    await client.query(
      `UPDATE fleet_tasks SET task_type = $2, image_id = $3, target_version = $4, trigger_date = $5, trigger_time = $6,
              trigger_timezone = $7, description = $8, updated_by = $9 WHERE id = $1`,
      [id, input.taskType, input.imageId, input.targetVersion, input.triggerDate, input.triggerTime, input.triggerTimezone,
        input.description, CURRENT_USER],
    );
    await syncTargets(client, id, input.nodeIds);
  });
  return c.json(await getTask(id));
});

fleet.post("/tasks/:id/cancel", async (c) => {
  const id = c.req.param("id");
  const task = await getTask(id);
  if (task.status !== "Scheduled") throw httpError(409, `Only scheduled tasks can be cancelled (this one is ${task.status})`);
  await transaction(async (client) => {
    await client.query("UPDATE fleet_tasks SET status = 'Cancelled', updated_by = $2 WHERE id = $1", [id, CURRENT_USER]);
    await client.query("UPDATE fleet_task_targets SET update_status = 'Cancelled', updated_on = now() WHERE task_id = $1 AND update_status = 'Pending'", [id]);
  });
  return c.json(await getTask(id));
});

/** Cancel one pending appliance's update within a task. */
fleet.post("/tasks/:id/appliances/:nodeId/cancel", async (c) => {
  const { id, nodeId } = c.req.param();
  await getTask(id);
  const rows = await query<{ update_status: string }>(
    "SELECT update_status FROM fleet_task_targets WHERE task_id = $1 AND node_id = $2", [id, nodeId]);
  if (!rows[0]) throw notFound("Task appliance");
  if (rows[0].update_status !== "Pending") throw httpError(409, `Only pending updates can be cancelled (this one is ${rows[0].update_status})`);
  await query("UPDATE fleet_task_targets SET update_status = 'Cancelled', updated_on = now() WHERE task_id = $1 AND node_id = $2", [id, nodeId]);
  return c.json(await getTask(id));
});

fleet.delete("/tasks/:id", async (c) => {
  const rows = await query("DELETE FROM fleet_tasks WHERE id = $1 RETURNING id", [c.req.param("id")]);
  if (rows.length === 0) throw notFound("Task");
  return c.body(null, 204);
});
