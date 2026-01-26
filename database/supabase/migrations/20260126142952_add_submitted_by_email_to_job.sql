-- Add submitted_by_email to track who created/submitted the job
-- This provides an audit trail for jobs created via the dashboard

ALTER TABLE job
ADD COLUMN submitted_by_email TEXT;

COMMENT ON COLUMN job.submitted_by_email IS 'Email of the admin user who created/submitted this job via the dashboard. NULL for jobs created via mobile app.';
