-- Chain details edited on the Edit Chain page (Basic and Contact Information), and a per-chain change history
-- like theatre_logs. Existing chains keep NULL / empty values until edited.

ALTER TABLE chains
  ADD COLUMN display_name         text,
  -- Head office city; province and country follow from it. Required by the form, NULL for older rows.
  ADD COLUMN city_id              text REFERENCES cities(id) ON DELETE SET NULL,
  ADD COLUMN postal_code          text,
  ADD COLUMN area                 text,
  ADD COLUMN head_office_address  text,
  ADD COLUMN emails               text[] NOT NULL DEFAULT '{}',
  -- [{countryCode, number}]; countryCode is a countries.calling_code (digits, shown as +code)
  ADD COLUMN phones               jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(phones) = 'array'),
  -- [{name, countryCode, phone}]
  ADD COLUMN owners               jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(owners) = 'array');
CREATE INDEX chains_city_idx ON chains (city_id);

CREATE TABLE chain_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chain_id    text NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
  logged_at   timestamptz NOT NULL DEFAULT now(),
  section     text NOT NULL CHECK (section IN ('Basic Information', 'Contact Information', 'Theatre Systems')),
  action      text NOT NULL CHECK (action IN ('Created', 'Updated', 'Deleted')),
  -- The form field that changed, e.g. "Chain Name"
  field       text,
  old_value   text,
  new_value   text,
  updated_by  text NOT NULL
);
CREATE INDEX chain_logs_chain_idx ON chain_logs (chain_id, logged_at DESC);
