-- -*- mode: sql; sql-product: postgres -*-
-- Option Pricing Table
-- Stores pricing for individual options within select/grouped_breakdown fields

CREATE TABLE option_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  field_config_id UUID REFERENCES organization_field_configs(id) ON DELETE CASCADE NOT NULL,
  option_value TEXT NOT NULL, -- The option name/group name (e.g., "Installation", "Maintenance")
  customer_price DECIMAL(10, 2) NOT NULL CHECK (customer_price >= 0),
  worker_payment_rate DECIMAL(10, 2) CHECK (worker_payment_rate >= 0),
  location_id UUID REFERENCES location(id) ON DELETE CASCADE, -- NULL = default
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index that allows location overrides
-- Use a sentinel UUID for NULL location_id to allow unique constraint
CREATE UNIQUE INDEX idx_option_pricing_unique 
  ON option_pricing(
    organization_id, 
    field_config_id, 
    option_value,
    COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- Add indexes
CREATE INDEX idx_option_pricing_org ON option_pricing(organization_id);
CREATE INDEX idx_option_pricing_field_config ON option_pricing(field_config_id);
CREATE INDEX idx_option_pricing_location ON option_pricing(location_id);
CREATE INDEX idx_option_pricing_option_value ON option_pricing(option_value);

-- Enable RLS
ALTER TABLE option_pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage option pricing
CREATE POLICY "Service role can manage option_pricing"
ON option_pricing FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comments for documentation
COMMENT ON COLUMN option_pricing.option_value IS 'The option/group name from the field config options array';
COMMENT ON COLUMN option_pricing.customer_price IS 'Price charged to customer for this option';
COMMENT ON COLUMN option_pricing.worker_payment_rate IS 'Rate paid to worker for this option (can be different from customer price)';
COMMENT ON COLUMN option_pricing.location_id IS 'NULL = organization default, otherwise location-specific override';

