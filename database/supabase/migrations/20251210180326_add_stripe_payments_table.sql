-- -*- mode: sql; sql-product: postgres -*-
-- Stripe Payment Tables
-- Supports payment tracking via Stripe Checkout and manual bank transfers

-- Payment Table (Stripe-focused)
CREATE TABLE payment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES invoice(id) ON DELETE SET NULL,
  
  -- Payment Details
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'AUD',
  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'stripe_checkout_card',
    'stripe_checkout_bank',
    'stripe_checkout_wallet',
    'bank_transfer_manual',
    'other'
  )),
  
  -- Stripe Information
  stripe_payment_intent_id TEXT UNIQUE, -- Stripe PaymentIntent ID
  stripe_checkout_session_id TEXT, -- Stripe Checkout Session ID
  stripe_customer_id TEXT, -- Stripe Customer ID (if created)
  stripe_charge_id TEXT, -- Stripe Charge ID
  
  -- Status Tracking (aligned with Stripe statuses)
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'canceled',
    'refunded',
    'partially_refunded',
    'disputed'
  )),
  
  -- Payment Metadata
  payment_reference TEXT, -- Customer's payment reference (for manual transfers)
  payment_date TIMESTAMPTZ, -- When payment was made
  received_at TIMESTAMPTZ, -- When payment was received/confirmed
  fees DECIMAL(10, 2) DEFAULT 0, -- Stripe processing fees
  net_amount DECIMAL(10, 2), -- Amount after fees (amount - fees)
  
  -- Reconciliation
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES organization_user(id),
  reconciliation_notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb -- Stripe webhook data, etc.
);

-- Payment Link Table (Stripe Checkout Sessions)
CREATE TABLE payment_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES invoice(id) ON DELETE CASCADE NOT NULL,
  
  -- Stripe Checkout Session
  stripe_checkout_session_id TEXT UNIQUE NOT NULL,
  checkout_url TEXT NOT NULL, -- The payment link URL
  
  -- Link Status
  status TEXT DEFAULT 'open' CHECK (status IN (
    'open',           -- Session created, waiting for payment
    'complete',       -- Payment completed
    'expired',        -- Session expired
    'canceled'        -- Session canceled
  )),
  
  -- Tracking
  clicked_at TIMESTAMPTZ,
  clicked_count INTEGER DEFAULT 0,
  payment_completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- When the checkout session expires
  
  -- Metadata
  customer_email TEXT, -- Email of customer (if known)
  amount_total DECIMAL(10, 2) NOT NULL, -- Total amount for this session
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update Invoice Table with Payment Tracking
ALTER TABLE invoice
  ADD COLUMN IF NOT EXISTS payment_link_id UUID REFERENCES payment_link(id),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT, -- Stripe customer ID (if created)
  ADD COLUMN IF NOT EXISTS bsb TEXT, -- Organization's BSB for manual transfers
  ADD COLUMN IF NOT EXISTS account_number TEXT, -- Organization's account number
  ADD COLUMN IF NOT EXISTS account_name TEXT, -- Account name for bank transfers
  ADD COLUMN IF NOT EXISTS total_paid DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method_used TEXT; -- Track which method was used

-- Indexes for Payment Table
CREATE INDEX idx_payment_invoice ON payment(invoice_id);
CREATE INDEX idx_payment_org ON payment(organization_id);
CREATE INDEX idx_payment_status ON payment(status);
CREATE INDEX idx_payment_stripe_intent ON payment(stripe_payment_intent_id);
CREATE INDEX idx_payment_stripe_session ON payment(stripe_checkout_session_id);
CREATE INDEX idx_payment_reference ON payment(payment_reference);
CREATE INDEX idx_payment_date ON payment(payment_date);

-- Indexes for Payment Link Table
CREATE INDEX idx_payment_link_invoice ON payment_link(invoice_id);
CREATE INDEX idx_payment_link_stripe_session ON payment_link(stripe_checkout_session_id);
CREATE INDEX idx_payment_link_status ON payment_link(status);

-- Enable RLS
ALTER TABLE payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_link ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Service role can manage payments
CREATE POLICY "Service role can manage payment"
ON payment FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage payment_link"
ON payment_link FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comments for documentation
COMMENT ON TABLE payment IS 'Payment records for invoices, supporting Stripe Checkout and manual bank transfers';
COMMENT ON COLUMN payment.stripe_payment_intent_id IS 'Stripe PaymentIntent ID for tracking payments';
COMMENT ON COLUMN payment.stripe_checkout_session_id IS 'Stripe Checkout Session ID linking to payment_link';
COMMENT ON COLUMN payment.status IS 'Payment status aligned with Stripe payment intent statuses';
COMMENT ON COLUMN payment.net_amount IS 'Amount after Stripe fees (amount - fees)';
COMMENT ON COLUMN payment.metadata IS 'Stores Stripe webhook event data and other metadata';

COMMENT ON TABLE payment_link IS 'Stripe Checkout payment links generated for invoices';
COMMENT ON COLUMN payment_link.stripe_checkout_session_id IS 'Unique Stripe Checkout Session ID';
COMMENT ON COLUMN payment_link.checkout_url IS 'The payment link URL sent to customers';
COMMENT ON COLUMN payment_link.status IS 'Status of the checkout session: open, complete, expired, canceled';

COMMENT ON COLUMN invoice.payment_link_id IS 'Reference to Stripe Checkout payment link';
COMMENT ON COLUMN invoice.stripe_customer_id IS 'Stripe customer ID for this invoice';
COMMENT ON COLUMN invoice.total_paid IS 'Sum of all payments received for this invoice';
COMMENT ON COLUMN invoice.payment_count IS 'Number of payments received (supports partial payments)';
COMMENT ON COLUMN invoice.payment_method_used IS 'Payment method used: stripe_checkout, bank_transfer_manual';

