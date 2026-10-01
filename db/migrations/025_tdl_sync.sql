-- TDL sync: the FTP site each device manufacturer shares its device certificates on, and a log of the sync runs (as
-- the legacy device_manufacturers table and the process_device_certificates / save_certificate jobs do: list the
-- certificate files under the root directory, fetch the new or changed ones, parse each certificate (zip and tar.gz
-- files hold several) and add or update the device it identifies; expired, SHA-1, non-leaf certificates and ones
-- whose model doesn't match the serial number are rejected).
--
-- Credentials (the legacy device_manufacturers username / password) are deliberately NOT stored here: they belong in
-- the Credentials Manager, which the sync job reads them from.
--
-- There is no manufacturers table, so sources are keyed on the manufacturer name used in tdl_devices.manufacturer.
CREATE TABLE IF NOT EXISTS tdl_sync_sources (
  manufacturer   text PRIMARY KEY,
  ftp_url        text NOT NULL DEFAULT '',
  root_dir       text NOT NULL DEFAULT '',
  enabled        boolean NOT NULL DEFAULT true,
  schedule       text NOT NULL DEFAULT '',
  last_synced_at timestamptz,
  last_status    text NOT NULL DEFAULT 'Never'
                 CHECK (last_status IN ('Success', 'Partial', 'Failed', 'Running', 'Never')),
  last_message   text,
  updated_by     text NOT NULL DEFAULT '',
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tdl_sync_runs (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  manufacturer         text NOT NULL REFERENCES tdl_sync_sources(manufacturer) ON DELETE CASCADE ON UPDATE CASCADE,
  started_at           timestamptz NOT NULL,
  finished_at          timestamptz,
  status               text NOT NULL CHECK (status IN ('Success', 'Partial', 'Failed', 'Running')),
  -- Certificate files on the FTP site to fetch (new or changed since the last sync, or all on a full sync).
  files_found          integer NOT NULL DEFAULT 0,
  -- Certificates read from those files, and what they did.
  certificates_parsed  integer NOT NULL DEFAULT 0,
  devices_added        integer NOT NULL DEFAULT 0,
  devices_updated      integer NOT NULL DEFAULT 0,
  -- Rejected certificates: expired, SHA-1, not a leaf certificate, unknown issuer, model / serial mismatch.
  invalid_certificates integer NOT NULL DEFAULT 0,
  -- Files that couldn't be fetched or extracted, or a failure of the whole run.
  errors               integer NOT NULL DEFAULT 0,
  message              text,
  -- 'Scheduler', or the name of the user who started it.
  triggered_by         text NOT NULL DEFAULT 'Scheduler'
);

CREATE INDEX IF NOT EXISTS tdl_sync_runs_manufacturer_started_idx ON tdl_sync_runs (manufacturer, started_at DESC);

-- One source per manufacturer in tdl_devices, as db/seeds/tdlSync.ts seeds them (illustrative hosts, not real vendor
-- FTP sites). JBL is disabled and has never synced.
INSERT INTO tdl_sync_sources (manufacturer, ftp_url, root_dir, enabled, schedule, updated_by) VALUES
  ('Barco', 'ftps://certs.barco.example/dcinema', '/certificates', true, 'Daily at 01:30 UTC', 'System'),
  ('Christie', 'ftps://ftp.christiedigital.example', '/Certificates/Series4', true, 'Daily at 02:00 UTC', 'System'),
  ('Dolby', 'ftps://certs.dolby.example/cinema', '/IMS3000/leaf', true, 'Every 12 hours (03:00, 15:00 UTC)', 'System'),
  ('GDC', 'ftp://ftp.gdc-tech.example', '/DeviceCerts/SR-1000', true, 'Daily at 04:00 UTC', 'System'),
  ('IMAX', 'ftps://certs.imax.example/dcinema', '/leaf-certificates', true, 'Daily at 05:00 UTC', 'System'),
  ('JBL', 'ftps://certs.jblpro.example/cinema', '/certificates', false, 'Daily at 05:30 UTC', 'System'),
  ('NEC', 'ftps://dcinema-certs.nec-display.example', '/NC-Series/certs', true, 'Daily at 06:00 UTC', 'System'),
  ('Panasonic', 'ftps://certs.panasonic-pro.example', '/projector/dcinema', true, 'Daily at 06:30 UTC', 'System'),
  ('QSC', 'ftps://certs.qsc.example', '/DCP-Series', true, 'Daily at 07:00 UTC', 'System'),
  ('Sony', 'ftps://ftp.sony-dcinema.example', '/SRX/certificates', true, 'Daily at 07:30 UTC', 'System')
ON CONFLICT DO NOTHING;

-- A small deterministic sample of past runs (relative to now) for manufacturers with none yet, so the Sync Status page
-- isn't empty on a migrated-only database. db/seeds/tdlSync.ts replaces them with a fuller history.
-- at_min: the schedule's time of day, in minutes after midnight UTC.
WITH cfg(manufacturer, every, runs, at_min) AS (
  VALUES ('Barco', interval '1 day', 10, 90),
         ('Christie', interval '1 day', 10, 120),
         ('Dolby', interval '12 hours', 16, 180),
         ('GDC', interval '1 day', 10, 240),
         ('IMAX', interval '1 day', 8, 300),
         ('NEC', interval '1 day', 10, 360),
         ('Panasonic', interval '1 day', 8, 390),
         ('QSC', interval '1 day', 8, 420),
         ('Sony', interval '1 day', 10, 450)
),
anchored AS (
  SELECT c.*, (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') + make_interval(mins => c.at_min) AS anchor
  FROM cfg c
),
latest AS (
  -- The most recent scheduled time at least 30 minutes before now, so the newest sample run (start jitter under a
  -- minute plus its duration) has finished by now
  SELECT a.*, a.anchor + a.every * floor(extract(epoch FROM now() - interval '30 minutes' - a.anchor)
                                         / extract(epoch FROM a.every)) AS last_at
  FROM anchored a
),
gen AS (
  SELECT c.manufacturer, i, abs(hashtext('tdl:' || c.manufacturer || ':' || i)) % 100 AS h,
         c.last_at - c.every * i + make_interval(secs => abs(hashtext('tdl:' || c.manufacturer || ':' || i)) % 50) AS started_at
  FROM latest c
  CROSS JOIN LATERAL generate_series(0, c.runs - 1) AS i
  WHERE EXISTS (SELECT 1 FROM tdl_sync_sources s WHERE s.manufacturer = c.manufacturer AND s.enabled)
    AND NOT EXISTS (SELECT 1 FROM tdl_sync_runs r WHERE r.manufacturer = c.manufacturer)
),
st AS (
  SELECT *,
         CASE WHEN manufacturer = 'Christie' AND i = 0 THEN 'Failed'
              WHEN manufacturer = 'NEC' AND i = 0 THEN 'Partial'
              WHEN h < 6 THEN 'Failed'
              WHEN h < 18 THEN 'Partial'
              ELSE 'Success' END AS status
  FROM gen
),
counts AS (
  SELECT *,
         CASE status WHEN 'Failed' THEN 0 WHEN 'Partial' THEN 8 + h % 25 ELSE (h * 7) % 30 END AS files,
         CASE status WHEN 'Partial' THEN 1 + h % 4 ELSE 0 END AS invalid,
         CASE status WHEN 'Failed' THEN 1 ELSE 0 END AS errs
  FROM st
),
parsed AS (
  -- A few files are zip / tar.gz archives holding more than one certificate.
  SELECT *, files + files / 5 AS certs, CASE WHEN files = 0 THEN 0 ELSE h % 4 END AS added FROM counts
)
INSERT INTO tdl_sync_runs (manufacturer, started_at, finished_at, status, files_found, certificates_parsed,
                           devices_added, devices_updated, invalid_certificates, errors, message, triggered_by)
SELECT manufacturer, started_at,
       started_at + make_interval(secs => CASE WHEN status = 'Failed' AND h % 3 = 1 THEN 60 ELSE 4 + files * 2 + h % 15 END),
       status, files, certs,
       least(added, greatest(certs - invalid, 0)),
       greatest(certs - invalid - added, 0),
       invalid, errs,
       CASE status
         WHEN 'Failed' THEN CASE h % 3
           WHEN 0 THEN '530 Login incorrect; check the manufacturer''s FTP credentials in Credentials Manager'
           WHEN 1 THEN 'Connection timed out after 60 s'
           ELSE '550 Directory not found' END
         WHEN 'Partial' THEN format('%s of %s certificates rejected: This certificate is already expired', invalid, certs)
         ELSE CASE WHEN files = 0 THEN 'No new or changed certificate files since the last sync'
                   ELSE format('Fetched %s new or changed %s; %s certificates parsed', files,
                               CASE WHEN files = 1 THEN 'file' ELSE 'files' END, certs) END
       END,
       'Scheduler'
FROM parsed;

-- Each source's last_* fields from its latest run (only sources that haven't recorded one yet).
UPDATE tdl_sync_sources s
SET last_synced_at = coalesce(r.finished_at, r.started_at), last_status = r.status, last_message = r.message
FROM (SELECT DISTINCT ON (manufacturer) * FROM tdl_sync_runs ORDER BY manufacturer, started_at DESC) r
WHERE r.manufacturer = s.manufacturer AND s.last_status = 'Never';
