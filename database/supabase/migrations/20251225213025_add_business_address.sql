-- Add business address field to organization table
-- This is an optional field for storing the organization's physical business address
-- Used for invoices and official documents

ALTER TABLE organization 
  ADD COLUMN IF NOT EXISTS business_address TEXT;

-- Add comment for documentation
COMMENT ON COLUMN organization.business_address IS 'Physical business address for invoices and official documents (optional)';

