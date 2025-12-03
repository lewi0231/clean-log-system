-- -*- mode: sql; sql-product: postgres -*-
-- Add feedback email setting to organization table

ALTER TABLE organization 
  ADD COLUMN IF NOT EXISTS feedback_email_send_immediately BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN organization.feedback_email_send_immediately IS 'If true, feedback request emails are sent immediately after a job is completed. If false, feedback requests require manual action.';

