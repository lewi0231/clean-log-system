-- -*- mode: sql; sql-product: postgres -*-
-- Add business_mode column to organization table
-- Supports two modes: 'service_based' (car detailer) and 'resource_tracking' (car yard business)

ALTER TABLE organization 
  ADD COLUMN IF NOT EXISTS business_mode TEXT DEFAULT 'service_based' 
  CHECK (business_mode IN ('service_based', 'resource_tracking'));

-- Add comment for documentation
COMMENT ON COLUMN organization.business_mode IS 
  'service_based: Car detailer offering specific services at fixed prices. resource_tracking: Car yard business tracking materials/resources used per job.';

-- Create index for queries filtering by business mode
CREATE INDEX IF NOT EXISTS idx_organization_business_mode ON organization(business_mode);

