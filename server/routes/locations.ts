import { Hono } from "hono";
import { pool, query, transaction } from "../db";
import { httpError } from "../http";
import {
  insertRecord, listRecords, loadRecord, lockRow, mustLoad, parseInput, setDeleted, updateRecord, writeLog,
} from "../locations/records";
import {
  decide, decisions, itemSource, linkColumns, listItems, lockOpenItem, prefill, resolveFromForm, runs, summary, updateSettings,
} from "../locations/review";
import { startSync } from "../locations/sync";
import {
  isLocationEntity, reviewEntities, reviewFlags,
  type LocationEntity, type ReviewEntity, type ReviewFlag, type ReviewStatus,
} from "../../src/data/locationsData";

export const locations = new Hono();

// ---------------------------------------------------------------------------
// Reference sync review (registered before /:entity so "review" isn't taken for an entity)
// ---------------------------------------------------------------------------

locations.get("/review/summary", async (c) => c.json(await summary(pool)));

locations.get("/review/items", async (c) => {
  const q = c.req.query();
  if (!reviewEntities.includes(q.entity as ReviewEntity)) throw httpError(400, "entity must be one of " + reviewEntities.join(", "));
  if (q.flag && !reviewFlags.some((f) => f.id === q.flag)) throw httpError(400, "Unknown flag");
  if (q.status && !["open", "resolved", "ignored"].includes(q.status)) throw httpError(400, "Unknown status");
  return c.json(await listItems(pool, {
    entity: q.entity as ReviewEntity, flag: (q.flag || undefined) as ReviewFlag | undefined,
    status: (q.status || undefined) as ReviewStatus | undefined, search: q.search, page: Number(q.page), pageSize: Number(q.pageSize),
  }));
});

const itemId = (raw: string) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw httpError(400, "Invalid review item id");
  return id;
};

locations.get("/review/items/:id/prefill", async (c) => c.json(await prefill(pool, itemId(c.req.param("id")))));

locations.post("/review/items/:id", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json(await transaction((db) => decide(db, itemId(c.req.param("id")), body)));
});

locations.post("/review/run", async (c) => c.json({ runId: await startSync("manual") }, 202));
locations.get("/review/runs", async (c) => c.json(await runs()));
locations.get("/review/decisions", async (c) =>
  c.json(await decisions(Number(c.req.query("page")) || 1, Math.min(Math.max(Number(c.req.query("pageSize")) || 100, 1), 1000))));
locations.put("/review/settings", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json(await transaction((db) => updateSettings(db, body)));
});

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

const entityParam = (raw: string): LocationEntity => {
  if (!isLocationEntity(raw)) throw httpError(404, `Unknown location type "${raw}"`);
  return raw;
};

locations.get("/:entity", async (c) => {
  const entity = entityParam(c.req.param("entity"));
  const q = c.req.query();
  return c.json(await listRecords(entity, {
    search: q.search, sort: q.sort, direction: q.direction === "asc" || q.direction === "desc" ? q.direction : undefined,
    page: Number(q.page), pageSize: Number(q.pageSize), includeDeleted: q.includeDeleted === "true",
    needsReview: q.needsReview === "true", countryId: q.countryId, provinceId: q.provinceId,
  }));
});

locations.get("/:entity/:id", async (c) => c.json(await mustLoad(entityParam(c.req.param("entity")), c.req.param("id"))));

locations.get("/:entity/:id/logs", async (c) => {
  const entity = entityParam(c.req.param("entity"));
  const id = c.req.param("id");
  await mustLoad(entity, id);
  return c.json(await query(
    `SELECT id, entity, record_id AS "recordId", action, updated_by AS "updatedBy", created_at AS "createdAt",
       current, previous, source, source_ref AS "sourceRef"
     FROM location_logs WHERE entity = $1 AND record_id = $2 ORDER BY id DESC`, [entity, id]));
});

const reviewItemOf = (body: Record<string, unknown>) =>
  body.reviewItemId == null || body.reviewItemId === "" ? null : Number(body.reviewItemId);

locations.post("/:entity", async (c) => {
  const entity = entityParam(c.req.param("entity"));
  if (entity === "timezones") throw httpError(400, "Timezones come from the IANA database; add them from the Review page");
  const body = await c.req.json().catch(() => ({}));
  const record = await transaction(async (db) => {
    const reviewItemId = reviewItemOf(body);
    const item = reviewItemId ? await lockOpenItem(db, reviewItemId, entity) : null;
    if (item && item.flag !== "new") throw httpError(400, "Only New review items are added with the create form");
    const parsed = await parseInput(entity, body, db, undefined);
    const id = await insertRecord(db, entity, parsed, item ? linkColumns(item) : {});
    const created = await loadRecord(entity, id, db);
    await writeLog(db, entity, id, "CREATE", null, created, item ? itemSource(item) : undefined);
    if (item) await resolveFromForm(db, item);
    return loadRecord(entity, id, db);
  });
  return c.json(record, 201);
});

locations.put("/:entity/:id", async (c) => {
  const entity = entityParam(c.req.param("entity"));
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const record = await transaction(async (db) => {
    const reviewItemId = reviewItemOf(body);
    const item = reviewItemId ? await lockOpenItem(db, reviewItemId, entity) : null;
    if (item && item.recordId !== id) throw httpError(400, "The review item is about a different record");
    const existing = await lockRow(db, entity, id);
    const before = await loadRecord(entity, id, db);
    const parsed = await parseInput(entity, body, db, existing);
    await updateRecord(db, entity, id, parsed.columns, parsed.links);
    const after = await loadRecord(entity, id, db);
    await writeLog(db, entity, id, "UPDATE", before, after, item ? itemSource(item) : undefined);
    if (item) await resolveFromForm(db, item);
    return loadRecord(entity, id, db);
  });
  return c.json(record);
});

locations.post("/:entity/:id/deactivate", async (c) =>
  c.json(await transaction((db) => setDeleted(db, entityParam(c.req.param("entity")), c.req.param("id"), true))));

locations.post("/:entity/:id/restore", async (c) =>
  c.json(await transaction((db) => setDeleted(db, entityParam(c.req.param("entity")), c.req.param("id"), false))));
