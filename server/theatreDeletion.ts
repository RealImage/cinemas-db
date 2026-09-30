// Theatre deletion requests (parity T-32): request with a reason → approve (soft delete) → restore, or a permanent
// delete THEATRE_PERMANENT_DELETE_HOURS after the approval. Shared by the theatres and approvals routes.
import type pg from "pg";
import { httpError, notFound } from "./http";
import { THEATRE_PERMANENT_DELETE_HOURS, type Theatre } from "../src/types";

/** When a soft-deleted theatre may be deleted permanently, as SQL over a theatres row `t`. */
export const PERMANENT_DELETE_FROM = `t.deleted_at + interval '${THEATRE_PERMANENT_DELETE_HOURS} hours'`;

/** Queue rows (TheatreDeletionRequest), from theatre_deletion_requests `r`. */
export const DELETION_SELECT = `
  SELECT r.id, r.theatre_id AS "theatreId", t.name AS "theatreName", coalesce(c.name, '') AS "chainName",
         coalesce(t.city, '') AS city,
         (SELECT count(*) FROM screens s WHERE s.theatre_id = t.id AND s.status <> 'Deleted')::int AS "screenCount",
         r.reason_id AS "reasonId", sr.reason, coalesce(r.comments, '') AS comments, r.status,
         r.requested_by AS "requestedBy", r.requested_at AS "requestedAt",
         r.reviewed_by AS "reviewedBy", r.reviewed_at AS "reviewedAt", r.review_comments AS "reviewComments",
         CASE WHEN r.status = 'Approved' THEN t.deleted_at END AS "deletedAt",
         CASE WHEN r.status = 'Approved' THEN t.deleted_by END AS "deletedBy",
         CASE WHEN r.status = 'Approved' THEN ${PERMANENT_DELETE_FROM} END AS "permanentDeleteFrom"
  FROM theatre_deletion_requests r
  JOIN theatres t ON t.id = r.theatre_id
  JOIN status_reasons sr ON sr.id = r.reason_id
  LEFT JOIN chains c ON c.id = t.chain_id`;

type LockedTheatre = { id: string; name: string; status: Theatre["status"]; deleted_at: string | null; permanent_from: string | null };

/** Lock a theatre row for a deletion step. Every step locks the theatre before its request, so they can't deadlock. */
export async function lockTheatre(client: pg.PoolClient, id: string) {
  const { rows: [t] } = await client.query<LockedTheatre>(
    `SELECT t.id, t.name, t.status, t.deleted_at, ${PERMANENT_DELETE_FROM} AS permanent_from
     FROM theatres t WHERE t.id = $1 FOR UPDATE`, [id]);
  if (!t) throw notFound("Theatre");
  return t;
}

/** A soft-deleted theatre can only be viewed, restored or deleted permanently. */
export function assertNotDeleted(t: { status: string }) {
  if (t.status === "Deleted") throw httpError(409, "This theatre is deleted. Restore the theatre first.");
}

/** Readable UTC time for messages, e.g. "2 Oct 2026, 14:05 UTC". */
export const formatUtc = (iso: string) =>
  `${new Date(iso).toLocaleString("en-GB", {
    timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })} UTC`;

/** The optional comments field of a request body: a string, or 400. */
export function commentsField(value: unknown, what = "comments") {
  if (value == null) return "";
  if (typeof value !== "string") throw httpError(400, `${what} must be text`);
  return value.trim();
}
