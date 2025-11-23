-- Remove PIN code from worker table as we're moving to email/password auth
-- Make email required since it's needed for authentication

-- Remove the unique constraint on organization_id and pin_code
ALTER TABLE worker DROP CONSTRAINT IF EXISTS unique_org_pin;

-- Remove the index on organization_id and pin_code
DROP INDEX IF EXISTS idx_worker_org_pin;

-- Remove the pin_code column
ALTER TABLE worker DROP COLUMN IF EXISTS pin_code;

-- Make email required (NOT NULL) since it's needed for authentication
ALTER TABLE worker ALTER COLUMN email SET NOT NULL;

