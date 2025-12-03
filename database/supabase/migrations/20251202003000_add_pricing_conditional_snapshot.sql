-- -*- mode: sql; sql-product: postgres -*-
-- Conditional pricing logic and pricing snapshots for historical integrity

CREATE TYPE pricing_condition_operator AS ENUM (
  'equals',
  'not_equals',
  'greater_than',
  'greater_than_or_equal',
  'less_than',
  'less_than_or_equal',
  'contains'
);

CREATE TYPE pricing_action_type AS ENUM ('add', 'subtract', 'multiply', 'divide', 'set');

CREATE TABLE pricing_condition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_rule_id UUID REFERENCES pricing_rule(id) ON DELETE CASCADE NOT NULL,
  condition_field_config_id UUID REFERENCES organization_field_configs(id) ON DELETE CASCADE NOT NULL,
  operator pricing_condition_operator NOT NULL,
  condition_value TEXT NOT NULL,
  action_type pricing_action_type NOT NULL,
  action_value DECIMAL(12, 4) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  priority INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pricing_condition_rule ON pricing_condition(pricing_rule_id);
CREATE INDEX idx_pricing_condition_field ON pricing_condition(condition_field_config_id);

ALTER TABLE pricing_condition ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage pricing_condition"
ON pricing_condition FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE pricing_condition IS 'Defines conditional logic for pricing rules.';

-- Pricing snapshots capture rule application details when generating invoices
CREATE TABLE pricing_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES invoice(id) ON DELETE CASCADE,
  job_id UUID REFERENCES job(id) ON DELETE SET NULL,
  pricing_rule_id UUID REFERENCES pricing_rule(id) ON DELETE SET NULL,
  field_config_id UUID REFERENCES organization_field_configs(id) ON DELETE SET NULL,
  line_item_key TEXT,
  snapshot_data JSONB NOT NULL,
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pricing_snapshot_org ON pricing_snapshot(organization_id);
CREATE INDEX idx_pricing_snapshot_invoice ON pricing_snapshot(invoice_id);
CREATE INDEX idx_pricing_snapshot_job ON pricing_snapshot(job_id);

ALTER TABLE pricing_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage pricing_snapshot"
ON pricing_snapshot FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE pricing_snapshot IS 'Immutable record of pricing rule data stored at invoice creation time.';

