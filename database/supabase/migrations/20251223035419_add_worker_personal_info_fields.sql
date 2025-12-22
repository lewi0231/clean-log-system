-- Add personal information fields to worker table
-- Workers will enter first_name, last_name, address, and ABN during signup

-- Add new columns (nullable for existing workers, will be required for new signups)
ALTER TABLE worker
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS abn TEXT;

-- Migrate existing name data: split into first_name and last_name
-- For existing records, put full name in first_name if we can't determine split
UPDATE worker
SET 
  first_name = CASE 
    WHEN name ~ '^\S+\s+\S+.*' THEN SPLIT_PART(name, ' ', 1)
    ELSE name
  END,
  last_name = CASE 
    WHEN name ~ '^\S+\s+\S+.*' THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
    ELSE NULL
  END
WHERE first_name IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN worker.first_name IS 'Worker first name (required for new workers during signup)';
COMMENT ON COLUMN worker.last_name IS 'Worker last name (required for new workers during signup)';
COMMENT ON COLUMN worker.address IS 'Worker address (required for new workers during signup)';
COMMENT ON COLUMN worker.abn IS 'Worker Australian Business Number - ABN (required for new workers during signup)';

