-- Migration: Job Colleague Confirmation Workflow
-- User Story: 008-job-colleague-confirmation-workflow.md
-- 
-- This migration adds support for colleague confirmation workflow:
-- 1. Job approval_status tracking (pending, approved, flagged, cancelled)
-- 2. Per-worker confirmation status on job_worker
-- 3. Organization setting for auto-approve timeout
-- 4. New notification types for the workflow

-- ============================================================================
-- PART 1: Job Table Changes
-- ============================================================================

-- Add approval_status column with default 'approved' for backward compatibility
ALTER TABLE job ADD COLUMN IF NOT EXISTS approval_status TEXT 
  DEFAULT 'approved';

-- Add check constraint for approval_status values
DO $$ BEGIN
  ALTER TABLE job ADD CONSTRAINT job_approval_status_check 
    CHECK (approval_status IN ('approved', 'pending', 'flagged', 'cancelled'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add auto_approve_at timestamp (when job will auto-approve if no action)
ALTER TABLE job ADD COLUMN IF NOT EXISTS auto_approve_at TIMESTAMPTZ;

-- Add edit_window_expires_at timestamp (when submitter can no longer withdraw)
ALTER TABLE job ADD COLUMN IF NOT EXISTS edit_window_expires_at TIMESTAMPTZ;

-- Add submitted_by_worker_id to track which worker submitted the job
ALTER TABLE job ADD COLUMN IF NOT EXISTS submitted_by_worker_id UUID REFERENCES worker(id) ON DELETE SET NULL;

-- Index for finding pending/flagged jobs by organization
CREATE INDEX IF NOT EXISTS idx_job_approval_status 
  ON job(organization_id, approval_status) 
  WHERE approval_status IN ('pending', 'flagged');

-- Index for auto-approve scheduled function
CREATE INDEX IF NOT EXISTS idx_job_auto_approve 
  ON job(auto_approve_at) 
  WHERE approval_status = 'pending' AND auto_approve_at IS NOT NULL;

-- Comments
COMMENT ON COLUMN job.approval_status IS 'Job approval workflow status: approved (finalized), pending (awaiting colleague confirmation), flagged (needs admin review), cancelled';
COMMENT ON COLUMN job.auto_approve_at IS 'Timestamp when job will be auto-approved if no action taken by colleagues';
COMMENT ON COLUMN job.edit_window_expires_at IS 'Timestamp after which the submitting worker can no longer withdraw the job';
COMMENT ON COLUMN job.submitted_by_worker_id IS 'The worker who submitted this job (for colleague confirmation workflow)';

-- ============================================================================
-- PART 2: Job Worker Table Changes
-- ============================================================================

-- Add confirmation_status column with default 'confirmed' for backward compatibility
ALTER TABLE job_worker ADD COLUMN IF NOT EXISTS confirmation_status TEXT 
  DEFAULT 'confirmed';

-- Add check constraint for confirmation_status values
DO $$ BEGIN
  ALTER TABLE job_worker ADD CONSTRAINT job_worker_confirmation_status_check 
    CHECK (confirmation_status IN ('confirmed', 'pending', 'flagged'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add confirmed_at timestamp
ALTER TABLE job_worker ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Add flagged_at timestamp
ALTER TABLE job_worker ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;

-- Add flag_reason text
ALTER TABLE job_worker ADD COLUMN IF NOT EXISTS flag_reason TEXT;

-- Index for finding workers with pending confirmations
CREATE INDEX IF NOT EXISTS idx_job_worker_confirmation_pending 
  ON job_worker(worker_id, confirmation_status) 
  WHERE confirmation_status = 'pending';

-- Comments
COMMENT ON COLUMN job_worker.confirmation_status IS 'Worker confirmation status: confirmed (participation verified), pending (awaiting confirmation), flagged (worker disputed)';
COMMENT ON COLUMN job_worker.confirmed_at IS 'Timestamp when the worker confirmed their participation';
COMMENT ON COLUMN job_worker.flagged_at IS 'Timestamp when the worker flagged an issue with this job';
COMMENT ON COLUMN job_worker.flag_reason IS 'Reason provided by worker when flagging a job (required when flagging)';

-- ============================================================================
-- PART 3: Organization Settings Addition
-- ============================================================================

-- Add colleague_confirmation_timeout_hours setting (default 24 hours)
ALTER TABLE organization ADD COLUMN IF NOT EXISTS colleague_confirmation_timeout_hours INTEGER 
  DEFAULT 24;

-- Add check constraint for valid range (1-168 hours = 1 hour to 1 week)
DO $$ BEGIN
  ALTER TABLE organization ADD CONSTRAINT organization_colleague_confirmation_timeout_check 
    CHECK (colleague_confirmation_timeout_hours >= 1 AND colleague_confirmation_timeout_hours <= 168);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN organization.colleague_confirmation_timeout_hours IS 'Hours before jobs with colleagues are auto-approved (1-168, default 24)';

-- ============================================================================
-- PART 4: Notification Types
-- ============================================================================

-- Update notification type check constraint to include new types
-- First drop the existing constraint, then recreate with all types
ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_type_check;

ALTER TABLE notification ADD CONSTRAINT notification_type_check CHECK (
  type IN (
    -- Existing types
    'worker_active',
    'job_completed',
    'invoice_generated',
    'payment_received',
    'review_submitted',
    'admin_activated',
    'worker_created',
    -- New types for colleague confirmation workflow
    'job_confirmation_requested',
    'job_confirmation_reminder',
    'job_flagged',
    'job_withdrawn',
    'job_resolved_approved',
    'job_resolved_cancelled',
    'job_auto_approved'
  )
);

-- ============================================================================
-- PART 5: Update job_summary view to include approval_status
-- ============================================================================

-- Drop and recreate the view to include approval_status
DROP VIEW IF EXISTS job_summary;

CREATE VIEW job_summary AS
SELECT 
  j.id,
  j.organization_id,
  j.location_id,
  j.completed_at,
  j.created_at,
  j.approval_status,
  j.auto_approve_at,
  l.name AS location_name,
  o.name AS organization_name,
  EXISTS (SELECT 1 FROM feedback f WHERE f.job_id = j.id) AS has_feedback
FROM job j
LEFT JOIN location l ON j.location_id = l.id
LEFT JOIN organization o ON j.organization_id = o.id;

COMMENT ON VIEW job_summary IS 'Summary view of jobs with location, organization, approval status, and feedback indicator';
