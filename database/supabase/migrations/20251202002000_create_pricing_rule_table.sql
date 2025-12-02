-- -*- mode: sql; sql-product: postgres -*-
-- Unified pricing_rule table with effective dating and flexible pricing types

CREATE TYPE pricing_scope AS ENUM ('field', 'option', 'base', 'global');
CREATE TYPE pricing_type_enum AS ENUM ('unit', 'fixed', 'tiered', 'percentage', 'conditional');

CREATE TABLE pricing_rule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  scope pricing_scope NOT NULL,
  pricing_type pricing_type_enum NOT NULL,
  field_config_id UUID REFERENCES organization_field_configs(id) ON DELETE CASCADE,
  option_value TEXT,
  applies_to_field_type TEXT,
  location_hierarchy_id UUID REFERENCES location_hierarchy(id) ON DELETE CASCADE,
  location_id UUID REFERENCES location(id) ON DELETE CASCADE,
  currency TEXT DEFAULT 'USD',
  base_price DECIMAL(12, 4),
  percentage_rate DECIMAL(7, 4), -- e.g., 0.1500 == 15%
  minimum_quantity DECIMAL(12, 4),
  maximum_quantity DECIMAL(12, 4),
  tier_definition JSONB, -- [{"min":0,"max":10,"price":5.00}]
  metadata JSONB DEFAULT '{}'::jsonb,
  worker_payment_type TEXT CHECK (worker_payment_type IN ('same_structure', 'percentage', 'fixed_rate')),
  worker_payment_value DECIMAL(12, 4),
  priority INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pricing_rule_org ON pricing_rule(organization_id);
CREATE INDEX idx_pricing_rule_field ON pricing_rule(field_config_id);
CREATE INDEX idx_pricing_rule_location_hierarchy ON pricing_rule(location_hierarchy_id);
CREATE INDEX idx_pricing_rule_location ON pricing_rule(location_id);
CREATE INDEX idx_pricing_rule_effective ON pricing_rule(organization_id, effective_at, COALESCE(expires_at, 'infinity'::timestamptz));
CREATE INDEX idx_pricing_rule_scope_type ON pricing_rule(scope, pricing_type);

-- Prevent overlapping effective windows for the same organization/field/location combination
CREATE UNIQUE INDEX idx_pricing_rule_effective_unique
ON pricing_rule (
  organization_id,
  scope,
  COALESCE(field_config_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(option_value, ''),
  COALESCE(location_hierarchy_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
  effective_at
);

ALTER TABLE pricing_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage pricing_rule"
ON pricing_rule FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE pricing_rule IS 'Unified pricing table supporting field, option, and base pricing with location hierarchies and effective dating.';
COMMENT ON COLUMN pricing_rule.scope IS 'Determines if the rule applies to fields, select options, base pricing, or global adjustments.';
COMMENT ON COLUMN pricing_rule.tier_definition IS 'JSON describing tiered pricing brackets.';
COMMENT ON COLUMN pricing_rule.effective_at IS 'Timestamp when the pricing rule becomes active.';
COMMENT ON COLUMN pricing_rule.expires_at IS 'Timestamp when the pricing rule stops being active (NULL = open-ended).';

