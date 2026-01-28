-- Add last_updated_at and last_updated_by to job for audit trail when admins edit jobs

ALTER TABLE job
ADD COLUMN last_updated_at TIMESTAMPTZ,
ADD COLUMN last_updated_by TEXT;

COMMENT ON COLUMN job.last_updated_at IS 'When the job was last edited (dashboard admin). NULL if never updated after creation.';
COMMENT ON COLUMN job.last_updated_by IS 'Email of the admin who last edited this job. NULL if never updated after creation.';
