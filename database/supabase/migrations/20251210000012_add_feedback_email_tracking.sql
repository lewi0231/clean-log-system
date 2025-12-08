-- -*- mode: sql; sql-product: postgres -*-
-- Add feedback email tracking fields to job table
-- This enables automatic feedback request emails with secure token-based submission

-- Add feedback token column (unique, for secure public feedback submission)
ALTER TABLE job
  ADD COLUMN IF NOT EXISTS feedback_token TEXT UNIQUE;

-- Add feedback email tracking columns
ALTER TABLE job
  ADD COLUMN IF NOT EXISTS feedback_email_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS feedback_email_sent_at TIMESTAMPTZ;

-- Create index for token lookups (for public feedback page)
CREATE INDEX IF NOT EXISTS idx_job_feedback_token ON job(feedback_token);

-- Add comments for documentation
COMMENT ON COLUMN job.feedback_token IS 'Unique token for secure feedback submission via public URL. Generated when job is created if feedback_email_send_immediately is enabled.';
COMMENT ON COLUMN job.feedback_email_sent IS 'Whether feedback request email was sent for this job. Set to true after successful email send.';
COMMENT ON COLUMN job.feedback_email_sent_at IS 'Timestamp when feedback request email was sent. Used for tracking and analytics.';

