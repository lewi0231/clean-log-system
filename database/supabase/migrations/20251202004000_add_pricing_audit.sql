-- -*- mode: sql; sql-product: postgres -*-
-- Audit logging for pricing_rule and pricing_condition tables

CREATE TABLE pricing_rule_audit (
  id BIGSERIAL PRIMARY KEY,
  pricing_rule_id UUID,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pricing_condition_audit (
  id BIGSERIAL PRIMARY KEY,
  pricing_condition_id UUID,
  pricing_rule_id UUID,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION log_pricing_rule_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO pricing_rule_audit (pricing_rule_id, action, old_data)
    VALUES (OLD.id, TG_OP, to_jsonb(OLD));
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO pricing_rule_audit (pricing_rule_id, action, old_data, new_data)
    VALUES (NEW.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO pricing_rule_audit (pricing_rule_id, action, new_data)
    VALUES (NEW.id, TG_OP, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_pricing_condition_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO pricing_condition_audit (pricing_condition_id, pricing_rule_id, action, old_data)
    VALUES (OLD.id, OLD.pricing_rule_id, TG_OP, to_jsonb(OLD));
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO pricing_condition_audit (pricing_condition_id, pricing_rule_id, action, old_data, new_data)
    VALUES (NEW.id, NEW.pricing_rule_id, TG_OP, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO pricing_condition_audit (pricing_condition_id, pricing_rule_id, action, new_data)
    VALUES (NEW.id, NEW.pricing_rule_id, TG_OP, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pricing_rule_audit
AFTER INSERT OR UPDATE OR DELETE ON pricing_rule
FOR EACH ROW EXECUTE FUNCTION log_pricing_rule_change();

CREATE TRIGGER trg_pricing_condition_audit
AFTER INSERT OR UPDATE OR DELETE ON pricing_condition
FOR EACH ROW EXECUTE FUNCTION log_pricing_condition_change();

