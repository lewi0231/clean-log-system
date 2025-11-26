-- -*- mode: sql; sql-product: postgres -*-
-- Migration: Rename car_yard to location, update job table, and add submission_data

-- Step 1: Drop the view that depends on car_yard table
DROP VIEW IF EXISTS job_summary;

-- Step 2: Rename the table from car_yard to location
ALTER TABLE car_yard RENAME TO location;

-- Step 3: Drop the old index on car_yard
DROP INDEX IF EXISTS idx_car_yard_org;

-- Step 4: Create new index on location
CREATE INDEX idx_location_org ON location(organization_id);

-- Step 5: Update RLS policies - drop old policy and create new one
DROP POLICY IF EXISTS "Service role can manage car yard" ON location;
CREATE POLICY "Service role can manage location"
ON location FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Step 6: Update job table
-- First, find and drop the foreign key constraint (PostgreSQL auto-generates the name)
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'job'::regclass
    AND contype = 'f'
    AND pg_get_constraintdef(oid) LIKE '%car_yard%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE job DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END IF;
END $$;

-- Step 7: Rename car_yard_id column to location_id
ALTER TABLE job RENAME COLUMN car_yard_id TO location_id;

-- Step 8: Drop the old index on job.car_yard_id
DROP INDEX IF EXISTS idx_job_car_yard;

-- Step 9: Make location_id nullable (do this before adding FK constraint)
ALTER TABLE job ALTER COLUMN location_id DROP NOT NULL;

-- Step 10: Add new foreign key constraint with nullable location_id
ALTER TABLE job 
  ADD CONSTRAINT job_location_id_fkey 
  FOREIGN KEY (location_id) 
  REFERENCES location(id);

-- Step 11: Create new index on job.location_id
CREATE INDEX idx_job_location ON job(location_id);

-- Step 12: Remove deprecated columns from job table
ALTER TABLE job DROP COLUMN IF EXISTS car_count;
ALTER TABLE job DROP COLUMN IF EXISTS notes;

-- Step 13: Add submission_data JSONB column to job table
ALTER TABLE job ADD COLUMN submission_data JSONB;

-- Step 14: Recreate the job_summary view with LEFT JOIN for location and without car_count
CREATE VIEW job_summary AS
SELECT 
  cj.id as job_id,
  cj.organization_id,
  o.name as organization_name,
  w.name as worker_name,
  w.id as worker_id,
  l.name as location_name,
  cj.completed_at,
  f.rating,
  f.comment
FROM job cj
JOIN organization o ON cj.organization_id = o.id
JOIN job_worker jw ON cj.id = jw.job_id
JOIN worker w ON jw.worker_id = w.id
LEFT JOIN location l ON cj.location_id = l.id
LEFT JOIN feedback f ON cj.id = f.job_id
ORDER BY cj.completed_at DESC;

