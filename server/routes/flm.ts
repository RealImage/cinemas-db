import { Hono } from "hono";
import type pg from "pg";
import { query, transaction } from "../db";
import { CURRENT_USER, httpError, notFound } from "../http";
import { writeLogs } from "./theatres";
import type { FlmFacilityDetails, FlmFeed } from "../../src/data/flmFeedsData";

export const flm = new Hono();

const FEED_SELECT = `
  SELECT f.id, f.theatre_name AS "theatreName", coalesce(f.theatre_display_name, '') AS "theatreDisplayName",
         coalesce(f.address, '') AS address, coalesce(f.theatre_uuid, '') AS "theatreUuid",
         coalesce(f.chain_name, '') AS chain, coalesce(f.location, '') AS location,
         f.feed_theatre_id AS "theatreIdFeed", f.source, f.is_new_theatre AS "isNewTheatre",
         f.received_at AS "receivedOn", f.status, f.mapped_theatre_id AS "mappedTheatreId", f.details
  FROM flm_feeds f`;

const stripNulls = (f: FlmFeed) => ({
  ...f,
  mappedTheatreId: f.mappedTheatreId ?? undefined,
  details: f.details ?? undefined,
});

/** Feed records not ignored, newest first. */
flm.get("/", async (c) =>
  c.json((await query<FlmFeed>(`${FEED_SELECT} WHERE f.ignored_at IS NULL ORDER BY f.received_at DESC`)).map(stripNulls)),
);

flm.get("/:id", async (c) => {
  const [row] = await query<FlmFeed>(`${FEED_SELECT} WHERE f.id = $1`, [c.req.param("id")]);
  if (!row) throw notFound("FLM feed");
  return c.json(stripNulls(row));
});

// ---------------------------------------------------------------------------
// Resolving a feed
// ---------------------------------------------------------------------------

type FeedRow = {
  id: string; feed_theatre_id: string; theatre_uuid: string | null; theatre_name: string;
  theatre_display_name: string | null; chain_name: string | null; address: string | null; location: string | null;
  status: string; mapped_theatre_id: string | null; details: FlmFacilityDetails | null;
  pending_mappings: { domain: string; externalId: string }[]; ignored_at: string | null;
};

/** Same field keys as the comparison table on the feed detail page. */
const FIELD_KEYS = ["sourceTheatreId", "theatreUuid", "name", "displayName", "address", "city", "state", "country",
  "postalCode", "chain", "timezone", "contactName", "phone", "email"] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

async function lockFeed(client: pg.PoolClient, id: string) {
  const { rows } = await client.query<FeedRow>("SELECT * FROM flm_feeds WHERE id = $1 FOR UPDATE", [id]);
  if (rows.length === 0) throw notFound("FLM feed");
  const feed = rows[0];
  if (feed.ignored_at) throw httpError(409, "This feed update was ignored");
  if (feed.status !== "Manual") throw httpError(409, "This feed was already processed");
  return feed;
}

/** Incoming value per field, as the detail page shows it. */
function incoming(feed: FeedRow): Record<FieldKey, string | null> {
  const [city, state, country] = (feed.location ?? "").split(",").map((p) => p.trim());
  const d = feed.details;
  return {
    sourceTheatreId: feed.feed_theatre_id,
    theatreUuid: feed.theatre_uuid,
    name: feed.theatre_name,
    displayName: feed.theatre_display_name,
    address: feed.address,
    city: d?.city ?? city ?? null,
    state: d?.state ?? state ?? null,
    country: d?.country ?? country ?? null,
    postalCode: d?.postalCode ?? null,
    chain: feed.chain_name,
    timezone: d?.timezone ?? null,
    contactName: d?.contact?.name ?? null,
    phone: d?.contact?.phone ?? null,
    email: d?.contact?.email ?? null,
  };
}

const COLUMN: Record<Exclude<FieldKey, "chain">, string> = {
  sourceTheatreId: "third_party_id", theatreUuid: "uuid", name: "name", displayName: "display_name",
  address: "address", city: "city", state: "state", country: "country", postalCode: "postal_code",
  timezone: "timezone", contactName: "contact", phone: "phone_number", email: "email",
};

async function chainIdByName(client: pg.PoolClient, name: string) {
  const { rows } = await client.query<{ id: string }>("SELECT id FROM chains WHERE lower(name) = lower($1) LIMIT 1", [name]);
  if (rows[0]) return rows[0].id;
  const { rows: created } = await client.query<{ id: string }>(
    "INSERT INTO chains (name, created_by, updated_by) VALUES ($1, $2, $2) RETURNING id", [name, CURRENT_USER],
  );
  return created[0].id;
}

/** Copy the selected incoming fields onto the theatre; returns change-log entries. */
async function copyFields(client: pg.PoolClient, theatreId: string, feed: FeedRow, fields: FieldKey[]) {
  const values = incoming(feed);
  const sets: string[] = [];
  const params: unknown[] = [theatreId];
  for (const key of fields) {
    const value = values[key];
    if (value === null || value === undefined || value === "") continue;
    if (key === "chain") {
      params.push(await chainIdByName(client, value));
      sets.push(`chain_id = $${params.length}`);
    } else {
      params.push(value);
      sets.push(`${COLUMN[key]} = $${params.length}`);
    }
  }
  params.push(CURRENT_USER);
  sets.push(`updated_by = $${params.length}`);
  await client.query(`UPDATE theatres SET ${sets.join(", ")} WHERE id = $1`, params);
}

/** Record the feed's source ID and any IDs mapped on the feed as theatre mappings, and close the feed. */
async function attachFeed(client: pg.PoolClient, theatreId: string, feed: FeedRow) {
  const ids = [...feed.pending_mappings];
  const sep = feed.feed_theatre_id.indexOf(":");
  if (sep > 0) ids.push({ domain: feed.feed_theatre_id.slice(0, sep), externalId: feed.feed_theatre_id.slice(sep + 1) });
  for (const m of ids) {
    await client.query(
      "INSERT INTO theatre_mappings (theatre_id, domain, external_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [theatreId, m.domain, m.externalId],
    );
  }
  await client.query(
    `UPDATE flm_feeds SET status = 'Auto-Updated / Mapped', mapped_theatre_id = $2, pending_mappings = '[]',
            resolved_at = now(), resolved_by = $3 WHERE id = $1`,
    [feed.id, theatreId, CURRENT_USER],
  );
}

const uniqueViolation = (err: unknown) => (err as { code?: string }).code === "23505";

/** Map the feed to an existing theatre, copying the selected fields. Body: { theatreId, fields: FieldKey[] } */
flm.post("/:id/map", async (c) => {
  const { theatreId, fields } = await c.req.json<{ theatreId?: string; fields?: string[] }>();
  if (!theatreId) throw httpError(400, "theatreId is required");
  if (!Array.isArray(fields)) throw httpError(400, "fields must be an array");
  const bad = fields.filter((f) => !FIELD_KEYS.includes(f as FieldKey));
  if (bad.length) throw httpError(400, `Unknown field(s): ${bad.join(", ")}`);
  try {
    const result = await transaction(async (client) => {
      const feed = await lockFeed(client, c.req.param("id"));
      const { rows } = await client.query("SELECT 1 FROM theatres WHERE id = $1", [theatreId]);
      if (rows.length === 0) throw notFound("Theatre");
      await copyFields(client, theatreId, feed, fields as FieldKey[]);
      await attachFeed(client, theatreId, feed);
      await writeLogs(client, theatreId, [{
        section: "General Information", action: "Updated",
        newValue: `Mapped FLM feed ${feed.feed_theatre_id}${fields.length ? ` (${fields.length} fields updated)` : ""}`,
      }]);
      return { theatreId };
    });
    return c.json(result);
  } catch (err) {
    if (uniqueViolation(err)) throw httpError(409, "Another theatre already has this feed's theatre UUID");
    throw err;
  }
});

/** Create a new theatre from the feed and map the feed to it. */
flm.post("/:id/create-theatre", async (c) => {
  try {
    const result = await transaction(async (client) => {
      const feed = await lockFeed(client, c.req.param("id"));
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO theatres (name, listing, status, created_by, updated_by) VALUES ($1, 'Listed - Public', 'Active', $2, $2) RETURNING id`,
        [feed.theatre_name, CURRENT_USER],
      );
      const theatreId = rows[0].id;
      await copyFields(client, theatreId, feed, [...FIELD_KEYS]);
      await client.query("UPDATE theatres SET uuid = coalesce(uuid, gen_random_uuid()::text) WHERE id = $1", [theatreId]);
      await attachFeed(client, theatreId, feed);
      await writeLogs(client, theatreId, [{ section: "General Information", action: "Created", newValue: `${feed.theatre_name} (from FLM feed ${feed.feed_theatre_id})` }]);
      return { theatreId };
    });
    return c.json(result, 201);
  } catch (err) {
    if (uniqueViolation(err)) throw httpError(409, "A theatre with this feed's theatre UUID already exists — map to it instead");
    throw err;
  }
});

/** Ignore this feed update (hides it from the list). */
flm.post("/:id/ignore", async (c) => {
  const [row] = await query<{ id: string }>(
    "UPDATE flm_feeds SET ignored_at = now(), ignored_by = $2 WHERE id = $1 RETURNING id",
    [c.req.param("id"), CURRENT_USER],
  );
  if (!row) throw notFound("FLM feed");
  return c.body(null, 204);
});

/** Undo an ignore. */
flm.post("/:id/unignore", async (c) => {
  const [row] = await query<{ id: string }>(
    "UPDATE flm_feeds SET ignored_at = NULL, ignored_by = NULL WHERE id = $1 RETURNING id", [c.req.param("id")],
  );
  if (!row) throw notFound("FLM feed");
  return c.body(null, 204);
});

/**
 * Map a third-party ID to the feed's theatre. If the feed is not mapped to a
 * theatre yet, the ID is kept on the feed and added when it is mapped.
 * Body: { domain, externalId }
 */
flm.post("/:id/third-party-ids", async (c) => {
  const { domain, externalId } = await c.req.json<{ domain?: string; externalId?: string }>();
  if (!domain?.trim() || !externalId?.trim()) throw httpError(400, "domain and externalId are required");
  const mapping = { domain: domain.trim(), externalId: externalId.trim() };
  const result = await transaction(async (client) => {
    const { rows } = await client.query<FeedRow>("SELECT * FROM flm_feeds WHERE id = $1 FOR UPDATE", [c.req.param("id")]);
    if (rows.length === 0) throw notFound("FLM feed");
    const feed = rows[0];
    if (feed.mapped_theatre_id) {
      await client.query(
        "INSERT INTO theatre_mappings (theatre_id, domain, external_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [feed.mapped_theatre_id, mapping.domain, mapping.externalId],
      );
      await writeLogs(client, feed.mapped_theatre_id, [{ section: "General Information", action: "Updated", newValue: `${mapping.domain}:${mapping.externalId}` }]);
      return { mappedTo: "theatre" as const, theatreId: feed.mapped_theatre_id };
    }
    await client.query(
      `UPDATE flm_feeds SET pending_mappings = pending_mappings || $2::jsonb WHERE id = $1`,
      [feed.id, JSON.stringify([mapping])],
    );
    return { mappedTo: "feed" as const };
  });
  return c.json(result);
});
