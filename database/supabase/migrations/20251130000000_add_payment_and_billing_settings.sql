-- -*- mode: sql; sql-product: postgres -*-
-- Add payment and billing settings to organization table

ALTER TABLE organization 
  ADD COLUMN IF NOT EXISTS invoice_send_immediately BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT;

-- Add comments for documentation
COMMENT ON COLUMN organization.invoice_send_immediately IS 'If true, invoices are sent immediately upon creation. If false, invoices require review before sending.';
COMMENT ON COLUMN organization.stripe_account_id IS 'Stripe account ID/identifier for payment processing';
COMMENT ON COLUMN organization.payment_provider IS 'Payment provider identifier (e.g., "stripe", "paypal") for future multi-provider support';

