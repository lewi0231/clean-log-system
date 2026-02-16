-- Migration: Add job_colleagues_confirmed notification type
-- Triggered when all colleagues confirm participation and the job is approved
-- (distinct from job_auto_approved which is when the timeout triggers)

ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_type_check;
ALTER TABLE notification ADD CONSTRAINT notification_type_check CHECK (
  type IN (
    'worker_active',
    'job_completed',
    'invoice_generated',
    'payment_received',
    'review_submitted',
    'admin_activated',
    'worker_created',
    'job_confirmation_requested',
    'job_confirmation_reminder',
    'job_flagged',
    'job_withdrawn',
    'job_resolved_approved',
    'job_resolved_cancelled',
    'job_auto_approved',
    'job_colleagues_confirmed'
  )
);
