-- Agent configurations: the levels (Global, Chain, Theatre) an agent's configurations can be set at.
-- Every level was available until now, so existing agents keep all three. Rows at a level that's turned
-- off are kept, but hidden and not applied.
ALTER TABLE fleet_images
  ADD COLUMN config_levels text[] NOT NULL DEFAULT '{global,chain,theatre}'
    CHECK (cardinality(config_levels) > 0 AND config_levels <@ ARRAY['global', 'chain', 'theatre']);
