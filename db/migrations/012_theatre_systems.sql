-- A theatre's TMS and ticketing system come from the Credentials Manager (credential_devices of type TMS and
-- Ticketing System) instead of free text. A theatre may only use a TMS linked to its chain, so a wrong TMS
-- can't be mapped. Link tables rather than columns on theatres, so re-seeding the Credentials Manager
-- (TRUNCATE … CASCADE) clears only these links, never theatres.

CREATE TABLE chain_tms (
  chain_id   text NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
  device_id  text NOT NULL REFERENCES credential_devices(id) ON DELETE CASCADE,
  updated_by text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, device_id)
);

CREATE TABLE theatre_systems (
  theatre_id text NOT NULL REFERENCES theatres(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('TMS', 'Ticketing System')),
  device_id  text NOT NULL REFERENCES credential_devices(id) ON DELETE CASCADE,
  PRIMARY KEY (theatre_id, kind)
);

-- Match the free-text values to the masters: by brand, preferring an exact model name
INSERT INTO theatre_systems (theatre_id, kind, device_id)
SELECT t.id, v.kind, d.id
FROM theatres t
CROSS JOIN LATERAL (VALUES ('TMS', t.theatre_management_system), ('Ticketing System', t.ticketing_system)) v(kind, text)
CROSS JOIN LATERAL (
  SELECT d.id FROM credential_devices d
  WHERE d.type = v.kind AND lower(v.text) LIKE lower(d.brand) || '%'
  ORDER BY lower(d.model) = lower(v.text) DESC, d.id LIMIT 1) d
WHERE coalesce(v.text, '') <> '';

-- Theatres keep their TMS: link it to their chain
INSERT INTO chain_tms (chain_id, device_id, updated_by)
SELECT DISTINCT t.chain_id, s.device_id, 'System'
FROM theatre_systems s JOIN theatres t ON t.id = s.theatre_id
WHERE s.kind = 'TMS' AND t.chain_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- theatre_summary selects t.*, so it's rebuilt around the change
DROP VIEW theatre_summary;
ALTER TABLE theatres DROP COLUMN theatre_management_system, DROP COLUMN ticketing_system;
CREATE VIEW theatre_summary AS
SELECT t.*,
       c.name  AS chain_name,
       co.name AS company_name,
       (SELECT count(*) FROM screens s WHERE s.theatre_id = t.id AND s.status <> 'Deleted') AS screen_count
FROM theatres t
LEFT JOIN chains c     ON c.id = t.chain_id
LEFT JOIN companies co ON co.id = t.company_id;
