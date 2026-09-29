-- Screen flags from legacy cinemadb that had no column yet: Automation, and IMAX Screen Integrated with its
-- integration type (WireTAP, TMS or both). The type is required when the screen is integrated, and only then.

ALTER TABLE screens
  ADD COLUMN automation            boolean NOT NULL DEFAULT false,
  ADD COLUMN imax_integrated       boolean NOT NULL DEFAULT false,
  ADD COLUMN imax_integration_type text CHECK (imax_integration_type IN ('WireTAP', 'TMS', 'Both')),
  ADD CONSTRAINT screens_imax_integration_type CHECK (imax_integrated = (imax_integration_type IS NOT NULL));
