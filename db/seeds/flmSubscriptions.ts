import type { ExtraSeeder } from "./types";

/** Known chains' official FLM provider (flm_providers id), by chain name: lowercase, without accents. */
const CHAIN_PROVIDERS: Record<string, string> = {
  amc: "flm-cinergy",
  cinepolis: "flm-cinergy",
  regal: "flm-kdmx",
  pvr: "flm-qube-radar",
  mirage: "flm-qube-radar",
};

const normalize = (name: string) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/** The provider for a chain whose name is a key or starts with one as a word ("AMC Theatres" is AMC's). */
const providerFor = (name: string): string | undefined => {
  const n = normalize(name);
  return CHAIN_PROVIDERS[n] ?? CHAIN_PROVIDERS[n.split(/\s+/)[0]];
};

/**
 * Each known chain's official FLM provider, as migration 023 backfills it: at most one per chain, none for the
 * rest. The providers themselves are reference data from that migration.
 */
export const flmSubscriptionsSeeder: ExtraSeeder = {
  name: "flmSubscriptions",
  tables: ["chain_flm_subscriptions"],
  async run(client) {
    const { rows } = await client.query<{ id: string; name: string }>("SELECT id, name FROM chains");
    const links = rows.flatMap((c) => {
      const providerId = providerFor(c.name);
      return providerId ? [{ chain_id: c.id, provider_id: providerId }] : [];
    });
    await client.query(
      `INSERT INTO chain_flm_subscriptions (chain_id, provider_id, updated_by)
       SELECT v.chain_id, v.provider_id, 'System' FROM json_to_recordset($1) AS v(chain_id text, provider_id text)
       WHERE EXISTS (SELECT 1 FROM flm_providers p WHERE p.id = v.provider_id)
       ON CONFLICT DO NOTHING`,
      [JSON.stringify(links)],
    );
  },
};
