-- -*- mode: sql; sql-product: postgres -*-
-- Phase 1: Add NOT NULL constraints to critical columns

-- Invoice number should always be set
ALTER TABLE invoice 
  ALTER COLUMN invoice_number SET NOT NULL;

-- Add comment explaining why location_id is nullable (if it needs to stay nullable)
COMMENT ON COLUMN job.location_id IS 
  'Location where job was performed. NULL allowed for legacy jobs or system-generated records.';

