-- A chain's approved POS / ticketing systems, like its TMSes (chain_tms, 012): a theatre's ticketing system can
-- only be one of its chain's. Theatres keep theirs: each one in use is linked to the theatre's chain.
CREATE TABLE chain_ticketing_systems (
  chain_id   text NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
  device_id  text NOT NULL REFERENCES credential_devices(id) ON DELETE CASCADE,
  updated_by text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, device_id)
);

INSERT INTO chain_ticketing_systems (chain_id, device_id, updated_by)
SELECT DISTINCT t.chain_id, s.device_id, 'System'
FROM theatre_systems s JOIN theatres t ON t.id = s.theatre_id
WHERE s.kind = 'Ticketing System' AND t.chain_id IS NOT NULL
ON CONFLICT DO NOTHING;
