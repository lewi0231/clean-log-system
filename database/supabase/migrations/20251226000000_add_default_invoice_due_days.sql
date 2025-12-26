-- Add default invoice due days setting to organization_settings
-- Allows organizations to configure how many days invoices are due after creation

ALTER TABLE organization_settings 
  ADD COLUMN IF NOT EXISTS default_invoice_due_days INTEGER DEFAULT 30;

-- Add constraint to ensure reasonable values (1-365 days)
ALTER TABLE organization_settings
  ADD CONSTRAINT check_default_invoice_due_days 
  CHECK (default_invoice_due_days >= 1 AND default_invoice_due_days <= 365);

-- Add comment for documentation
COMMENT ON COLUMN organization_settings.default_invoice_due_days IS 'Number of days after invoice creation when payment is due. Default is 30 days.';

