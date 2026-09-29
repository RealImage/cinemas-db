import { Hono, type Context } from "hono";
import { query, transaction } from "../db";
import { CURRENT_USER, httpError, notFound } from "../http";
import type { CompanyClaim } from "../../src/data/companyClaimsData";
import type { OperationsRegion, PartnerRequest } from "../../src/data/partnersData";

export const approvals = new Hono();

// ---------------------------------------------------------------------------
// Dashboard counts (Approvals & Conflicts page, Theatres dashboard, home)
// ---------------------------------------------------------------------------

export type ApprovalsSummary = {
  approvals: { label: string; count: number }[];
  conflicts: { label: string; count: number }[];
  thirdParty: { label: string; count: number }[];
};

approvals.get("/summary", async (c) => {
  const [r] = await query<Record<string, number>>(`
    SELECT
      (SELECT count(*) FROM company_claims WHERE status = 'Pending') AS claims,
      (SELECT count(*) FROM partner_requests WHERE status = 'Pending') AS partners,
      (SELECT count(*) FROM flm_feeds WHERE status = 'Manual' AND ignored_at IS NULL
         AND is_new_theatre AND mapped_theatre_id IS NULL) AS theatre_additions,
      (SELECT count(*) FROM flm_feeds WHERE status = 'Manual' AND ignored_at IS NULL
         AND NOT (is_new_theatre AND mapped_theatre_id IS NULL)) AS theatre_updates,
      (SELECT count(*) FROM (SELECT 1 FROM screen_devices GROUP BY lower(manufacturer), lower(serial_number)
                             HAVING count(DISTINCT screen_id) > 1) x) AS device_conflicts,
      (SELECT count(*) FROM theatres WHERE status <> 'Deleted' AND chain_id IS NULL) AS no_chain,
      -- Theatres can be created without a location; these rows count the ones still to complete
      (SELECT count(*) FROM theatres WHERE status <> 'Deleted' AND (coalesce(trim(address), '') = ''
         OR coalesce(city, '') = '' OR coalesce(state, '') = '' OR coalesce(country, '') = '')) AS missing_location_fields,
      (SELECT coalesce(sum(n), 0) FROM (SELECT count(*) AS n FROM theatres WHERE status <> 'Deleted'
         GROUP BY lower(trim(name)), lower(coalesce(city, '')) HAVING count(*) > 1) x) AS duplicates,
      (SELECT count(*) FROM (SELECT DISTINCT lower(d.manufacturer), lower(d.model) FROM screen_devices d
         WHERE NOT EXISTS (SELECT 1 FROM tdl_devices t WHERE lower(t.manufacturer) = lower(d.manufacturer)
                           AND lower(t.model) = lower(d.model))) x) AS missing_models,
      (SELECT count(*) FROM theatres WHERE status <> 'Deleted' AND (latitude IS NULL OR longitude IS NULL)) AS missing_lat_long,
      (SELECT count(*) FROM theatres WHERE status <> 'Deleted' AND coalesce(country, '') <> ''
         AND coalesce(state, '') = '') AS missing_province,
      (SELECT count(*) FROM screens WHERE status <> 'Deleted' AND name ~ '^\\s*\\d+\\s*$') AS numeric_names,
      (SELECT count(*) FROM screens s WHERE s.status <> 'Deleted'
         AND NOT EXISTS (SELECT 1 FROM screen_devices d WHERE d.screen_id = s.id)) AS no_devices,
      (SELECT count(*) FROM screens WHERE status <> 'Deleted' AND coalesce(trim(name), '') = ''
         AND coalesce(trim(number), '') = '') AS no_name_number,
      (SELECT count(*) FROM flm_feeds WHERE status = 'Manual' AND ignored_at IS NULL) AS flm_pending,
      (SELECT count(*) FROM wiretap_devices) AS wiretaps`);
  const summary: ApprovalsSummary = {
    // Chain updates, integrators and theatre deletions have no request source in the DB yet.
    approvals: [
      { label: "Chain Updates", count: 0 },
      { label: "Company Claims", count: r.claims },
      { label: "Integrators", count: 0 },
      { label: "Partners", count: r.partners },
      { label: "Theatre Additions", count: r.theatre_additions },
      { label: "Theatre Deletions", count: 0 },
      { label: "Theatre Updates", count: r.theatre_updates },
    ],
    conflicts: [
      { label: "Device Conflicts", count: r.device_conflicts },
      { label: "Facilities without Chains", count: r.no_chain },

      { label: "Facility Duplications", count: r.duplicates },
      { label: "Missing Lat / Long", count: r.missing_lat_long },
      { label: "Missing Location Fields", count: r.missing_location_fields },
      { label: "Missing Models", count: r.missing_models },
      { label: "Missing Province Codes", count: r.missing_province },
      { label: "Screens with Numeric Names", count: r.numeric_names },
      { label: "Screens without Devices", count: r.no_devices },
      { label: "Screens without Screen Names or Numbers", count: r.no_name_number },
    ],
    thirdParty: [
      { label: "Third-party Chain Updates: API", count: 0 },
      { label: "Third-party Theatre Updates: API", count: 0 },
      { label: "Third-party Theatre Updates: FLM", count: r.flm_pending },
      { label: "WireTAPs", count: r.wiretaps },
    ],
  };
  return c.json(summary);
});

// ---------------------------------------------------------------------------
// Company claims
// ---------------------------------------------------------------------------

const CLAIM_SELECT = `
  SELECT id, company_name AS company, coalesce(location, '') AS location, coalesce(company_type, '') AS "companyType",
         chain_claims AS "chainClaims", theatre_claims AS "theatreClaims", last_claimed_at AS "lastClaimedOn",
         coalesce(legal_name, '') AS "legalName", coalesce(company_role, '') AS "companyRole",
         coalesce(city, '') AS city, coalesce(street_address, '') AS "streetAddress",
         coalesce(website, '') AS "companyWebsite", coalesce(phone, '') AS "companyPhone",
         company_name AS "companyName", coalesce(theatre_count, 0) AS "theatreCount",
         coalesce(screen_count, 0) AS "screenCount", coalesce(claimed_by, '') AS "claimedBy",
         claimed_at AS "claimedOn", status
  FROM company_claims`;

/** Pending claims. */
approvals.get("/company-claims", async (c) =>
  c.json(await query<CompanyClaim>(`${CLAIM_SELECT} WHERE status = 'Pending' ORDER BY last_claimed_at DESC NULLS LAST`)),
);

const reviewClaim = (status: "Accepted" | "Rejected") => async (c: Context) => {
  const id = c.req.param("id");
  // Conditional on Pending so concurrent reviews can't both succeed
  const updated = await query(
    `UPDATE company_claims SET status = $2, reviewed_at = now(), reviewed_by = $3
     WHERE id = $1 AND status = 'Pending' RETURNING id`,
    [id, status, CURRENT_USER],
  );
  if (updated.length === 0) {
    const [row] = await query<{ status: string }>("SELECT status FROM company_claims WHERE id = $1", [id]);
    if (!row) throw notFound("Company claim");
    throw httpError(409, `This claim was already ${row.status.toLowerCase()}`);
  }
  const [claim] = await query<CompanyClaim>(`${CLAIM_SELECT} WHERE id = $1`, [id]);
  return c.json(claim);
};

approvals.post("/company-claims/:id/accept", reviewClaim("Accepted"));
approvals.post("/company-claims/:id/reject", reviewClaim("Rejected"));

// ---------------------------------------------------------------------------
// Partner requests
// ---------------------------------------------------------------------------

const PARTNER_SELECT = `
  SELECT id, company, coalesce(location, '') AS location, coalesce(requested_by, '') AS "requestedBy",
         requested_at AS "requestCreatedOn", coalesce(name, '') AS name, coalesce(legal_name, '') AS "companyLegalName",
         coalesce(company_role, '') AS "companyRole", coalesce(street_address, '') AS "streetAddress",
         coalesce(city, '') AS city, coalesce(state, '') AS state, coalesce(country, '') AS country,
         coalesce(website, '') AS "companyWebsite", coalesce(phone, '') AS "companyPhone", status
  FROM partner_requests`;

/** Pending partner requests. */
approvals.get("/partners", async (c) =>
  c.json(await query<PartnerRequest>(`${PARTNER_SELECT} WHERE status = 'Pending' ORDER BY requested_at DESC`)),
);

/** Values for the operations-region picker: locations, chains and theatres in the DB. */
approvals.get("/partners/region-options", async (c) => {
  const [row] = await query<{ locations: string[]; chains: string[]; theatres: string[] }>(`
    SELECT coalesce((SELECT array_agg(l ORDER BY l) FROM (
              SELECT DISTINCT concat_ws(', ', nullif(city, ''), nullif(state, ''), nullif(country, '')) AS l
              FROM theatres WHERE status <> 'Deleted' AND coalesce(city, '') <> '') x), '{}') AS locations,
           coalesce((SELECT array_agg(name ORDER BY name) FROM chains WHERE status <> 'Deleted'), '{}') AS chains,
           coalesce((SELECT array_agg(DISTINCT name ORDER BY name) FROM theatres WHERE status <> 'Deleted'), '{}') AS theatres`);
  return c.json(row);
});

const ensurePartner = async (id: string) => {
  const [row] = await query<{ status: string }>("SELECT status FROM partner_requests WHERE id = $1", [id]);
  if (!row) throw notFound("Partner request");
  return row;
};

const REGION_SELECT = `SELECT id, parameter_type AS "parameterType", value FROM partner_operation_regions`;

approvals.get("/partners/:id/regions", async (c) => {
  const id = c.req.param("id");
  await ensurePartner(id);
  return c.json(await query<OperationsRegion>(`${REGION_SELECT} WHERE partner_request_id = $1 ORDER BY parameter_type, value`, [id]));
});

/** Add an operations region. Body: { parameterType, value } */
approvals.post("/partners/:id/regions", async (c) => {
  const id = c.req.param("id");
  await ensurePartner(id);
  const { parameterType, value } = await c.req.json<{ parameterType?: string; value?: string }>();
  if (!parameterType || !["Location", "Chain", "Theatre"].includes(parameterType)) {
    throw httpError(400, "parameterType must be Location, Chain or Theatre");
  }
  if (!value?.trim()) throw httpError(400, "Please enter a value");
  const [dup] = await query(
    "SELECT 1 FROM partner_operation_regions WHERE partner_request_id = $1 AND parameter_type = $2 AND lower(value) = lower($3)",
    [id, parameterType, value.trim()],
  );
  if (dup) throw httpError(409, `${parameterType} "${value.trim()}" is already in this partner's operations region`);
  const [region] = await query<OperationsRegion>(
    `INSERT INTO partner_operation_regions (partner_request_id, parameter_type, value) VALUES ($1, $2, $3)
     RETURNING id, parameter_type AS "parameterType", value`,
    [id, parameterType, value.trim()],
  );
  return c.json(region, 201);
});

approvals.delete("/partners/:id/regions/:regionId", async (c) => {
  const { id, regionId } = c.req.param();
  const rows = await query(
    "DELETE FROM partner_operation_regions WHERE id = $1 AND partner_request_id = $2 RETURNING id", [regionId, id],
  );
  if (rows.length === 0) throw notFound("Operations region");
  return c.body(null, 204);
});

const reviewPartner = (status: "Approved" | "Rejected") => async (c: Context) => {
  const id = c.req.param("id");
  const partner = await transaction(async (client) => {
    const { rows } = await client.query<{ status: string }>("SELECT status FROM partner_requests WHERE id = $1 FOR UPDATE", [id]);
    if (rows.length === 0) throw notFound("Partner request");
    if (rows[0].status !== "Pending") throw httpError(409, `This request was already ${rows[0].status.toLowerCase()}`);
    await client.query(
      "UPDATE partner_requests SET status = $2, reviewed_at = now(), reviewed_by = $3 WHERE id = $1",
      [id, status, CURRENT_USER],
    );
    return (await client.query<PartnerRequest>(`${PARTNER_SELECT} WHERE id = $1`, [id])).rows[0];
  });
  return c.json(partner);
};

approvals.post("/partners/:id/accept", reviewPartner("Approved"));
approvals.post("/partners/:id/reject", reviewPartner("Rejected"));

/** Put a reviewed claim / partner request back to Pending (undo). */
approvals.post("/company-claims/:id/reopen", async (c) => {
  const rows = await query(
    "UPDATE company_claims SET status = 'Pending', reviewed_at = NULL, reviewed_by = NULL WHERE id = $1 RETURNING id",
    [c.req.param("id")],
  );
  if (rows.length === 0) throw notFound("Company claim");
  return c.body(null, 204);
});

approvals.post("/partners/:id/reopen", async (c) => {
  const rows = await query(
    "UPDATE partner_requests SET status = 'Pending', reviewed_at = NULL, reviewed_by = NULL WHERE id = $1 RETURNING id",
    [c.req.param("id")],
  );
  if (rows.length === 0) throw notFound("Partner request");
  return c.body(null, 204);
});
