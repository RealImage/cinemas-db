-- Screen status reasons: deactivating or deleting a screen needs a reason from a master list (like legacy's
-- DEACTIVATE_SCREEN / DELETE_SCREEN deletion reasons), plus optional comments. The reasons below are starter
-- values; the lists are meant to become an editable master.

CREATE TABLE status_reasons (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  reason_type text NOT NULL CHECK (reason_type IN ('DEACTIVATE_SCREEN', 'DELETE_SCREEN')),
  reason      text NOT NULL CHECK (btrim(reason) <> ''),
  sort_order  integer NOT NULL DEFAULT 0,
  updated_by  text NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reason_type, reason)
);

INSERT INTO status_reasons (id, reason_type, reason, sort_order, updated_by) VALUES
  ('deactivate-renovation', 'DEACTIVATE_SCREEN', 'Under renovation',                1, 'System'),
  ('deactivate-equipment',  'DEACTIVATE_SCREEN', 'Equipment fault or under repair', 2, 'System'),
  ('deactivate-seasonal',   'DEACTIVATE_SCREEN', 'Seasonal closure',                3, 'System'),
  ('deactivate-other',      'DEACTIVATE_SCREEN', 'Other',                           99, 'System'),
  ('delete-closed',         'DELETE_SCREEN',     'Screen permanently closed',       1, 'System'),
  ('delete-duplicate',      'DELETE_SCREEN',     'Duplicate screen',                2, 'System'),
  ('delete-mistake',        'DELETE_SCREEN',     'Added by mistake',                3, 'System'),
  ('delete-other',          'DELETE_SCREEN',     'Other',                           99, 'System');

ALTER TABLE screens
  ADD COLUMN status_reason_id text REFERENCES status_reasons(id),
  ADD COLUMN status_comments  text,
  ADD CONSTRAINT screens_status_reason CHECK ((status = 'Active') = (status_reason_id IS NULL));
