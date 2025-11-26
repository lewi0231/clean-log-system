-- -*- mode: sql; sql-product: postgres -*-
-- Field Pricing
-- Stores unit prices for number-type field configs used in invoicing
CREATE TABLE field_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  field_config_id UUID REFERENCES organization_field_configs(id) ON DELETE CASCADE NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, field_config_id)
);

-- Add index for organization_id queries
CREATE INDEX idx_field_pricing_org ON field_pricing(organization_id);
CREATE INDEX idx_field_pricing_field_config ON field_pricing(field_config_id);

-- Enable RLS
ALTER TABLE field_pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage field pricing
CREATE POLICY "Service role can manage field_pricing"
ON field_pricing FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

