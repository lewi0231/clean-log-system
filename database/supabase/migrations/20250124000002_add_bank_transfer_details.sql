-- Add bank transfer details (BSB and account number) to organization_settings
-- These will be displayed on invoices for manual payment processing

ALTER TABLE organization_settings 
  ADD COLUMN IF NOT EXISTS bank_transfer_bsb TEXT,
  ADD COLUMN IF NOT EXISTS bank_transfer_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_transfer_account_name TEXT,
  ADD COLUMN IF NOT EXISTS show_bank_transfer_on_invoices BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN organization_settings.bank_transfer_bsb IS 'BSB (Bank State Branch) number for bank transfer payments (Australian format: XXX-XXX)';
COMMENT ON COLUMN organization_settings.bank_transfer_account_number IS 'Bank account number for bank transfer payments';
COMMENT ON COLUMN organization_settings.bank_transfer_account_name IS 'Account name for bank transfer payments';
COMMENT ON COLUMN organization_settings.show_bank_transfer_on_invoices IS 'If true, display bank transfer details on invoices for manual payment processing';

