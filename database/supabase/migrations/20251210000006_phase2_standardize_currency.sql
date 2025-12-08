-- -*- mode: sql; sql-product: postgres -*-
-- Phase 2: Create currency enum type and migrate all currency columns
-- Standardizes currency storage across all tables

-- Create enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'currency_code') THEN
    CREATE TYPE currency_code AS ENUM (
      'AUD', 'USD', 'GBP', 'EUR', 'CAD', 'NZD'
    );
  END IF;
END $$;

COMMENT ON TYPE currency_code IS 'ISO 4217 currency codes supported by the platform';

-- Migrate organization.currency (default: AUD)
-- Drop the CHECK constraint FIRST (before type conversion)
ALTER TABLE organization 
  DROP CONSTRAINT IF EXISTS organization_currency_check;

ALTER TABLE organization ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE organization ALTER COLUMN currency TYPE currency_code USING currency::currency_code;
ALTER TABLE organization ALTER COLUMN currency SET DEFAULT 'AUD'::currency_code;

-- Migrate field_pricing.currency (default: USD)
ALTER TABLE field_pricing ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE field_pricing ALTER COLUMN currency TYPE currency_code USING currency::currency_code;
ALTER TABLE field_pricing ALTER COLUMN currency SET DEFAULT 'USD'::currency_code;

-- Migrate option_pricing.currency (default: USD)
ALTER TABLE option_pricing ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE option_pricing ALTER COLUMN currency TYPE currency_code USING currency::currency_code;
ALTER TABLE option_pricing ALTER COLUMN currency SET DEFAULT 'USD'::currency_code;

-- Migrate base_pricing.currency (default: USD)
ALTER TABLE base_pricing ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE base_pricing ALTER COLUMN currency TYPE currency_code USING currency::currency_code;
ALTER TABLE base_pricing ALTER COLUMN currency SET DEFAULT 'USD'::currency_code;

-- Migrate pricing_rule.currency (default: USD)
ALTER TABLE pricing_rule ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE pricing_rule ALTER COLUMN currency TYPE currency_code USING currency::currency_code;
ALTER TABLE pricing_rule ALTER COLUMN currency SET DEFAULT 'USD'::currency_code;

-- Migrate location.fixed_price_currency (default: USD)
ALTER TABLE location ALTER COLUMN fixed_price_currency DROP DEFAULT;
ALTER TABLE location ALTER COLUMN fixed_price_currency TYPE currency_code USING fixed_price_currency::currency_code;
ALTER TABLE location ALTER COLUMN fixed_price_currency SET DEFAULT 'USD'::currency_code;

-- Migrate service_pricing_mode.fixed_price_currency (default: USD)
ALTER TABLE service_pricing_mode ALTER COLUMN fixed_price_currency DROP DEFAULT;
ALTER TABLE service_pricing_mode ALTER COLUMN fixed_price_currency TYPE currency_code USING fixed_price_currency::currency_code;
ALTER TABLE service_pricing_mode ALTER COLUMN fixed_price_currency SET DEFAULT 'USD'::currency_code;

-- Migrate invoice.currency (default: USD)
ALTER TABLE invoice ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE invoice ALTER COLUMN currency TYPE currency_code USING currency::currency_code;
ALTER TABLE invoice ALTER COLUMN currency SET DEFAULT 'USD'::currency_code;
