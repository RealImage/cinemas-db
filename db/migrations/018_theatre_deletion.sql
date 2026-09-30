-- Theatre deletion (parity T-32): a theatre is deleted by request, with a reason. An approver approves the request,
-- which soft-deletes the theatre (status Deleted; it can still be restored). 48 hours after that it may be deleted
-- permanently, which removes the theatre with its screens, identifiers and change history.

-- Reasons for deleting a theatre, in the same master list as the screen reasons
ALTER TABLE status_reasons DROP CONSTRAINT status_reasons_reason_type_check;
ALTER TABLE status_reasons ADD CONSTRAINT status_reasons_reason_type_check
  CHECK (reason_type IN ('DEACTIVATE_SCREEN', 'DELETE_SCREEN', 'DELETE_THEATRE'));

-- Starter values, to be replaced by legacy's DELETE_THEATRE list.
INSERT INTO status_reasons (id, reason_type, reason, sort_order, updated_by) VALUES
  ('delete-theatre-closed',    'DELETE_THEATRE', 'Theatre permanently closed', 1,  'System'),
  ('delete-theatre-duplicate', 'DELETE_THEATRE', 'Duplicate theatre',          2,  'System'),
  ('delete-theatre-mistake',   'DELETE_THEATRE', 'Added by mistake',           3,  'System'),
  ('delete-theatre-other',     'DELETE_THEATRE', 'Other',                      99, 'System');

CREATE TABLE theatre_deletion_requests (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  theatre_id      text NOT NULL REFERENCES theatres(id) ON DELETE CASCADE,
  reason_id       text NOT NULL REFERENCES status_reasons(id),
  comments        text,
  -- Pending: waiting for an approver. Approved: the theatre is soft-deleted. Rejected / Restored: closed.
  status          text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Restored')),
  requested_by    text NOT NULL,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  reviewed_by     text,
  reviewed_at     timestamptz,
  review_comments text
);
-- At most one open request per theatre
CREATE UNIQUE INDEX theatre_deletion_requests_open_idx ON theatre_deletion_requests (theatre_id)
  WHERE status IN ('Pending', 'Approved');
CREATE INDEX theatre_deletion_requests_status_idx ON theatre_deletion_requests (status, requested_at DESC);

-- Soft delete: when and by whom, and the status to go back to on restore
ALTER TABLE theatres
  ADD COLUMN deleted_at           timestamptz,
  ADD COLUMN deleted_by           text,
  ADD COLUMN status_before_delete record_status;

UPDATE theatres SET deleted_at = updated_at, status_before_delete = 'Inactive' WHERE status = 'Deleted';
ALTER TABLE theatres ADD CONSTRAINT theatres_deleted_at CHECK ((status = 'Deleted') = (deleted_at IS NOT NULL));

-- Change history entries for the deletion workflow (the soft delete itself logs 'Deleted')
ALTER TABLE theatre_logs DROP CONSTRAINT theatre_logs_action_check;
ALTER TABLE theatre_logs ADD CONSTRAINT theatre_logs_action_check
  CHECK (action IN ('Created', 'Updated', 'Listed', 'Unlisted', 'Deleted',
                    'Deletion Requested', 'Deletion Rejected', 'Restored'));
