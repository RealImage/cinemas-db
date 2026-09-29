-- Screens: a number or a name (either may be left out); the number is a whole number; within a theatre no two
-- screens share a number or a name (ignoring case and surrounding spaces). Deleted screens don't count, so a
-- deleted screen's number can be given to a new screen. The uniqueness checks run at commit, so a theatre save
-- can swap two screens' numbers. Rules are shared with the app in src/data/screenRules.ts.

ALTER TABLE screens ALTER COLUMN name DROP NOT NULL;

UPDATE screens SET number = nullif(btrim(number), ''), name = nullif(btrim(name), '')
WHERE number IS DISTINCT FROM nullif(btrim(number), '') OR name IS DISTINCT FROM nullif(btrim(name), '');

ALTER TABLE screens
  ADD CONSTRAINT screens_number_or_name CHECK (btrim(coalesce(number, '')) <> '' OR btrim(coalesce(name, '')) <> ''),
  ADD CONSTRAINT screens_number_is_whole CHECK (number ~ '^(0|[1-9][0-9]*)$'),
  ADD CONSTRAINT screens_number_unique EXCLUDE USING btree (theatre_id WITH =, number WITH =)
    WHERE (status <> 'Deleted' AND number IS NOT NULL) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT screens_name_unique EXCLUDE USING btree (theatre_id WITH =, lower(btrim(name)) WITH =)
    WHERE (status <> 'Deleted' AND btrim(name) <> '') DEFERRABLE INITIALLY DEFERRED;
