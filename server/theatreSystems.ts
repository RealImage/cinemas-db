// A theatre's TMS and ticketing system are Credentials Manager entries (credential_devices), linked through
// theatre_systems; a chain's approved TMSes through chain_tms (db/migrations/012_theatre_systems.sql) and its
// approved ticketing systems through chain_ticketing_systems (022). A theatre's system must be one of its chain's.

export type SystemKind = "TMS" | "Ticketing System";

/** Per kind: the chain link table, its name on the Edit Chain page, and a short noun for messages. */
export const CHAIN_SYSTEMS: Record<SystemKind, { table: string; label: string; noun: string }> = {
  TMS: { table: "chain_tms", label: "Theatre Management Systems", noun: "TMS" },
  "Ticketing System": { table: "chain_ticketing_systems", label: "POS / Ticketing Systems", noun: "ticketing system" },
};

/** "Brand Model" of credential device `d`, or just the brand when the model repeats it (Vista Vista). */
export const SYSTEM_NAME = "CASE WHEN lower(d.model) = lower(d.brand) THEN d.brand ELSE d.brand || ' ' || d.model END";

/** Name of the theatre `t`'s TMS or ticketing system, as a subquery. */
export const theatreSystemName = (kind: SystemKind) =>
  `(SELECT ${SYSTEM_NAME} FROM theatre_systems s JOIN credential_devices d ON d.id = s.device_id
    WHERE s.theatre_id = t.id AND s.kind = '${kind}')`;

