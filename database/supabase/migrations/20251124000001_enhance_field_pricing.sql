-- -*- mode: sql; sql-product: postgres -*-
-- Enhance Field Pricing Table
-- Add support for all field types, location overrides, and worker payments

-- Step 1: Drop the existing unique constraint
ALTER TABLE field_pricing DROP CONSTRAINT IF EXISTS field_pricing_organization_id_field_config_id_key;

-- Step 2: Add new columns
ALTER TABLE field_pricing 
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES location(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS pricing_type TEXT DEFAULT 'unit' CHECK (pricing_type IN ('unit', 'fixed')),
  ADD COLUMN IF NOT EXISTS applies_to_field_type TEXT,
  ADD COLUMN IF NOT EXISTS worker_payment_type TEXT CHECK (worker_payment_type IN ('same_structure', 'percentage', 'fixed_rate')),
  ADD COLUMN IF NOT EXISTS worker_payment_value DECIMAL(10, 2) CHECK (worker_payment_value >= 0);

-- Step 3: Rename unit_price to customer_price for clarity
ALTER TABLE field_pricing RENAME COLUMN unit_price TO customer_price;

-- Step 4: Create new unique constraint that allows location overrides
-- Use a sentinel UUID for NULL location_id to allow unique constraint
CREATE UNIQUE INDEX idx_field_pricing_unique 
  ON field_pricing(
    organization_id, 
    field_config_id, 
    COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- Step 5: Add index for location-based queries
CREATE INDEX IF NOT EXISTS idx_field_pricing_location ON field_pricing(location_id);

-- Step 6: Update applies_to_field_type for existing records (assume they're number type)
UPDATE field_pricing SET applies_to_field_type = 'number' WHERE applies_to_field_type IS NULL;

-- Step 7: Add comment for documentation
COMMENT ON COLUMN field_pricing.pricing_type IS 'unit: multiply by quantity, fixed: one-time charge';
COMMENT ON COLUMN field_pricing.applies_to_field_type IS 'Field type this pricing applies to: number, select, grouped_breakdown, boolean';
COMMENT ON COLUMN field_pricing.worker_payment_type IS 'same_structure: use same pricing rules, percentage: % of customer price, fixed_rate: independent rate';
COMMENT ON COLUMN field_pricing.worker_payment_value IS 'Percentage (0-100) or fixed rate amount depending on worker_payment_type';

