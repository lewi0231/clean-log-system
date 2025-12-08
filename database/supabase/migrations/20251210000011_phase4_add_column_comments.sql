-- -*- mode: sql; sql-product: postgres -*-
-- Phase 4: Add descriptive comments to complex columns

COMMENT ON COLUMN job.submission_data IS 
  'JSONB containing all field values submitted by workers during job completion. Structure matches organization_field_configs structure at time of submission.';

COMMENT ON COLUMN organization_field_configs.conditional_logic IS 
  'JSON structure defining when this field should be visible based on other field values. Format: {"conditions": [{"field_id": "uuid", "operator": "equals", "value": "any"}], "match_type": "all|any"}.';

COMMENT ON COLUMN location.pricing_mode IS 
  'field_based: pricing calculated from field configs using pricing rules. fixed_price: uses fixed_customer_price regardless of field data.';

COMMENT ON COLUMN location.fixed_customer_price IS 
  'Fixed price for customer invoicing when pricing_mode is fixed_price. Field config data is still collected for operational purposes.';

COMMENT ON COLUMN pricing_rule.pricing_context IS 
  'Determines if the rule applies to customer invoicing (customer) or worker payments (worker). Allows independent pricing structures for each.';

COMMENT ON COLUMN pricing_rule.effective_at IS 
  'Timestamp when the pricing rule becomes active. Rules are selected based on effective_at and expires_at timestamps.';

COMMENT ON COLUMN pricing_rule.expires_at IS 
  'Timestamp when the pricing rule stops being active. NULL means the rule is open-ended and remains active indefinitely.';

