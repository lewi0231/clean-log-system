-- -*- mode: sql; sql-product: postgres -*-
-- Send-time snapshots so /review and audit survive later Settings edits.
-- ROLLBACK: ALTER TABLE public.job DROP COLUMN IF EXISTS feedback_mode_at_send, DROP COLUMN IF EXISTS public_review_url_at_send;

ALTER TABLE public.job
  ADD COLUMN IF NOT EXISTS feedback_mode_at_send TEXT,
  ADD COLUMN IF NOT EXISTS public_review_url_at_send TEXT;

COMMENT ON COLUMN public.job.feedback_mode_at_send IS
  'Snapshot of feedback_request_mode at successful send (internal|public|both).';
COMMENT ON COLUMN public.job.public_review_url_at_send IS
  'Snapshot of public_review_url at successful send for public/both modes.';
