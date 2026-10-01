-- FLM providers (the feeds' flm_feeds.source values) and a chain's official FLM provider: usually one or none, but
-- the schema allows several.
CREATE TABLE IF NOT EXISTS flm_providers (
  id         text PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO flm_providers (id, name) VALUES
  ('flm-maccs', 'MACCS'),
  ('flm-dcip', 'DCIP'),
  ('flm-qube-radar', 'Qube Radar'),
  ('flm-cinergy', 'Cinergy'),
  ('flm-sony', 'Sony'),
  ('flm-kdmx', 'KDMx')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS chain_flm_subscriptions (
  chain_id    text NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
  provider_id text NOT NULL REFERENCES flm_providers(id) ON DELETE CASCADE,
  updated_by  text NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, provider_id)
);

-- Known chains' providers, as db/seeds/flmSubscriptions.ts seeds them: a chain whose name (ignoring case and
-- accents) is the key or starts with it as a word. Only chains with no subscription yet.
INSERT INTO chain_flm_subscriptions (chain_id, provider_id, updated_by)
SELECT c.id, m.provider_id, 'System'
FROM chains c
JOIN (VALUES ('amc', 'flm-cinergy'), ('cinepolis', 'flm-cinergy'), ('regal', 'flm-kdmx'),
             ('pvr', 'flm-qube-radar'), ('mirage', 'flm-qube-radar')) AS m(chain_key, provider_id)
  ON translate(lower(c.name), 'áàâäãéèêëíìîïóòôöõúùûüñç', 'aaaaaeeeeiiiiooooouuuunc') = m.chain_key
  OR translate(lower(c.name), 'áàâäãéèêëíìîïóòôöõúùûüñç', 'aaaaaeeeeiiiiooooouuuunc') LIKE m.chain_key || ' %'
WHERE NOT EXISTS (SELECT 1 FROM chain_flm_subscriptions s WHERE s.chain_id = c.id)
ON CONFLICT DO NOTHING;
