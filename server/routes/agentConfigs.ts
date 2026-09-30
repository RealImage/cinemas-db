import { Hono } from "hono";
import type pg from "pg";
import { randomUUID } from "node:crypto";
import { query, transaction } from "../db";
import { AGENT_CONFIG_SECRETS, decryptValue, encryptValue, isEncrypted, looksLikeEnvelope, syncEncryption } from "../../db/secrets";
import { CURRENT_USER, httpError, notFound } from "../http";
import {
  AgentConfiguration,
  AgentDetails,
  ConfigFieldDef,
  type ConfigScope,
  GLOBAL_REF,
  configScopeIds,
  configScopes,
  configValueError,
  configValueTypes,
  entitlementIds,
  isAgentImage,
  normalizeEntitlements,
} from "../../src/data/agentConfigData";
import { makeFieldKey } from "../../src/data/credentialsManagerData";

/** Mounted at /api/agent-configs; `:id` is a fleet image id. */
export const agentConfigs = new Hono();

const CONTEXT = "agent-config" as const;

const AGENT_SELECT = `
  SELECT i.id, i.provider, i.agent_os_name AS "agentOsName",
         COALESCE((SELECT v.version FROM fleet_image_versions v WHERE v.image_id = i.id
                   ORDER BY v.release_date DESC, v.added_on DESC LIMIT 1), '') AS "latestVersion",
         i.entitlements, i.config_fields AS "configFields", i.config_levels AS "configLevels",
         COALESCE(i.config_updated_by, i.updated_by, '') AS "updatedBy",
         COALESCE(i.config_updated_at, i.updated_at) AS "updatedAt"
  FROM fleet_images i`;

export const CONFIG_COLUMNS = `id, image_id AS "imageId", scope, ref, "values", updated_by AS "updatedBy", updated_at AS "updatedAt"`;

/** A row as stored: masked values are encrypted strings in `values`. */
export type ConfigRow = Omit<AgentConfiguration, "maskedKeys">;

type Db = Pick<pg.PoolClient, "query">;

const isUniqueViolation = (err: unknown) => (err as pg.DatabaseError)?.code === "23505";

async function getAgent(id: string, db?: Db, lock = false) {
  const sql = `${AGENT_SELECT} WHERE i.id = $1${lock ? " FOR SHARE OF i" : ""}`;
  const [row] = db ? (await db.query<AgentDetails>(sql, [id])).rows : await query<AgentDetails>(sql, [id]);
  if (!row || !isAgentImage(row)) throw notFound("Agent");
  // Drop ids no longer in the master list
  return { ...row, entitlements: normalizeEntitlements(row.entitlements) };
}

async function readJson(c: { req: { json: () => Promise<unknown> } }) {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw httpError(400, "Request body must be a JSON object");
  return body as Record<string, unknown>;
}

/**
 * API shape of a stored row: only fields in the current format; masked values
 * withheld. Nothing is decrypted, and a still-encrypted value is always
 * reported as masked, so a list can never leak one.
 */
export function toConfiguration({ values, ...rest }: ConfigRow, fields: readonly ConfigFieldDef[]): AgentConfiguration {
  const plain: Record<string, string> = {};
  const maskedKeys: string[] = [];
  for (const f of fields) {
    const v = values[f.key];
    if (v === undefined) continue;
    if (f.masked || isEncrypted(v)) maskedKeys.push(f.key);
    else plain[f.key] = v;
  }
  return { ...rest, values: plain, maskedKeys };
}

// ---------------------------------------------------------------------------
// Agent: details, entitlements, configurations format
// ---------------------------------------------------------------------------

agentConfigs.get("/:id", async (c) => c.json(await getAgent(c.req.param("id"))));

function parseConfigFields(raw: unknown): ConfigFieldDef[] {
  if (!Array.isArray(raw)) throw httpError(400, "Configurations format must be a list of fields");
  const fields: ConfigFieldDef[] = [];
  const names = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw httpError(400, "Every configuration must be an object");
    const f = item as Partial<ConfigFieldDef>;
    const name = typeof f.name === "string" ? f.name.trim() : "";
    if (!name) throw httpError(400, "Every configuration needs a name");
    if (names.has(name.toLowerCase())) throw httpError(400, `Configuration "${name}" is listed twice`);
    names.add(name.toLowerCase());
    if (!configValueTypes.includes(f.valueType as never)) {
      throw httpError(400, `Value type for "${name}" must be one of: ${configValueTypes.join(", ")}`);
    }
    if (f.masked !== undefined && typeof f.masked !== "boolean") throw httpError(400, `Masked for "${name}" must be true or false`);
    const keyOk = typeof f.key === "string" && /^[A-Za-z0-9_]+$/.test(f.key) && !fields.some((x) => x.key === f.key);
    fields.push({ key: keyOk ? (f.key as string) : makeFieldKey(name, fields), name, valueType: f.valueType!, masked: f.masked === true });
  }
  return fields;
}

/**
 * Update entitlements and/or the configurations format. Removing or renaming a
 * configuration leaves stored values untouched; toggling Masked encrypts or
 * decrypts them in the same transaction.
 */
agentConfigs.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await readJson(c);
  // Validate the body first; nothing here depends on the stored row
  let entitlements: string[] | undefined;
  if (body.entitlements !== undefined) {
    const raw = body.entitlements;
    if (!Array.isArray(raw) || !raw.every((e) => typeof e === "string")) throw httpError(400, "entitlements must be a list of ids");
    const unknown = (raw as string[]).filter((e) => !entitlementIds.includes(e));
    if (unknown.length) throw httpError(400, `Unknown entitlement: ${unknown.join(", ")}`);
    entitlements = raw as string[];
  }
  const newFields = body.configFields !== undefined ? parseConfigFields(body.configFields) : undefined;
  let configLevels: ConfigScope[] | undefined;
  if (body.configLevels !== undefined) {
    const raw = body.configLevels;
    if (!Array.isArray(raw) || !raw.every((l) => configScopeIds.includes(l))) {
      throw httpError(400, `configLevels must be a list of: ${configScopeIds.join(", ")}`);
    }
    if (raw.length === 0) throw httpError(400, "Choose at least one configuration level");
    configLevels = configScopeIds.filter((l) => raw.includes(l)); // in display order, no repeats
  }

  await transaction(async (db) => {
    // Merge against the row as locked here, so concurrent partial updates
    // (one changing entitlements, one the format) apply one after the other
    const [current] = (await db.query<AgentDetails>(`${AGENT_SELECT} WHERE i.id = $1 FOR UPDATE OF i`, [id])).rows;
    if (!current || !isAgentImage(current)) throw notFound("Agent");
    const configFields = newFields ?? current.configFields;
    await db.query(
      `UPDATE fleet_images
       SET entitlements = $2, config_fields = $3, config_levels = $5, config_updated_by = $4, config_updated_at = now()
       WHERE id = $1`,
      [id, normalizeEntitlements(entitlements ?? current.entitlements), JSON.stringify(configFields), CURRENT_USER,
        configLevels ?? current.configLevels],
    );
    await syncEncryption(db, AGENT_CONFIG_SECRETS, id);
  });
  return c.json(await getAgent(id));
});

// ---------------------------------------------------------------------------
// Configuration values
// ---------------------------------------------------------------------------

agentConfigs.get("/:id/configurations", async (c) => {
  const agent = await getAgent(c.req.param("id"));
  const rows = await query<ConfigRow>(
    `SELECT ${CONFIG_COLUMNS} FROM agent_configurations
     WHERE image_id = $1 AND scope = ANY($2) ORDER BY scope, ref`, [agent.id, agent.configLevels]);
  return c.json(rows.map((r) => toConfiguration(r, agent.configFields)));
});

/**
 * Validate a configuration body against the agent's format and build the
 * stored values, encrypting masked ones. On update (`existing`), a masked
 * field left out or blank keeps its stored value.
 */
function parseConfiguration(body: Record<string, unknown>, agent: AgentDetails, rowId: string, existing?: ConfigRow) {
  const scope = existing?.scope ?? body.scope;
  const scopeInfo = configScopes.find((s) => s.id === scope);
  if (!scopeInfo) throw httpError(400, `Scope must be one of: ${configScopes.map((s) => s.id).join(", ")}`);
  if (existing && body.scope !== undefined && body.scope !== existing.scope) throw httpError(400, "A configuration's scope cannot be changed");
  if (!agent.configLevels.includes(scopeInfo.id)) throw httpError(400, `${scopeInfo.label} configurations are turned off for this agent`);

  // Global holds a single row
  const ref = scopeInfo.id === "global" ? GLOBAL_REF : typeof body.ref === "string" ? body.ref.trim() : "";
  if (!ref) throw httpError(400, `${scopeInfo.refLabel} is required`);

  const raw = body.values;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw httpError(400, "values must be an object");
  if (agent.configFields.length === 0) {
    throw httpError(400, "This agent has no configurations. Add them to its configurations format first.");
  }
  const values: Record<string, string> = {};
  for (const field of agent.configFields) {
    const v = (raw as Record<string, unknown>)[field.key];
    const str = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
    const kept = field.masked ? existing?.values[field.key] : undefined;
    if (!str) {
      if (kept) { values[field.key] = kept; continue; }
      throw httpError(400, `${field.name} is required`);
    }
    const invalid = configValueError(field, str);
    if (invalid) throw httpError(400, invalid);
    if (looksLikeEnvelope(str)) throw httpError(400, `${field.name} can't start with "enc:v1:"`);
    values[field.key] = field.masked ? encryptValue(str, rowId, field.key, CONTEXT) : str;
  }
  return { scope: scopeInfo.id, scopeLabel: scopeInfo.label, ref, values };
}

const duplicateRef = (label: string, ref: string) =>
  httpError(409, label === "Global" ? "This agent already has a Global configuration" : `A ${label.toLowerCase()} configuration for ${ref} already exists`);

/** Run a write with the agent row share-locked, so a concurrent format change (and re-encryption) waits for it, and vice versa. */
const withLockedAgent = <T>(id: string, fn: (db: pg.PoolClient, agent: AgentDetails) => Promise<T>) =>
  transaction(async (db) => fn(db, await getAgent(id, db, true)));

agentConfigs.post("/:id/configurations", async (c) => {
  const body = await readJson(c);
  const rowId = randomUUID(); // bound into the encryption of masked values
  let label = "", ref = "";
  try {
    const { row, fields } = await withLockedAgent(c.req.param("id"), async (db, agent) => {
      const input = parseConfiguration(body, agent, rowId);
      ({ scopeLabel: label, ref } = input);
      const { rows: [row] } = await db.query<ConfigRow>(
        `INSERT INTO agent_configurations (id, image_id, scope, ref, "values", updated_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${CONFIG_COLUMNS}`,
        [rowId, agent.id, input.scope, input.ref, JSON.stringify(input.values), CURRENT_USER],
      );
      return { row, fields: agent.configFields };
    });
    return c.json(toConfiguration(row, fields), 201);
  } catch (err) {
    if (isUniqueViolation(err)) throw duplicateRef(label, ref);
    throw err;
  }
});

async function getConfiguration(db: Db | null, imageId: string, configId: string) {
  const sql = `SELECT ${CONFIG_COLUMNS} FROM agent_configurations WHERE image_id = $1 AND id = $2`;
  const [row] = db ? (await db.query<ConfigRow>(`${sql} FOR UPDATE`, [imageId, configId])).rows : await query<ConfigRow>(sql, [imageId, configId]);
  if (!row) throw notFound("Configuration");
  return row;
}

agentConfigs.put("/:id/configurations/:configId", async (c) => {
  const body = await readJson(c);
  let label = "", ref = "";
  try {
    const { row, fields } = await withLockedAgent(c.req.param("id"), async (db, agent) => {
      const existing = await getConfiguration(db, agent.id, c.req.param("configId"));
      const input = parseConfiguration(body, agent, existing.id, existing);
      ({ scopeLabel: label, ref } = input);
      const { rows: [row] } = await db.query<ConfigRow>(
        `UPDATE agent_configurations SET ref = $2, "values" = $3, updated_by = $4, updated_at = now()
         WHERE id = $1 RETURNING ${CONFIG_COLUMNS}`,
        [existing.id, input.ref, JSON.stringify(input.values), CURRENT_USER],
      );
      return { row, fields: agent.configFields };
    });
    return c.json(toConfiguration(row, fields));
  } catch (err) {
    if (isUniqueViolation(err)) throw duplicateRef(label, ref);
    throw err;
  }
});

/** Reveal one masked value, on an explicit View in the UI. */
agentConfigs.get("/:id/configurations/:configId/values/:fieldKey", async (c) => {
  const agent = await getAgent(c.req.param("id"));
  const row = await getConfiguration(null, agent.id, c.req.param("configId"));
  if (!agent.configLevels.includes(row.scope)) throw notFound("Configuration");
  const fieldKey = c.req.param("fieldKey");
  const field = agent.configFields.find((f) => f.key === fieldKey);
  if (!field) throw notFound("Configuration field");
  const stored = row.values[fieldKey];
  if (stored === undefined) throw notFound(`${field.name} value`);
  c.header("Cache-Control", "no-store");
  try {
    return c.json({ value: decryptValue(stored, row.id, fieldKey, CONTEXT) });
  } catch {
    throw httpError(500, `${field.name} could not be decrypted`);
  }
});

agentConfigs.delete("/:id/configurations/:configId", async (c) => {
  // Same 404 as the other endpoints for unknown images and Appliance OS images
  const agent = await getAgent(c.req.param("id"));
  const rows = await query(
    "DELETE FROM agent_configurations WHERE image_id = $1 AND id = $2 RETURNING id",
    [agent.id, c.req.param("configId")],
  );
  if (rows.length === 0) throw notFound("Configuration");
  return c.body(null, 204);
});
