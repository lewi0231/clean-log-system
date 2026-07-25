-- -*- mode: sql; sql-product: postgres -*-
-- Per-location mute for feedback request emails.
-- ROLLBACK: ALTER TABLE public.location DROP COLUMN IF EXISTS feedback_requests_enabled;

ALTER TABLE public.location
  ADD COLUMN IF NOT EXISTS feedback_requests_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.location.feedback_requests_enabled IS
  'When false, feedback request emails are muted for jobs at this location (org may still be enabled).';
