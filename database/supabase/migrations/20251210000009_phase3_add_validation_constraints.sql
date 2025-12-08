-- -*- mode: sql; sql-product: postgres -*-
-- Phase 3: Add check constraints for data validation

-- Email format validation for organization users
-- Drop constraint if it exists, then add it
ALTER TABLE organization_user 
  DROP CONSTRAINT IF EXISTS check_email_format;

ALTER TABLE organization_user 
  ADD CONSTRAINT check_email_format 
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Worker email validation (nullable, but if set, must be valid)
ALTER TABLE worker 
  DROP CONSTRAINT IF EXISTS check_worker_email_format;

ALTER TABLE worker 
  ADD CONSTRAINT check_worker_email_format 
  CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Location email validation
ALTER TABLE location 
  DROP CONSTRAINT IF EXISTS check_location_email_format;

ALTER TABLE location 
  ADD CONSTRAINT check_location_email_format 
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

