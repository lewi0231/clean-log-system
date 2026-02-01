-- -*- mode: sql; sql-product: postgres -*-
-- Allow admin_activated and worker_created notification types (used by accept-admin-invitation and convert-admin-to-worker).

ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_type_check;
ALTER TABLE notification ADD CONSTRAINT notification_type_check CHECK (type IN (
  'worker_active',
  'job_completed',
  'invoice_generated',
  'payment_received',
  'review_submitted',
  'admin_activated',
  'worker_created'
));
