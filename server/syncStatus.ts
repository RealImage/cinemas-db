// Helpers shared by the read-only sync-status endpoints (FLM feeds in routes/flm.ts, TDL certificates in routes/tdl.ts).
import { httpError } from "./http";

/**
 * Run counts per source, over runs aliased `r` that are LEFT JOINed on `r.started_at > now() - interval '7 days'`
 * and grouped by source.
 */
export const SYNC_RUN_COUNTS = `
  count(r.id) FILTER (WHERE r.started_at > now() - interval '24 hours')::int AS "runs24h",
  count(r.id)::int AS "runs7d",
  count(r.id) FILTER (WHERE r.status = 'Failed')::int AS "failed7d"`;

/** ?limit= for a runs endpoint: a positive integer, at most 2000. */
export const syncRunLimit = (raw: string | undefined, fallback: number) => {
  const n = Number(raw ?? fallback);
  if (!Number.isInteger(n) || n < 1) throw httpError(400, "limit must be a positive integer");
  return Math.min(n, 2000);
};
