import { Hono } from "hono";
import { query, transaction } from "../db";
import { CURRENT_USER, httpError, notFound } from "../http";
import { SYSTEM_NAME } from "../theatreSystems";
import type { Chain } from "../../src/types";

export const chains = new Hono();

const CHAIN_SELECT = `
  SELECT c.id, c.name, c.company_id AS "companyId", co.name AS "companyName",
         (SELECT count(*) FROM theatres t WHERE t.chain_id = c.id) AS "theatreCount",
         c.status, c.created_at AS "createdAt", c.updated_at AS "updatedAt",
         coalesce((SELECT json_agg(json_build_object('id', d.id, 'name', ${SYSTEM_NAME}) ORDER BY lower(d.brand), lower(d.model))
                   FROM chain_tms x JOIN credential_devices d ON d.id = x.device_id WHERE x.chain_id = c.id), '[]') AS tms
  FROM chains c LEFT JOIN companies co ON co.id = c.company_id`;

chains.get("/", async (c) => c.json(await query<Chain>(`${CHAIN_SELECT} ORDER BY c.name`)));

chains.get("/:id", async (c) => {
  const [row] = await query<Chain>(`${CHAIN_SELECT} WHERE c.id = $1`, [c.req.param("id")]);
  if (!row) throw notFound("Chain");
  return c.json(row);
});

chains.delete("/:id", async (c) => {
  const rows = await query("DELETE FROM chains WHERE id = $1 RETURNING id", [c.req.param("id")]);
  if (rows.length === 0) throw notFound("Chain");
  return c.body(null, 204);
});

/**
 * Replace the TMSes a chain's theatres may use (Credentials Manager entries of type TMS). Body: { deviceIds }.
 * A TMS still used by one of the chain's theatres can't be removed.
 */
chains.put("/:id/tms", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ deviceIds?: unknown }>();
  if (!Array.isArray(body.deviceIds) || !body.deviceIds.every((d) => typeof d === "string")) {
    throw httpError(400, "deviceIds must be a list of TMS ids");
  }
  const deviceIds = [...new Set(body.deviceIds as string[])];
  const chain = await transaction(async (client) => {
    const { rows: [row] } = await client.query("SELECT id FROM chains WHERE id = $1 FOR UPDATE", [id]);
    if (!row) throw notFound("Chain");
    const { rows: found } = await client.query<{ id: string }>(
      "SELECT id FROM credential_devices WHERE id = ANY($1) AND type = 'TMS' FOR SHARE", [deviceIds]);
    const unknown = deviceIds.filter((d) => !found.some((f) => f.id === d));
    if (unknown.length) throw httpError(400, `Not a TMS in the Credentials Manager: ${unknown.join(", ")}`);
    const { rows: inUse } = await client.query<{ name: string; theatres: number }>(
      `SELECT ${SYSTEM_NAME} AS name, count(*)::int AS theatres
       FROM theatre_systems s JOIN theatres t ON t.id = s.theatre_id JOIN credential_devices d ON d.id = s.device_id
       WHERE s.kind = 'TMS' AND t.chain_id = $1 AND NOT (s.device_id = ANY($2)) GROUP BY d.id`, [id, deviceIds]);
    if (inUse.length) {
      throw httpError(409, `Still in use by this chain's theatres: ${inUse.map((u) => `${u.name} (${u.theatres})`).join(", ")}. Change those theatres first.`);
    }
    await client.query("DELETE FROM chain_tms WHERE chain_id = $1 AND NOT (device_id = ANY($2))", [id, deviceIds]);
    await client.query(
      `INSERT INTO chain_tms (chain_id, device_id, updated_by) SELECT $1, unnest($2::text[]), $3 ON CONFLICT DO NOTHING`,
      [id, deviceIds, CURRENT_USER]);
    await client.query("UPDATE chains SET updated_by = $2 WHERE id = $1", [id, CURRENT_USER]);
    const { rows: [updated] } = await client.query<Chain>(`${CHAIN_SELECT} WHERE c.id = $1`, [id]);
    return updated;
  });
  return c.json(chain);
});
