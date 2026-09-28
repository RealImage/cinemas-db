-- Locations: the geographic master data theatres reference. Country → Province
-- → City is a strict tree; a city has one timezone and optionally one metro
-- area. Records are never hard-deleted: deactivating sets is_deleted.
-- geoname_id / the IANA name link records to the reference feeds that
-- Reference sync compares against (server/locations/sync.ts).

CREATE TABLE timezones (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  -- IANA ID, e.g. Asia/Kolkata. Offsets are derived from it, never stored.
  name          text NOT NULL UNIQUE,
  display_name  text,
  is_active     boolean NOT NULL DEFAULT true,
  updated_by    text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE countries (
  id                               text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name                             text NOT NULL,
  iso3166_2                        text NOT NULL CHECK (iso3166_2 ~ '^[A-Z]{2}$'),
  iso3166_3                        text NOT NULL CHECK (iso3166_3 ~ '^[A-Z]{3}$'),
  -- Digits only; shown as +<code>
  calling_code                     text CHECK (calling_code ~ '^[0-9]{1,4}$'),
  -- ISO 4217
  currency_code                    text CHECK (currency_code ~ '^[A-Z]{3}$'),
  alternate_name                   text,
  local_language_name              text,
  translations                     text[] NOT NULL DEFAULT '{}',
  last_regional_modification_date  date,
  geoname_id                       integer,
  is_deleted                       boolean NOT NULL DEFAULT false,
  updated_by                       text NOT NULL DEFAULT '',
  created_at                       timestamptz NOT NULL DEFAULT now(),
  updated_at                       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX countries_iso2_key ON countries (iso3166_2) WHERE NOT is_deleted;
CREATE UNIQUE INDEX countries_iso3_key ON countries (iso3166_3) WHERE NOT is_deleted;
CREATE UNIQUE INDEX countries_name_key ON countries (lower(name)) WHERE NOT is_deleted;

CREATE TABLE country_timezones (
  country_id   text NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  timezone_id  text NOT NULL REFERENCES timezones(id) ON DELETE CASCADE,
  PRIMARY KEY (country_id, timezone_id)
);

CREATE TABLE provinces (
  id                               text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  country_id                       text NOT NULL REFERENCES countries(id),
  name                             text NOT NULL,
  -- ISO 3166-2, e.g. IN-HR; must start with the country's alpha-2 code
  iso_code                         text NOT NULL,
  code                             text,
  alternate_name                   text,
  local_language_name              text,
  translations                     text[] NOT NULL DEFAULT '{}',
  last_regional_modification_date  date,
  geoname_id                       integer,
  -- GeoNames admin1 key, e.g. IN.10 (not ISO)
  geoname_key                      text,
  is_deleted                       boolean NOT NULL DEFAULT false,
  updated_by                       text NOT NULL DEFAULT '',
  created_at                       timestamptz NOT NULL DEFAULT now(),
  updated_at                       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX provinces_country_idx ON provinces (country_id);
CREATE UNIQUE INDEX provinces_name_key ON provinces (country_id, lower(name)) WHERE NOT is_deleted;

CREATE TABLE metro_areas (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        text NOT NULL,
  is_deleted  boolean NOT NULL DEFAULT false,
  updated_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX metro_areas_name_key ON metro_areas (lower(name)) WHERE NOT is_deleted;

CREATE TABLE cities (
  id                               text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  province_id                      text NOT NULL REFERENCES provinces(id),
  timezone_id                      text NOT NULL REFERENCES timezones(id),
  metro_area_id                    text REFERENCES metro_areas(id) ON DELETE SET NULL,
  name                             text NOT NULL,
  -- <province ISO code>-<5 letters>, e.g. IN-TN-CENAI
  code                             text,
  alternate_name                   text,
  local_language_name              text,
  translations                     text[] NOT NULL DEFAULT '{}',
  last_regional_modification_date  date,
  latitude                         double precision,
  longitude                        double precision,
  population                       integer,
  geoname_id                       integer,
  is_deleted                       boolean NOT NULL DEFAULT false,
  updated_by                       text NOT NULL DEFAULT '',
  created_at                       timestamptz NOT NULL DEFAULT now(),
  updated_at                       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cities_province_idx ON cities (province_id);
CREATE INDEX cities_timezone_idx ON cities (timezone_id);
CREATE INDEX cities_metro_area_idx ON cities (metro_area_id);
CREATE INDEX cities_geoname_idx ON cities (geoname_id);
CREATE INDEX cities_name_idx ON cities (lower(name));
CREATE UNIQUE INDEX cities_name_key ON cities (province_id, lower(name)) WHERE NOT is_deleted;

CREATE TABLE timezone_popular_cities (
  timezone_id  text NOT NULL REFERENCES timezones(id) ON DELETE CASCADE,
  city_id      text NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  position     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (timezone_id, city_id)
);

-- Per-record audit log: full before/after snapshots of every stored field.
CREATE TABLE location_logs (
  id          bigserial PRIMARY KEY,
  entity      text NOT NULL CHECK (entity IN ('countries', 'provinces', 'cities', 'metro_areas', 'timezones')),
  -- NULL for a decision about a reference record CinemaDB doesn't have (Ignore on a New item)
  record_id   text,
  -- CREATE, UPDATE, DEACTIVATE, RESTORE, LINK, IGNORE
  action      text NOT NULL,
  updated_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  current     jsonb,
  previous    jsonb,
  -- Set when the change came from a Review decision: 'geonames' or 'iana', and that source's ID
  source      text,
  source_ref  text
);
CREATE INDEX location_logs_record_idx ON location_logs (entity, record_id, created_at DESC);

-- Theatres reference a city; country and province follow from it. The text
-- columns stay, kept in sync from the city, for display and older readers.
ALTER TABLE theatres ADD COLUMN city_id text REFERENCES cities(id) ON DELETE SET NULL;
CREATE INDEX theatres_city_idx ON theatres (city_id);

-- ---------------------------------------------------------------------------
-- Reference sync and gap review
-- ---------------------------------------------------------------------------

CREATE TABLE location_sync_settings (
  id                    boolean PRIMARY KEY DEFAULT true CHECK (id),
  -- Countries whose New cities are flagged; NULL means countries that have theatres
  tracked_country_ids   text[],
  population_threshold  integer NOT NULL DEFAULT 5000 CHECK (population_threshold >= 0),
  nightly_enabled       boolean NOT NULL DEFAULT true,
  updated_by            text NOT NULL DEFAULT '',
  updated_at            timestamptz NOT NULL DEFAULT now()
);
INSERT INTO location_sync_settings DEFAULT VALUES;

CREATE TABLE location_sync_runs (
  id           bigserial PRIMARY KEY,
  trigger      text NOT NULL CHECK (trigger IN ('nightly', 'manual')),
  status       text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  error        text,
  -- {"sources": {...versions}, "linked": n, "opened": n, "reopened": n, "closed": n}
  summary      jsonb NOT NULL DEFAULT '{}',
  started_by   text NOT NULL DEFAULT ''
);
-- At most one run at a time
CREATE UNIQUE INDEX location_sync_runs_running_key ON location_sync_runs ((true)) WHERE status = 'running';

CREATE TABLE location_review_items (
  id             bigserial PRIMARY KEY,
  entity         text NOT NULL CHECK (entity IN ('countries', 'provinces', 'cities', 'timezones')),
  flag           text NOT NULL CHECK (flag IN ('new', 'missing', 'mismatch', 'duplicate')),
  -- The CinemaDB record (NULL for New)
  record_id      text,
  source         text NOT NULL CHECK (source IN ('geonames', 'iana')),
  -- The reference record's ID (geonameid, admin1 key or IANA name); '' when there is none
  source_ref     text NOT NULL DEFAULT '',
  -- Identity of the finding, so re-runs update rather than duplicate it
  item_key       text NOT NULL UNIQUE,
  -- Hash of the reference and CinemaDB values; an Ignored item reopens when it changes
  fingerprint    text NOT NULL,
  reference      jsonb,
  local          jsonb,
  -- Human-readable differences, [{field, local, reference}]
  differences    jsonb NOT NULL DEFAULT '[]',
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  -- added, linked, fixed, deactivated, ignored, or cleared (no longer detected)
  resolution     text,
  resolved_by    text,
  resolved_at    timestamptz,
  first_seen_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_run_id    bigint REFERENCES location_sync_runs(id) ON DELETE SET NULL
);
CREATE INDEX location_review_items_open_idx ON location_review_items (entity, flag) WHERE status = 'open';
CREATE INDEX location_review_items_record_idx ON location_review_items (entity, record_id) WHERE status = 'open';
