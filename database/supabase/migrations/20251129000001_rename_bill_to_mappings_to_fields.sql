-- -*- mode: sql; sql-product: postgres -*-
-- Rename bill_to_mappings column to bill_to_fields and migrate data
-- This migration handles the transition from object-based mappings to array-based fields

-- First, add the new column
ALTER TABLE invoice_template_config 
  ADD COLUMN IF NOT EXISTS bill_to_fields JSONB DEFAULT '[]';

-- Migrate existing data: convert bill_to_mappings object to bill_to_fields array
UPDATE invoice_template_config
SET bill_to_fields = (
  SELECT COALESCE(
    jsonb_agg(value),
    '[]'::jsonb
  )
  FROM jsonb_each_text(bill_to_mappings)
  WHERE value IS NOT NULL AND value != ''
)
WHERE bill_to_mappings IS NOT NULL AND bill_to_mappings != '{}'::jsonb;

-- Drop the old column
ALTER TABLE invoice_template_config 
  DROP COLUMN IF EXISTS bill_to_mappings;

-- Update comment
COMMENT ON COLUMN invoice_template_config.bill_to_fields IS 'JSONB array of field_config names to display in Bill To section on invoices';

