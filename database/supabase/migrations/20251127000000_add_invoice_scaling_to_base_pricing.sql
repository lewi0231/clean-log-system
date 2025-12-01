-- -*- mode: sql; sql-product: postgres -*-
-- Add Invoice Scaling Support to Base Pricing
-- Allows base pricing to either add a fixed amount or multiply the invoice

-- Add adjustment_type column to support both 'add' and 'multiply' modes
ALTER TABLE base_pricing 
  ADD COLUMN IF NOT EXISTS adjustment_type TEXT DEFAULT 'add' 
  CHECK (adjustment_type IN ('add', 'multiply'));

-- Update existing records to use 'add' mode (backward compatibility)
UPDATE base_pricing SET adjustment_type = 'add' WHERE adjustment_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN base_pricing.adjustment_type IS 'add: add customer_base_price to invoice, multiply: multiply invoice by customer_base_price (as multiplier)';

-- Note: When adjustment_type = 'multiply', customer_base_price represents a multiplier (e.g., 1.2 = 20% increase, 0.9 = 10% decrease)
-- When adjustment_type = 'add', customer_base_price represents a fixed amount to add

