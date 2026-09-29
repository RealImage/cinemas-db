-- Screen fields from legacy cinemadb's Picture section: screen type, screen manufacturer, digital integrator,
-- 3D models, Datasat providers and advertising consolidators.
--
-- As in legacy, screen types and 3D models are lookup masters, while manufacturers, integrators, Datasat
-- providers and ad consolidators are industry companies with roles (legacy's QWC companies:
-- SCM screen manufacturer, DGI digital integrator, DSP Datasat provider, ADC advertising consolidator).
-- The rows below are starter values; legacy's lists live in its database and are meant to replace them.

CREATE TABLE screen_lookups (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  kind       text NOT NULL CHECK (kind IN ('SCREEN_TYPE', 'THREE_D_MODEL')),
  name       text NOT NULL CHECK (btrim(name) <> ''),
  updated_by text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, name)
);

CREATE TABLE industry_companies (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       text NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  roles      text[] NOT NULL DEFAULT '{}' CHECK (roles <@ ARRAY['SCM', 'DGI', 'DSP', 'ADC']),
  updated_by text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO screen_lookups (id, kind, name, updated_by) VALUES
  ('screen-type-matte-white', 'SCREEN_TYPE', 'Matte White', 'System'),
  ('screen-type-silver',      'SCREEN_TYPE', 'Silver',      'System'),
  ('screen-type-pearl',       'SCREEN_TYPE', 'Pearl',       'System'),
  ('screen-type-perforated',  'SCREEN_TYPE', 'Perforated',  'System'),
  ('3d-reald',        'THREE_D_MODEL', 'RealD',        'System'),
  ('3d-dolby',        'THREE_D_MODEL', 'Dolby 3D',     'System'),
  ('3d-masterimage',  'THREE_D_MODEL', 'MasterImage',  'System'),
  ('3d-xpand',        'THREE_D_MODEL', 'XpanD',        'System'),
  ('3d-volfoni',      'THREE_D_MODEL', 'Volfoni',      'System'),
  ('3d-imax',         'THREE_D_MODEL', 'IMAX 3D',      'System');

INSERT INTO industry_companies (id, name, roles, updated_by) VALUES
  ('co-harkness',     'Harkness Screens',             ARRAY['SCM'], 'System'),
  ('co-stewart',      'Stewart Filmscreen',           ARRAY['SCM'], 'System'),
  ('co-mdi',          'MDI Screen Systems',           ARRAY['SCM'], 'System'),
  ('co-qube',         'Qube Cinema',                  ARRAY['DGI'], 'System'),
  ('co-ballantyne',   'Ballantyne Strong',            ARRAY['DGI'], 'System'),
  ('co-datasat',      'Datasat Digital Entertainment', ARRAY['DSP'], 'System'),
  ('co-ncm',          'National CineMedia',           ARRAY['ADC'], 'System'),
  ('co-screenvision', 'Screenvision Media',           ARRAY['ADC'], 'System'),
  ('co-pearl-dean',   'Pearl & Dean',                 ARRAY['ADC'], 'System');

-- Single choices are foreign keys; multiple choices are id lists, checked by the API (arrays can't carry keys)
ALTER TABLE screens
  ADD COLUMN screen_type_id            text REFERENCES screen_lookups(id),
  ADD COLUMN screen_manufacturer_id    text REFERENCES industry_companies(id),
  ADD COLUMN digital_integrator_id     text REFERENCES industry_companies(id),
  ADD COLUMN three_d_model_ids         text[] NOT NULL DEFAULT '{}',
  ADD COLUMN datasat_provider_ids      text[] NOT NULL DEFAULT '{}',
  ADD COLUMN ad_consolidator_ids       text[] NOT NULL DEFAULT '{}';
