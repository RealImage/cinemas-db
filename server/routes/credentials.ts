import { Hono } from "hono";
import type pg from "pg";
import { randomUUID } from "node:crypto";
import { query, transaction } from "../db";
import { decryptValue, encryptValue, isEncrypted, looksLikeEnvelope, syncCredentialEncryption } from "../../db/secrets";
import { CURRENT_USER, httpError, notFound } from "../http";
import {
  CredentialDeviceInput,
  CredentialDeviceWithStatus,
  CredentialFieldDef,
  CredentialValues,
  GLOBAL_REF,
  ScopedCredential,
  combineRoles,
  credentialScopes,
  credentialValueTypes,
  dciOptions,
  deviceRoleCodes,
  deviceTypes,
  extraChainNames,
  isNumericValue,
  makeFieldKey,
} from "../../src/data/credentialsManagerData";

export const credentials = new Hono();

const DEVICE_SELECT = `
  SELECT d.id, d.brand, d.model, d.roles, d.primary_role AS "primaryRole",
         d.certificate_roles AS "certificateRoles", d.additional_roles AS "additionalRoles",
         d.type, d.dci, d.translations, d.serial_number_required AS "serialNumberRequired",
         d.credential_fields AS "credentialFields", d.updated_by AS "updatedBy", d.updated_at AS "updatedAt",
         EXISTS (SELECT 1 FROM device_credentials c
                 WHERE c.device_id = d.id AND c.scope = 'global' AND c.ref = '${GLOBAL_REF}') AS "hasDefaultCredentials"
  FROM credential_devices d`;

export const CREDENTIAL_COLUMNS = `
  id, device_id AS "deviceId", scope, ref, location, "values",
  updated_by AS "updatedBy", updated_at AS "updatedAt"`;

/** A row as stored: masked values are encrypted strings in `values`. */
export type CredentialRow = Omit<ScopedCredential, "location" | "maskedKeys"> & { location: string | null };

/**
 * API shape of a stored row: only fields in the current format are included;
 * masked values are withheld (only which ones are set is reported) and a null
 * location is dropped to match `location?: string`.
 *
 * Nothing is decrypted here. A value that's still encrypted is reported as
 * masked even if `fields` says otherwise (e.g. a format read just before a
 * concurrent change), so a list can never leak a masked value.
 */
export function toCredential({ location, values, ...rest }: CredentialRow, fields: readonly CredentialFieldDef[]): ScopedCredential {
  const plain: CredentialValues = {};
  const maskedKeys: string[] = [];
  for (const f of fields) {
    const v = values[f.key];
    if (v === undefined) continue;
    if (f.masked || isEncrypted(v)) maskedKeys.push(f.key);
    else plain[f.key] = v;
  }
  const out = { ...rest, values: plain, maskedKeys };
  return location == null ? out : { ...out, location };
}

const isUniqueViolation = (err: unknown) => (err as pg.DatabaseError)?.code === "23505";

async function getDevice(id: string) {
  const [row] = await query<CredentialDeviceWithStatus>(`${DEVICE_SELECT} WHERE d.id = $1`, [id]);
  if (!row) throw notFound("Device");
  return row;
}

async function readJson(c: { req: { json: () => Promise<unknown> } }) {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw httpError(400, "Request body must be a JSON object");
  return body as Record<string, unknown>;
}

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const cleanList = (list: string[]) => Array.from(new Set(list.map((x) => x.trim()).filter(Boolean)));

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

// Seeded ids are "cred-<n>"; order by n so the list keeps its original order, with TMS and ticketing systems last.
credentials.get("/devices", async (c) =>
  c.json(await query<CredentialDeviceWithStatus>(
    `${DEVICE_SELECT} ORDER BY d.type IN ('TMS', 'Ticketing System'), substring(d.id FROM '^cred-(\\d+)$')::int NULLS LAST, d.brand, d.model`)));

credentials.get("/devices/:id", async (c) => c.json(await getDevice(c.req.param("id"))));

/**
 * Validate a device body. With `current`, omitted keys keep their current
 * value (PATCH); without it, brand, model and type are required (POST).
 */
function parseDevice(body: Record<string, unknown>, current?: CredentialDeviceInput): CredentialDeviceInput {
  const has = (key: keyof CredentialDeviceInput) => body[key] !== undefined;

  const text = (key: "brand" | "model", label: string) => {
    if (!has(key)) {
      if (current) return current[key];
      throw httpError(400, `${label} is required`);
    }
    const v = body[key];
    if (typeof v !== "string" || !v.trim()) throw httpError(400, `${label} is required`);
    return v.trim();
  };
  const list = (key: "certificateRoles" | "additionalRoles" | "translations", label: string) => {
    if (!has(key)) return current?.[key] ?? [];
    if (!isStringList(body[key])) throw httpError(400, `${label} must be a list of strings`);
    return cleanList(body[key] as string[]);
  };
  const roleCodes = (codes: string[], label: string) => {
    const upper = codes.map((r) => r.toUpperCase());
    const unknown = upper.filter((r) => !deviceRoleCodes.includes(r));
    if (unknown.length) throw httpError(400, `${label}: unknown role ${unknown.join(", ")}`);
    return upper;
  };
  const oneOf = <T extends string>(key: "type" | "dci", allowed: readonly T[], label: string, fallback?: T): T => {
    if (!has(key)) {
      if (fallback !== undefined) return fallback;
      throw httpError(400, `${label} is required`);
    }
    if (!allowed.includes(body[key] as T)) throw httpError(400, `${label} must be one of: ${allowed.join(", ")}`);
    return body[key] as T;
  };

  let primaryRole = current?.primaryRole ?? null;
  if (has("primaryRole")) {
    const v = body.primaryRole;
    if (v === null || v === "") primaryRole = null;
    else if (typeof v === "string") primaryRole = roleCodes([v], "Role")[0];
    else throw httpError(400, "Role must be a role code");
  }

  let serialNumberRequired = current?.serialNumberRequired ?? false;
  if (has("serialNumberRequired")) {
    if (typeof body.serialNumberRequired !== "boolean") throw httpError(400, "serialNumberRequired must be true or false");
    serialNumberRequired = body.serialNumberRequired;
  }

  let credentialFields = current?.credentialFields ?? [];
  if (has("credentialFields")) credentialFields = parseCredentialFields(body.credentialFields);

  return {
    brand: text("brand", "Brand"),
    model: text("model", "Model"),
    primaryRole,
    // Certificates can carry any role code; additional roles come from the fixed list
    certificateRoles: list("certificateRoles", "Roles from certificates").map((r) => r.toUpperCase()),
    additionalRoles: roleCodes(list("additionalRoles", "Additional roles"), "Additional roles"),
    type: oneOf("type", deviceTypes, "Type", current?.type),
    dci: oneOf("dci", dciOptions, "DCI", current?.dci ?? "NA"),
    translations: list("translations", "Translations"),
    serialNumberRequired,
    credentialFields,
  };
}

/** Validate the credentials format: named, typed fields with unique names; keys kept or generated. */
function parseCredentialFields(raw: unknown): CredentialFieldDef[] {
  if (!Array.isArray(raw)) throw httpError(400, "Credentials format must be a list of fields");
  const fields: CredentialFieldDef[] = [];
  const names = new Set<string>();
  for (const item of raw) {
    const f = item as Partial<CredentialFieldDef>;
    const name = typeof f?.name === "string" ? f.name.trim() : "";
    if (!name) throw httpError(400, "Every credential field needs a name");
    if (names.has(name.toLowerCase())) throw httpError(400, `Credential field "${name}" is listed twice`);
    names.add(name.toLowerCase());
    if (!credentialValueTypes.includes(f.valueType as never)) {
      throw httpError(400, `Value type for "${name}" must be one of: ${credentialValueTypes.join(", ")}`);
    }
    if (f.masked !== undefined && typeof f.masked !== "boolean") throw httpError(400, `Masked for "${name}" must be true or false`);
    if (f.mandatory !== undefined && typeof f.mandatory !== "boolean") throw httpError(400, `Mandatory for "${name}" must be true or false`);
    const keyOk = typeof f.key === "string" && /^[A-Za-z0-9_]+$/.test(f.key) && !fields.some((x) => x.key === f.key);
    fields.push({ key: keyOk ? (f.key as string) : makeFieldKey(name, fields), name, valueType: f.valueType!, masked: f.masked === true,
      // Left out means mandatory, as every field was before the flag existed
      mandatory: f.mandatory !== false });
  }
  return fields;
}

async function saveDevice(id: string | null, d: CredentialDeviceInput) {
  const params = [
    d.brand, d.model, combineRoles(d), d.primaryRole, d.certificateRoles, d.additionalRoles,
    d.type, d.dci, d.translations, d.serialNumberRequired, JSON.stringify(d.credentialFields), CURRENT_USER,
  ];
  try {
    return await transaction(async (db) => {
      if (id === null) {
        const { rows: [row] } = await db.query<{ id: string }>(
          `INSERT INTO credential_devices (brand, model, roles, primary_role, certificate_roles, additional_roles,
             type, dci, translations, serial_number_required, credential_fields, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
          params,
        );
        return row.id;
      }
      // A device linked to chains or theatres as their TMS / ticketing system must keep that type
      const { rows: [before] } = await db.query<{ type: string; chains: number; theatres: number }>(
        `SELECT type,
                (SELECT count(*)::int FROM chain_tms WHERE device_id = $1)
                  + (SELECT count(*)::int FROM chain_ticketing_systems WHERE device_id = $1) AS chains,
                (SELECT count(*)::int FROM theatre_systems WHERE device_id = $1) AS theatres
         FROM credential_devices WHERE id = $1 FOR UPDATE`, [id]);
      if (before && before.type !== d.type && (before.chains > 0 || before.theatres > 0)) {
        const uses = [before.chains && `${before.chains} chain${before.chains === 1 ? "" : "s"}`,
          before.theatres && `${before.theatres} theatre${before.theatres === 1 ? "" : "s"}`].filter(Boolean).join(" and ");
        throw httpError(409, `${d.brand} ${d.model} is the ${before.type} of ${uses}. Unlink it there before changing its type.`);
      }
      await db.query(
        `UPDATE credential_devices
         SET brand = $1, model = $2, roles = $3, primary_role = $4, certificate_roles = $5, additional_roles = $6,
             type = $7, dci = $8, translations = $9, serial_number_required = $10, credential_fields = $11,
             updated_by = $12, updated_at = now()
         WHERE id = $13`,
        [...params, id],
      );
      // Masked flags may have changed: encrypt or decrypt this model's stored values to match
      await syncCredentialEncryption(db, id);
      return id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw httpError(409, `A device model ${d.brand} ${d.model} already exists`);
    throw err;
  }
}

/** Add a device model. */
credentials.post("/devices", async (c) => {
  const id = await saveDevice(null, parseDevice(await readJson(c)));
  return c.json(await getDevice(id), 201);
});

/**
 * Partial update. Removing or renaming credential fields leaves stored values
 * untouched; toggling Masked encrypts or decrypts the stored values.
 */
credentials.patch("/devices/:id", async (c) => {
  const id = c.req.param("id");
  const current = await getDevice(id);
  await saveDevice(id, parseDevice(await readJson(c), current));
  return c.json(await getDevice(id));
});

// ---------------------------------------------------------------------------
// Credentials of a device
// ---------------------------------------------------------------------------

credentials.get("/devices/:id/credentials", async (c) => {
  const device = await getDevice(c.req.param("id"));
  const rows = await query<CredentialRow>(
    `SELECT ${CREDENTIAL_COLUMNS} FROM device_credentials WHERE device_id = $1 ORDER BY scope, ref`, [device.id]);
  return c.json(rows.map((r) => toCredential(r, device.credentialFields)));
});

/**
 * Validate a credential body against the device's credentials format and
 * build the stored values, encrypting masked ones. Mandatory fields need a
 * value; optional ones may be left blank (and aren't stored). On update
 * (`existing`), a masked field that's left out or blank keeps its stored value.
 */
function parseCredential(
  body: Record<string, unknown>,
  device: CredentialDeviceWithStatus,
  credentialId: string,
  existing?: CredentialRow,
) {
  const fixedScope = existing?.scope;
  const scope = fixedScope ?? body.scope;
  const scopeInfo = credentialScopes.find((s) => s.id === scope);
  if (!scopeInfo) throw httpError(400, `Scope must be one of: ${credentialScopes.map((s) => s.id).join(", ")}`);
  if (fixedScope && body.scope !== undefined && body.scope !== fixedScope) throw httpError(400, "A credential's scope cannot be changed");

  const ref = typeof body.ref === "string" ? body.ref.trim() : "";
  if (!ref) throw httpError(400, `${scopeInfo.refLabel} is required`);

  if (body.location !== undefined && body.location !== null && typeof body.location !== "string") {
    throw httpError(400, "Location must be a string");
  }
  const location = scopeInfo.id === "device" ? (body.location as string | undefined)?.trim() || null : null;

  const raw = body.values;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw httpError(400, "values must be an object");
  if (device.credentialFields.length === 0) {
    throw httpError(400, "This device model has no credentials format yet. Add credential fields to the device first.");
  }
  const values: CredentialValues = {};
  for (const field of device.credentialFields) {
    const v = (raw as Record<string, unknown>)[field.key];
    // Text or a number; left out or null means blank. Anything else is an error, never a silently dropped value
    if (v != null && typeof v !== "string" && !(typeof v === "number" && Number.isFinite(v))) {
      throw httpError(400, `${field.name} must be text or a number`);
    }
    const str = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
    const kept = field.masked ? existing?.values[field.key] : undefined;
    if (!str) {
      if (kept) { values[field.key] = kept; continue; }
      if (field.mandatory === false) continue;
      throw httpError(400, `${field.name} is required`);
    }
    if (field.valueType === "numeric" && !isNumericValue(str)) throw httpError(400, `${field.name} must be a number`);
    if (looksLikeEnvelope(str)) throw httpError(400, `${field.name} can't start with "enc:v1:"`);
    values[field.key] = field.masked ? encryptValue(str, credentialId, field.key) : str;
  }
  if (Object.keys(values).length === 0) throw httpError(400, "Enter at least one credential value");
  return { scope: scopeInfo.id, scopeLabel: scopeInfo.label, ref, location, values };
}

const duplicateRef = (label: string, ref: string) =>
  httpError(409, `${label} for ${ref} already exist for this device`);

/**
 * Run a credential write with the device row share-locked. A device PATCH
 * (which may toggle Masked and re-encrypt) then waits for the write, and the
 * write waits for a PATCH in progress, so values are always encoded for the
 * format that's actually stored.
 */
async function withLockedDevice<T>(deviceId: string, fn: (db: pg.PoolClient, device: CredentialDeviceWithStatus) => Promise<T>) {
  return transaction(async (db) => {
    const { rows: [device] } = await db.query<CredentialDeviceWithStatus>(`${DEVICE_SELECT} WHERE d.id = $1 FOR SHARE OF d`, [deviceId]);
    if (!device) throw notFound("Device");
    return fn(db, device);
  });
}

credentials.post("/devices/:id/credentials", async (c) => {
  const body = await readJson(c);
  // The id is chosen here because it's bound into the encryption of masked values
  const id = randomUUID();
  let scopeLabel = "", ref = "";
  try {
    const { row, fields } = await withLockedDevice(c.req.param("id"), async (db, device) => {
      const input = parseCredential(body, device, id);
      ({ scopeLabel, ref } = input);
      const { rows: [row] } = await db.query<CredentialRow>(
        `INSERT INTO device_credentials (id, device_id, scope, ref, location, "values", updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${CREDENTIAL_COLUMNS}`,
        [id, device.id, input.scope, input.ref, input.location, JSON.stringify(input.values), CURRENT_USER],
      );
      return { row, fields: device.credentialFields };
    });
    return c.json(toCredential(row, fields), 201);
  } catch (err) {
    if (isUniqueViolation(err)) throw duplicateRef(scopeLabel, ref);
    throw err;
  }
});

async function getCredential(db: Pick<pg.PoolClient, "query"> | null, deviceId: string, credentialId: string) {
  const sql = `SELECT ${CREDENTIAL_COLUMNS} FROM device_credentials WHERE device_id = $1 AND id = $2`;
  const [row] = db
    ? (await db.query<CredentialRow>(`${sql} FOR UPDATE`, [deviceId, credentialId])).rows
    : await query<CredentialRow>(sql, [deviceId, credentialId]);
  if (!row) throw notFound("Credential");
  return row;
}

credentials.put("/devices/:id/credentials/:credentialId", async (c) => {
  const body = await readJson(c);
  let scopeLabel = "", ref = "";
  try {
    const { row, fields } = await withLockedDevice(c.req.param("id"), async (db, device) => {
      const existing = await getCredential(db, device.id, c.req.param("credentialId"));
      const input = parseCredential(body, device, existing.id, existing);
      ({ scopeLabel, ref } = input);
      const { rows: [row] } = await db.query<CredentialRow>(
        `UPDATE device_credentials
         SET ref = $2, location = $3, "values" = $4, updated_by = $5, updated_at = now()
         WHERE id = $1 RETURNING ${CREDENTIAL_COLUMNS}`,
        [existing.id, input.ref, input.location, JSON.stringify(input.values), CURRENT_USER],
      );
      return { row, fields: device.credentialFields };
    });
    return c.json(toCredential(row, fields));
  } catch (err) {
    if (isUniqueViolation(err)) throw duplicateRef(scopeLabel, ref);
    throw err;
  }
});

/** Reveal one masked value. Lists never include masked values; the UI calls this on an explicit View. */
credentials.get("/devices/:id/credentials/:credentialId/values/:fieldKey", async (c) => {
  const device = await getDevice(c.req.param("id"));
  const credential = await getCredential(null, device.id, c.req.param("credentialId"));
  const fieldKey = c.req.param("fieldKey");
  const field = device.credentialFields.find((f) => f.key === fieldKey);
  if (!field) throw notFound("Credential field");
  const stored = credential.values[fieldKey];
  if (stored === undefined) throw notFound(`${field.name} value`);
  c.header("Cache-Control", "no-store");
  let value: string;
  try {
    value = decryptValue(stored, credential.id, fieldKey);
  } catch {
    // Wrong CREDENTIALS_ENCRYPTION_KEY, or the stored value was altered
    throw httpError(500, `${field.name} could not be decrypted`);
  }
  return c.json({ value });
});

credentials.delete("/devices/:id/credentials/:credentialId", async (c) => {
  const rows = await query(
    "DELETE FROM device_credentials WHERE device_id = $1 AND id = $2 RETURNING id",
    [c.req.param("id"), c.req.param("credentialId")],
  );
  if (rows.length === 0) throw notFound("Credential");
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// Options for the chain / theatre pickers in the credential dialog
// ---------------------------------------------------------------------------

credentials.get("/ref-options", async (c) => {
  const [chainRows, theatreRows] = await Promise.all([
    query<{ name: string; deleted: boolean }>("SELECT DISTINCT name, status = 'Deleted' AS deleted FROM chains WHERE name <> ''"),
    query<{ name: string }>("SELECT DISTINCT name FROM theatres WHERE name <> ''"),
  ]);
  const sorted = (names: string[]) => Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  // A Deleted chain is never offered, even when its name is one of the extra names; extras with no chain row stay
  const live = new Set(chainRows.filter((r) => !r.deleted).map((r) => r.name));
  const deleted = new Set(chainRows.filter((r) => r.deleted && !live.has(r.name)).map((r) => r.name));
  return c.json({
    chains: sorted([...live, ...extraChainNames.filter((name) => !deleted.has(name))]),
    theatres: sorted(theatreRows.map((r) => r.name)),
  });
});
