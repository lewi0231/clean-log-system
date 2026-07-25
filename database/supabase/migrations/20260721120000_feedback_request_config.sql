-- -*- mode: sql; sql-product: postgres -*-
-- Configurable feedback requests: organization columns + legacy auto-send backfill.
-- Phase 1 of feedback_email_send_immediately → feedback_auto_send cutover.
-- ROLLBACK: DROP new columns; restore callers to feedback_email_send_immediately (see M5 inverse).

ALTER TABLE public.organization
  ADD COLUMN IF NOT EXISTS feedback_requests_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS feedback_auto_send BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feedback_request_mode TEXT NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS public_review_url TEXT,
  ADD COLUMN IF NOT EXISTS feedback_email_subject TEXT,
  ADD COLUMN IF NOT EXISTS feedback_email_body TEXT,
  ADD COLUMN IF NOT EXISTS feedback_email_reply_to TEXT,
  ADD COLUMN IF NOT EXISTS feedback_send_delay_hours INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_feedback_request_mode_check'
  ) THEN
    ALTER TABLE public.organization
      ADD CONSTRAINT organization_feedback_request_mode_check
      CHECK (feedback_request_mode IN ('internal', 'public', 'both'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_feedback_send_delay_hours_check'
  ) THEN
    ALTER TABLE public.organization
      ADD CONSTRAINT organization_feedback_send_delay_hours_check
      CHECK (feedback_send_delay_hours >= 0 AND feedback_send_delay_hours <= 168);
  END IF;
END $$;

-- Preserve existing auto-send behaviour for orgs that already opted in.
UPDATE public.organization
SET feedback_auto_send = true
WHERE feedback_email_send_immediately = true
  AND feedback_auto_send = false;

COMMENT ON COLUMN public.organization.feedback_requests_enabled IS
  'Master kill switch for feedback request emails (auto + manual).';
COMMENT ON COLUMN public.organization.feedback_auto_send IS
  'If true (and feedback_requests_enabled), enqueue/send feedback requests after job completion. Replaces feedback_email_send_immediately.';
COMMENT ON COLUMN public.organization.feedback_request_mode IS
  'internal | public | both — which review destination(s) customers are offered.';
COMMENT ON COLUMN public.organization.public_review_url IS
  'HTTPS public review URL (e.g. Google). Required when mode is public or both.';
COMMENT ON COLUMN public.organization.feedback_email_subject IS
  'Optional plain-text subject template; null uses product default.';
COMMENT ON COLUMN public.organization.feedback_email_body IS
  'Optional plain-text body template; null uses product default. Never interpreted as HTML.';
COMMENT ON COLUMN public.organization.feedback_email_reply_to IS
  'Optional Reply-To address for feedback request emails.';
COMMENT ON COLUMN public.organization.feedback_send_delay_hours IS
  'Hours after completed_at before send_after (0–168). Still gated by edit_window_expires_at.';
