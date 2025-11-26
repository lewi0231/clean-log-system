-- -*- mode: sql; sql-product: postgres -*-
-- Base Pricing Table
-- Supports both field-based and standalone base pricing for jobs

CREATE TABLE base_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  job_type_field_config_id UUID REFERENCES organization_field_configs(id) ON DELETE CASCADE, -- NULL if using standalone
  job_type_value TEXT, -- e.g., "Installation", "Maintenance" (from select field or standalone)
  standalone_base_price DECIMAL(10, 2) CHECK (standalone_base_price >= 0), -- NULL if using field-based
  customer_base_price DECIMAL(10, 2) NOT NULL CHECK (customer_base_price >= 0),
  worker_base_payment DECIMAL(10, 2) CHECK (worker_base_payment >= 0),
  location_id UUID REFERENCES location(id) ON DELETE CASCADE, -- NULL = default
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure only one of job_type_field_config_id or standalone_base_price is set
  CONSTRAINT base_pricing_type_check CHECK (
    (job_type_field_config_id IS NULL AND standalone_base_price IS NOT NULL) OR
    (job_type_field_config_id IS NOT NULL AND standalone_base_price IS NULL)
  )
);

-- Create unique index that allows location overrides
-- Use sentinel values for NULL fields to allow unique constraint
CREATE UNIQUE INDEX idx_base_pricing_unique 
  ON base_pricing(
    organization_id, 
    COALESCE(job_type_field_config_id, '00000000-0000-0000-0000-000000000000'::uuid), 
    COALESCE(job_type_value, ''),
    COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- Add indexes
CREATE INDEX idx_base_pricing_org ON base_pricing(organization_id);
CREATE INDEX idx_base_pricing_location ON base_pricing(location_id);
CREATE INDEX idx_base_pricing_field_config ON base_pricing(job_type_field_config_id);

-- Enable RLS
ALTER TABLE base_pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage base pricing
CREATE POLICY "Service role can manage base_pricing"
ON base_pricing FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comments for documentation
COMMENT ON COLUMN base_pricing.job_type_field_config_id IS 'NULL = standalone base pricing, otherwise field-based pricing';
COMMENT ON COLUMN base_pricing.job_type_value IS 'The option value from select field (for field-based) or descriptive name (for standalone)';
COMMENT ON COLUMN base_pricing.standalone_base_price IS 'Base price for standalone pricing (mutually exclusive with job_type_field_config_id)';
COMMENT ON COLUMN base_pricing.customer_base_price IS 'Base price charged to customer';
COMMENT ON COLUMN base_pricing.worker_base_payment IS 'Base payment to worker (can be different from customer price)';
COMMENT ON COLUMN base_pricing.location_id IS 'NULL = organization default, otherwise location-specific override';

