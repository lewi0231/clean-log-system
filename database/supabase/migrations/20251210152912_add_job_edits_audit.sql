-- -*- mode: sql; sql-product: postgres -*-
-- Audit logging for job edits
-- Tracks all changes made to completed jobs for compliance and debugging

CREATE TABLE job_edits (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID REFERENCES job(id) ON DELETE CASCADE NOT NULL,
  edited_by_email TEXT NOT NULL,
  edited_by_user_id UUID,
  action TEXT NOT NULL CHECK (action IN ('UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_job_edits_job_id ON job_edits(job_id);
CREATE INDEX idx_job_edits_edited_by_email ON job_edits(edited_by_email);
CREATE INDEX idx_job_edits_changed_at ON job_edits(changed_at DESC);

-- Enable RLS
ALTER TABLE job_edits ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage job_edits
CREATE POLICY "Service role can manage job_edits"
ON job_edits FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comments for documentation
COMMENT ON TABLE job_edits IS 'Audit trail for all edits made to completed jobs. Tracks who made changes, when, and what changed.';
COMMENT ON COLUMN job_edits.edited_by_email IS 'Email of the admin user who made the edit';
COMMENT ON COLUMN job_edits.edited_by_user_id IS 'Optional: UUID of the auth user who made the edit';
COMMENT ON COLUMN job_edits.changed_fields IS 'Array of field names that were changed in this edit';
COMMENT ON COLUMN job_edits.old_data IS 'Snapshot of job data before the edit';
COMMENT ON COLUMN job_edits.new_data IS 'Snapshot of job data after the edit';

