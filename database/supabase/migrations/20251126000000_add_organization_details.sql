-- Add additional organization fields for business information
ALTER TABLE organization 
  ADD COLUMN IF NOT EXISTS abn TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_contact_email TEXT;

-- Set primary_contact_email for existing organizations based on first admin user
UPDATE organization o
SET primary_contact_email = (
  SELECT email 
  FROM organization_user ou 
  WHERE ou.organization_id = o.id 
  AND ou.role = 'admin' 
  ORDER BY ou.created_at ASC 
  LIMIT 1
)
WHERE primary_contact_email IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN organization.abn IS 'Australian Business Number (ABN)';
COMMENT ON COLUMN organization.logo_url IS 'URL to the organization logo image';
COMMENT ON COLUMN organization.primary_contact_email IS 'Primary business contact email (set during registration, read-only for users)';

