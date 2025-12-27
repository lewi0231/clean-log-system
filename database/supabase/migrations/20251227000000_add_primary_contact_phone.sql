-- Add primary contact phone field to organization table
ALTER TABLE organization 
  ADD COLUMN IF NOT EXISTS primary_contact_phone TEXT;

-- Add comment for documentation
COMMENT ON COLUMN organization.primary_contact_phone IS 'Primary business contact phone number displayed on invoices';

