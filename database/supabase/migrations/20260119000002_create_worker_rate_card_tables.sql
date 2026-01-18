-- -*- mode: sql; sql-product: postgres -*-
-- Worker Rate Card and Payment Allocation Tables
-- Supports different payment rates for workers and custom payment splits

-- Enable btree_gist extension for EXCLUDE constraints if not already enabled
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Worker Rate Card Table
-- Stores hourly rates for workers with effective date ranges
CREATE TABLE worker_rate_card (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
  
  -- Rate Details
  hourly_rate DECIMAL(10, 2) NOT NULL CHECK (hourly_rate > 0),
  currency TEXT NOT NULL DEFAULT 'AUD',
  
  -- Effective Period
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  
  -- Rate Type and Role
  rate_type TEXT DEFAULT 'standard' CHECK (rate_type IN ('standard', 'overtime', 'holiday')),
  role_title TEXT, -- 'Supervisor', 'Senior Technician', 'Apprentice', etc.
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Notes
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure no overlapping active rate cards for same worker/rate_type
  CONSTRAINT worker_rate_card_no_overlap EXCLUDE USING gist (
    worker_id WITH =,
    rate_type WITH =,
    daterange(effective_from, effective_to, '[]') WITH &&
  ) WHERE (is_active = TRUE)
);

COMMENT ON TABLE worker_rate_card IS 'Worker payment rate cards with effective date ranges';
COMMENT ON COLUMN worker_rate_card.hourly_rate IS 'Hourly rate for this worker (must be > 0)';
COMMENT ON COLUMN worker_rate_card.effective_from IS 'Date this rate becomes effective';
COMMENT ON COLUMN worker_rate_card.effective_to IS 'Date this rate ends (NULL = no end date)';
COMMENT ON COLUMN worker_rate_card.rate_type IS 'Type of rate: standard, overtime, or holiday';
COMMENT ON COLUMN worker_rate_card.role_title IS 'Worker role/title for this rate (e.g., Supervisor)';

-- Worker Payment Allocation Table
-- Stores custom payment splits for jobs with multiple workers
CREATE TABLE worker_payment_allocation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
  
  -- Allocation Type
  allocation_type TEXT NOT NULL DEFAULT 'percentage' CHECK (
    allocation_type IN ('percentage', 'amount', 'hours')
  ),
  
  -- Allocation Values (only one should be set based on allocation_type)
  percentage DECIMAL(5, 2) CHECK (percentage >= 0 AND percentage <= 100),
  fixed_amount DECIMAL(10, 2) CHECK (fixed_amount >= 0),
  hours_worked DECIMAL(5, 2) CHECK (hours_worked >= 0),
  
  -- Optional: Allocation per grouped breakdown option
  field_config_id UUID REFERENCES organization_field_configs(id) ON DELETE CASCADE,
  option_value TEXT,
  
  -- Notes
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique allocation per job/worker/field combination
  CONSTRAINT worker_payment_allocation_unique UNIQUE (job_id, worker_id, field_config_id, option_value)
);

COMMENT ON TABLE worker_payment_allocation IS 'Custom payment allocations for jobs with multiple workers';
COMMENT ON COLUMN worker_payment_allocation.allocation_type IS 'Type of allocation: percentage, amount, or hours';
COMMENT ON COLUMN worker_payment_allocation.percentage IS 'Percentage of payment (must sum to 100% across all workers)';
COMMENT ON COLUMN worker_payment_allocation.fixed_amount IS 'Fixed amount for this worker';
COMMENT ON COLUMN worker_payment_allocation.hours_worked IS 'Hours worked for proportional calculation';

-- Indexes
CREATE INDEX idx_worker_rate_card_org ON worker_rate_card(organization_id);
CREATE INDEX idx_worker_rate_card_worker ON worker_rate_card(worker_id);
CREATE INDEX idx_worker_rate_card_lookup ON worker_rate_card(worker_id, rate_type, effective_from DESC) WHERE is_active = TRUE;
CREATE INDEX idx_worker_rate_card_active ON worker_rate_card(organization_id, is_active) WHERE is_active = TRUE;

CREATE INDEX idx_worker_payment_allocation_org ON worker_payment_allocation(organization_id);
CREATE INDEX idx_worker_payment_allocation_job ON worker_payment_allocation(job_id);
CREATE INDEX idx_worker_payment_allocation_worker ON worker_payment_allocation(worker_id);

-- Updated at triggers
CREATE TRIGGER update_worker_rate_card_updated_at
  BEFORE UPDATE ON worker_rate_card
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_worker_payment_allocation_updated_at
  BEFORE UPDATE ON worker_payment_allocation
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE worker_rate_card ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_payment_allocation ENABLE ROW LEVEL SECURITY;

-- RLS Policies - follows existing service_role pattern
CREATE POLICY "Service role can manage worker_rate_card"
  ON worker_rate_card
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage worker_payment_allocation"
  ON worker_payment_allocation
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
