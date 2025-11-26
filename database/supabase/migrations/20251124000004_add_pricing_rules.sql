-- -*- mode: sql; sql-product: postgres -*-
-- Pricing Rules Table
-- Stores custom if-then pricing rules for advanced scenarios

CREATE TABLE pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('discount', 'surcharge', 'override')),
  condition_field_config_id UUID REFERENCES organization_field_configs(id) ON DELETE CASCADE NOT NULL,
  condition_operator TEXT NOT NULL CHECK (condition_operator IN ('equals', 'greater_than', 'less_than', 'contains', 'not_equals')),
  condition_value TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('multiply', 'add', 'set')),
  action_value DECIMAL(10, 2) NOT NULL,
  priority INT NOT NULL DEFAULT 0, -- Lower number = higher priority
  enabled BOOLEAN DEFAULT true,
  location_id UUID REFERENCES location(id) ON DELETE CASCADE, -- NULL = applies to all locations
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_pricing_rules_org ON pricing_rules(organization_id);
CREATE INDEX idx_pricing_rules_location ON pricing_rules(location_id);
CREATE INDEX idx_pricing_rules_enabled ON pricing_rules(organization_id, enabled) WHERE enabled = true;
CREATE INDEX idx_pricing_rules_priority ON pricing_rules(organization_id, priority);

-- Enable RLS
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage pricing rules
CREATE POLICY "Service role can manage pricing_rules"
ON pricing_rules FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comments for documentation
COMMENT ON COLUMN pricing_rules.rule_type IS 'discount: reduce price, surcharge: add to price, override: replace price';
COMMENT ON COLUMN pricing_rules.condition_operator IS 'Comparison operator for the condition';
COMMENT ON COLUMN pricing_rules.action_type IS 'multiply: multiply by value, add: add value, set: set to value';
COMMENT ON COLUMN pricing_rules.priority IS 'Lower number = higher priority (applied first)';
COMMENT ON COLUMN pricing_rules.location_id IS 'NULL = applies to all locations, otherwise location-specific';

