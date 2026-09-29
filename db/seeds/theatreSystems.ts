import { theatres } from "../../src/data/mockData";
import type { ExtraSeeder } from "./types";

/**
 * Links the sample theatres' TMS and ticketing system to Credentials Manager entries (by brand, preferring an exact
 * model name), and each chain to the TMSes its theatres use, as migration 012 did for existing data. Runs after
 * the credentials seeder.
 */
export const theatreSystemsSeeder: ExtraSeeder = {
  name: "theatreSystems",
  tables: ["theatre_systems", "chain_tms"],
  async run(client) {
    const rows = theatres.flatMap((t) => [
      [t.id, "TMS", t.theatreManagementSystem],
      [t.id, "Ticketing System", t.ticketingSystem],
    ]).filter(([, , text]) => !!text);
    await client.query(
      `INSERT INTO theatre_systems (theatre_id, kind, device_id)
       SELECT v.theatre_id, v.kind, d.id
       FROM json_to_recordset($1) AS v(theatre_id text, kind text, text text)
       CROSS JOIN LATERAL (
         SELECT d.id FROM credential_devices d
         WHERE d.type = v.kind AND lower(v.text) LIKE lower(d.brand) || '%'
         ORDER BY lower(d.model) = lower(v.text) DESC, d.id LIMIT 1) d
       WHERE EXISTS (SELECT 1 FROM theatres t WHERE t.id = v.theatre_id)`,
      [JSON.stringify(rows.map(([theatre_id, kind, text]) => ({ theatre_id, kind, text })))],
    );
    await client.query(
      `INSERT INTO chain_tms (chain_id, device_id, updated_by)
       SELECT DISTINCT t.chain_id, s.device_id, 'System'
       FROM theatre_systems s JOIN theatres t ON t.id = s.theatre_id
       WHERE s.kind = 'TMS' AND t.chain_id IS NOT NULL
       ON CONFLICT DO NOTHING`,
    );
  },
};
