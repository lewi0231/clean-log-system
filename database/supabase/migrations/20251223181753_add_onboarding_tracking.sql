-- -*- mode: sql; sql-product: postgres -*-
-- Add onboarding tracking to organization table
-- This tracks when onboarding is completed and stores onboarding answers

-- Add columns to organization table
ALTER TABLE organization
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT NULL;

-- Add index for onboarding queries
CREATE INDEX IF NOT EXISTS idx_organization_onboarding_completed 
  ON organization(onboarding_completed_at) 
  WHERE onboarding_completed_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN organization.onboarding_completed_at IS 'Timestamp when user completed onboarding. NULL means onboarding not completed.';
COMMENT ON COLUMN organization.onboarding_data IS 'Stores answers from onboarding wizard: {industry_type, employee_count, abn, has_locations, worker_payment_method, worker_payment_frequency, invoice_frequency, review_invoices_before_sending}';

