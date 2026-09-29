-- Theatre listing: Listed - Public, Listed - Private or Unlisted (was Listed / Private).
ALTER TABLE theatres DROP CONSTRAINT IF EXISTS theatres_listing_check;
UPDATE theatres SET listing = CASE listing WHEN 'Listed' THEN 'Listed - Public' WHEN 'Private' THEN 'Listed - Private' ELSE listing END;
ALTER TABLE theatres ADD CONSTRAINT theatres_listing_check
  CHECK (listing IN ('Listed - Public', 'Listed - Private', 'Unlisted'));
