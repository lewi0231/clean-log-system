-- -*- mode: sql; sql-product: postgres -*-
-- Add fixed pricing support to location table
-- Allows locations to have fixed prices independent of field configs

ALTER TABLE location 
  ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT 'field_based' 
  CHECK (pricing_mode IN ('field_based', 'fixed_price')),
  ADD COLUMN IF NOT EXISTS fixed_customer_price DECIMAL(12, 4),
  ADD COLUMN IF NOT EXISTS fixed_worker_payment DECIMAL(12, 4),
  ADD COLUMN IF NOT EXISTS fixed_price_currency TEXT DEFAULT 'USD';

-- Update existing records to default to 'field_based' (backward compatibility)
UPDATE location 
SET pricing_mode = 'field_based' 
WHERE pricing_mode IS NULL;

-- Add index for efficient filtering by pricing mode
CREATE INDEX IF NOT EXISTS idx_location_pricing_mode 
ON location(organization_id, pricing_mode) 
WHERE pricing_mode = 'fixed_price';

-- Add constraint to ensure fixed_price locations have prices set
ALTER TABLE location 
  ADD CONSTRAINT location_fixed_price_check 
  CHECK (
    (pricing_mode = 'field_based') OR 
    (pricing_mode = 'fixed_price' AND fixed_customer_price IS NOT NULL)
  );

COMMENT ON COLUMN location.pricing_mode IS 'field_based: pricing calculated from field configs. fixed_price: uses fixed_customer_price regardless of field data.';
COMMENT ON COLUMN location.fixed_customer_price IS 'Fixed price for customer invoicing when pricing_mode is fixed_price. Field config data is still collected for operational purposes.';
COMMENT ON COLUMN location.fixed_worker_payment IS 'Fixed payment amount for workers when pricing_mode is fixed_price. NULL means no worker payment.';
COMMENT ON COLUMN location.fixed_price_currency IS 'Currency for fixed pricing. Defaults to USD.';

