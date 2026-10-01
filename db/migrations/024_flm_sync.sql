-- FLM sync: where each provider's facility list is fetched from, and a log of the sync runs (as the legacy
-- process_all_integrators / process_integrator jobs do: fetch the FLM list, queue the facilities modified since the
-- last sync, record when it was synced).
--
-- Credentials (the legacy flm_sync_data username / password) are deliberately NOT stored here: they belong in the
-- Credentials Manager, which the sync job reads them from.
CREATE TABLE IF NOT EXISTS flm_sync_sources (
  provider_id    text PRIMARY KEY REFERENCES flm_providers(id) ON DELETE CASCADE,
  sync_url       text NOT NULL DEFAULT '',
  enabled        boolean NOT NULL DEFAULT true,
  schedule       text NOT NULL DEFAULT '',
  last_synced_at timestamptz,
  last_status    text NOT NULL DEFAULT 'Never'
                 CHECK (last_status IN ('Success', 'Partial', 'Failed', 'Running', 'Never')),
  last_message   text,
  updated_by     text NOT NULL DEFAULT '',
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flm_sync_runs (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_id       text NOT NULL REFERENCES flm_providers(id) ON DELETE CASCADE,
  started_at        timestamptz NOT NULL,
  finished_at       timestamptz,
  status            text NOT NULL CHECK (status IN ('Success', 'Partial', 'Failed', 'Running')),
  -- Facilities in the FLM list to process (modified in the last 2 days, or all on a full sync), and their outcome.
  theatres_received integer NOT NULL DEFAULT 0,
  theatres_updated  integer NOT NULL DEFAULT 0,
  theatres_new      integer NOT NULL DEFAULT 0,
  errors            integer NOT NULL DEFAULT 0,
  message           text,
  -- 'Scheduler', or the name of the user who started it.
  triggered_by      text NOT NULL DEFAULT 'Scheduler'
);

CREATE INDEX IF NOT EXISTS flm_sync_runs_provider_started_idx ON flm_sync_runs (provider_id, started_at DESC);

-- One source per provider, as db/seeds/flmSync.ts seeds them (illustrative hosts, not real vendor endpoints).
-- Sony is disabled and has never synced.
INSERT INTO flm_sync_sources (provider_id, sync_url, enabled, schedule, updated_by) VALUES
  ('flm-maccs', 'https://flm.maccs.example/api/v1/facilities', true, 'Daily at 02:00 UTC', 'System'),
  ('flm-dcip', 'https://flm.dcip.example/flmx/v1/facility-list.xml', true, 'Daily at 04:30 UTC', 'System'),
  ('flm-qube-radar', 'https://radar.qube.example/api/v2/flm/facility-list?format=flmx&region=all&include=screens,devices', true, 'Every 12 hours (00:15, 12:15 UTC)', 'System'),
  ('flm-cinergy', 'https://flm.cinergy.example/api/v1/facilities', true, 'Daily at 06:00 UTC', 'System'),
  ('flm-sony', 'https://flm.sony.example/api/v1/facilities', false, 'Daily at 03:00 UTC', 'System'),
  ('flm-kdmx', 'https://flm.kdmx.example/v1/flm/sitelist', true, 'Daily at 01:00 UTC', 'System')
ON CONFLICT DO NOTHING;

-- A small deterministic sample of past runs (relative to now) for providers with none yet, so the Sync Status page
-- isn't empty on a migrated-only database. db/seeds/flmSync.ts replaces them with a fuller history.
-- at_min: the schedule's time of day, in minutes after midnight UTC.
WITH cfg(provider_id, every, runs, at_min) AS (
  VALUES ('flm-maccs', interval '1 day', 14, 120),
         ('flm-dcip', interval '1 day', 14, 270),
         ('flm-qube-radar', interval '12 hours', 20, 15),
         ('flm-cinergy', interval '1 day', 14, 360),
         ('flm-kdmx', interval '1 day', 12, 60)
),
anchored AS (
  SELECT c.*, (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') + make_interval(mins => c.at_min) AS anchor
  FROM cfg c
),
latest AS (
  -- The most recent scheduled time at least 10 minutes before now, so the newest sample run (start jitter under a
  -- minute, duration under 4 minutes) has finished by now
  SELECT a.*, a.anchor + a.every * floor(extract(epoch FROM now() - interval '10 minutes' - a.anchor)
                                         / extract(epoch FROM a.every)) AS last_at
  FROM anchored a
),
gen AS (
  SELECT c.provider_id, i, abs(hashtext(c.provider_id || ':' || i)) % 100 AS h,
         c.last_at - c.every * i + make_interval(secs => abs(hashtext(c.provider_id || ':' || i)) % 50) AS started_at
  FROM latest c
  CROSS JOIN LATERAL generate_series(0, c.runs - 1) AS i
  WHERE EXISTS (SELECT 1 FROM flm_sync_sources s WHERE s.provider_id = c.provider_id AND s.enabled)
    AND NOT EXISTS (SELECT 1 FROM flm_sync_runs r WHERE r.provider_id = c.provider_id)
),
st AS (
  SELECT *,
         CASE WHEN provider_id = 'flm-dcip' AND i = 0 THEN 'Failed'
              WHEN provider_id = 'flm-kdmx' AND i = 0 THEN 'Partial'
              WHEN h < 7 THEN 'Failed'
              WHEN h < 18 THEN 'Partial'
              ELSE 'Success' END AS status
  FROM gen
),
counts AS (
  SELECT *,
         CASE status WHEN 'Failed' THEN 0 WHEN 'Partial' THEN 20 + h % 30 ELSE (h * 7) % 45 END AS received,
         CASE status WHEN 'Failed' THEN 1 WHEN 'Partial' THEN 1 + h % 4 ELSE 0 END AS errs,
         CASE WHEN status = 'Failed' THEN 0 ELSE h % 3 END AS new_count
  FROM st
)
INSERT INTO flm_sync_runs (provider_id, started_at, finished_at, status, theatres_received, theatres_updated,
                           theatres_new, errors, message, triggered_by)
SELECT provider_id, started_at,
       started_at + make_interval(secs => CASE WHEN status = 'Failed' AND h % 3 = 1 THEN 120 ELSE 8 + received * 3 + h % 20 END),
       status, received,
       greatest(received - errs * (status = 'Partial')::int - least(new_count, received), 0),
       least(new_count, received),
       errs,
       CASE status
         WHEN 'Failed' THEN CASE h % 3
           WHEN 0 THEN 'HTTP 401 Unauthorized fetching the FLM list; check the provider''s credentials in Credentials Manager'
           WHEN 1 THEN 'Timed out after 120 s waiting for the FLM list'
           ELSE 'Could not parse the FLM list XML: unexpected end of document' END
         WHEN 'Partial' THEN format('%s of %s facility records failed to process (facility XML returned HTTP 404)', errs, received)
         ELSE CASE WHEN received = 0 THEN 'FLM list unchanged since the last sync; nothing to process'
                   ELSE format('Processed %s %s modified in the last 2 days', received, CASE WHEN received = 1 THEN 'facility' ELSE 'facilities' END) END
       END,
       'Scheduler'
FROM counts;

-- Each source's last_* fields from its latest run (only sources that haven't recorded one yet).
UPDATE flm_sync_sources s
SET last_synced_at = coalesce(r.finished_at, r.started_at), last_status = r.status, last_message = r.message
FROM (SELECT DISTINCT ON (provider_id) * FROM flm_sync_runs ORDER BY provider_id, started_at DESC) r
WHERE r.provider_id = s.provider_id AND s.last_status = 'Never';
