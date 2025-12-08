-- -*- mode: sql; sql-product: postgres -*-
-- Add default_exclusive_group_label column to organization table
-- This allows customizing the label used for the default exclusive group in the mobile app

ALTER TABLE organization 
  ADD COLUMN IF NOT EXISTS default_exclusive_group_label TEXT;

-- Add comment for documentation
COMMENT ON COLUMN organization.default_exclusive_group_label IS 
  'Custom label for the default_exclusive_group used in mobile app dropdowns. If not set, a default label is generated from the group ID.';

