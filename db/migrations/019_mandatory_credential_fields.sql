-- Credentials format fields get a Mandatory flag: a credential can't be saved
-- without a value for a mandatory field. Every field was required until now,
-- so existing fields are mandatory.
UPDATE credential_devices d
SET credential_fields = (
  SELECT coalesce(jsonb_agg(
           f || jsonb_build_object('mandatory', coalesce((f->>'mandatory')::boolean, true))
           ORDER BY ord), '[]'::jsonb)
  FROM jsonb_array_elements(d.credential_fields) WITH ORDINALITY AS e(f, ord)
)
WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(d.credential_fields) f WHERE NOT f ? 'mandatory');
