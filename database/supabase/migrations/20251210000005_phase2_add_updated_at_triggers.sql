-- -*- mode: sql; sql-product: postgres -*-
-- Phase 2: Create generic trigger function for updating updated_at timestamps

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_form_section_updated_at
  BEFORE UPDATE ON form_section
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_location_hierarchy_updated_at
  BEFORE UPDATE ON location_hierarchy
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_rule_updated_at
  BEFORE UPDATE ON pricing_rule
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_condition_updated_at
  BEFORE UPDATE ON pricing_condition
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

