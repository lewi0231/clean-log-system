-- -*- mode: sql; sql-product: postgres -*-
-- Worker Payment Tables
-- Supports tracking calculated worker payments and payment processing

-- Worker Payment Batch Table (groups related payments)
CREATE TABLE worker_payment_batch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  
  -- Batch Details
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calculated_by UUID REFERENCES organization_user(id),
  
  -- Calculation Summary
  total_payment DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'AUD',
  job_count INTEGER NOT NULL,
  worker_count INTEGER NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'calculated' CHECK (status IN (
    'calculated',  -- Payment calculated but not yet processed
    'processing',  -- Payments being processed
    'completed',   -- All payments completed
    'cancelled'    -- Batch cancelled
  )),
  
  -- Payment processing metadata
  notes TEXT,
  calculation_data JSONB, -- Full calculation response for reference
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE worker_payment_batch IS 'Batches of worker payment calculations';
COMMENT ON COLUMN worker_payment_batch.calculation_data IS 'Full CalculateWorkerPaymentsResponse JSON for reference';

-- Worker Payment Table (individual payments per job/worker)
CREATE TABLE worker_payment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  batch_id UUID REFERENCES worker_payment_batch(id) ON DELETE SET NULL,
  job_id UUID REFERENCES job(id) ON DELETE CASCADE NOT NULL,
  worker_id UUID REFERENCES worker(id) ON DELETE CASCADE NOT NULL,
  
  -- Payment Details
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT DEFAULT 'AUD',
  
  -- Status Tracking
  status TEXT DEFAULT 'calculated' CHECK (status IN (
    'calculated',  -- Payment calculated but not yet paid
    'pending',     -- Payment pending processing
    'processing',  -- Payment being processed
    'paid',        -- Payment completed
    'failed',      -- Payment failed
    'cancelled'    -- Payment cancelled
  )),
  
  -- Payment Processing
  payment_method TEXT CHECK (payment_method IN (
    'bank_transfer',
    'cash',
    'check',
    'payroll_system',
    'other'
  )),
  payment_reference TEXT, -- Bank reference, check number, etc.
  paid_at TIMESTAMPTZ, -- When payment was actually made
  paid_by UUID REFERENCES organization_user(id),
  
  -- Calculation Details (for reference)
  calculation_details JSONB, -- Line items, applied rules, etc.
  
  -- Notes
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE worker_payment IS 'Individual worker payments calculated from jobs';
COMMENT ON COLUMN worker_payment.calculation_details IS 'Calculation breakdown for this specific payment';

-- Indexes
CREATE INDEX idx_worker_payment_batch_org ON worker_payment_batch(organization_id);
CREATE INDEX idx_worker_payment_batch_status ON worker_payment_batch(status);
CREATE INDEX idx_worker_payment_batch_created ON worker_payment_batch(created_at DESC);

CREATE INDEX idx_worker_payment_org ON worker_payment(organization_id);
CREATE INDEX idx_worker_payment_batch ON worker_payment(batch_id);
CREATE INDEX idx_worker_payment_job ON worker_payment(job_id);
CREATE INDEX idx_worker_payment_worker ON worker_payment(worker_id);
CREATE INDEX idx_worker_payment_status ON worker_payment(status);
CREATE INDEX idx_worker_payment_created ON worker_payment(created_at DESC);

-- Updated at trigger
CREATE TRIGGER update_worker_payment_batch_updated_at
  BEFORE UPDATE ON worker_payment_batch
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_worker_payment_updated_at
  BEFORE UPDATE ON worker_payment
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE worker_payment_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_payment ENABLE ROW LEVEL SECURITY;

-- RLS Policies
--
-- NOTE: This codebase primarily accesses data through Edge Functions using the
-- service role key (see createServiceRoleClient()), so we follow the existing
-- security pattern used elsewhere: service_role can manage these tables.
--
-- The organization_user table is email-based (no user_id column), so policies
-- that join on organization_user.user_id will fail at migration time.

CREATE POLICY "Service role can manage worker_payment_batch"
  ON worker_payment_batch
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage worker_payment"
  ON worker_payment
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

