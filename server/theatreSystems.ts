// A theatre's TMS and ticketing system are Credentials Manager entries (credential_devices), linked through
// theatre_systems; a chain's allowed TMSes through chain_tms (db/migrations/012_theatre_systems.sql).

/** "Brand Model" of credential device `d`, or just the brand when the model repeats it (Vista Vista). */
export const SYSTEM_NAME = "CASE WHEN lower(d.model) = lower(d.brand) THEN d.brand ELSE d.brand || ' ' || d.model END";

/** Name of the theatre `t`'s TMS or ticketing system, as a subquery. */
export const theatreSystemName = (kind: "TMS" | "Ticketing System") =>
  `(SELECT ${SYSTEM_NAME} FROM theatre_systems s JOIN credential_devices d ON d.id = s.device_id
    WHERE s.theatre_id = t.id AND s.kind = '${kind}')`;

