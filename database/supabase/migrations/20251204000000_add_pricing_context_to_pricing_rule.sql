-- -*- mode: sql; sql-product: postgres -*-
-- Add pricing_context to pricing_rule to separate customer and worker pricing

ALTER TABLE pricing_rule 
  ADD COLUMN IF NOT EXISTS pricing_context TEXT DEFAULT 'customer' 
  CHECK (pricing_context IN ('customer', 'worker'));

-- Update existing records to default to 'customer' (backward compatibility)
UPDATE pricing_rule 
SET pricing_context = 'customer' 
WHERE pricing_context IS NULL;

-- Add index for efficient filtering by context
CREATE INDEX IF NOT EXISTS idx_pricing_rule_context 
ON pricing_rule(organization_id, pricing_context, active) 
WHERE active = true;

-- Update the unique index to include pricing_context
-- This allows separate customer and worker rules for the same scope/field/location
DROP INDEX IF EXISTS idx_pricing_rule_effective_unique;

CREATE UNIQUE INDEX idx_pricing_rule_effective_unique
ON pricing_rule (
  organization_id,
  pricing_context,
  scope,
  COALESCE(field_config_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(option_value, ''),
  COALESCE(location_hierarchy_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
  effective_at
);

COMMENT ON COLUMN pricing_rule.pricing_context IS 'Determines if the rule applies to customer invoicing or worker payments. Allows independent pricing structures for each.';

