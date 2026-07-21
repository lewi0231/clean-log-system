-- -*- mode: sql; sql-product: postgres -*-
-- Outbox for deferred / retried feedback request emails.
-- job_id ON DELETE CASCADE (intentional). Never CASCADE job → feedback (CSAT).
-- ROLLBACK: DROP TABLE IF EXISTS public.feedback_email_outbox;

CREATE TABLE IF NOT EXISTS public.feedback_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  send_after timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  email_id text,
  mode_at_send text,
  public_review_url_at_send text,
  is_resend boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  next_retry_at timestamptz
);

-- One pending row per job (stricter than invoice outbox).
CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_email_outbox_pending_job
  ON public.feedback_email_outbox (job_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_feedback_email_outbox_poller
  ON public.feedback_email_outbox (status, send_after, next_retry_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_feedback_email_outbox_job
  ON public.feedback_email_outbox (job_id);

COMMENT ON TABLE public.feedback_email_outbox IS
  'Outbox for feedback request emails. RLS enabled; service role only. Job delete cascades outbox rows.';

ALTER TABLE public.feedback_email_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage feedback_email_outbox"
  ON public.feedback_email_outbox;

CREATE POLICY "Service role can manage feedback_email_outbox"
  ON public.feedback_email_outbox
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
