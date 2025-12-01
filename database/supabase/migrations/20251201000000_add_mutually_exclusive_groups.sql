-- -*- mode: sql; sql-product: postgres -*-
-- Add mutually exclusive group support to field configs

ALTER TABLE organization_field_configs 
  ADD COLUMN IF NOT EXISTS mutually_exclusive_group TEXT,
  ADD COLUMN IF NOT EXISTS group_cluster TEXT;

-- Create index for efficient group queries
CREATE INDEX IF NOT EXISTS idx_field_configs_group 
ON organization_field_configs(organization_id, mutually_exclusive_group) 
WHERE mutually_exclusive_group IS NOT NULL;

-- Create index for efficient cluster queries
CREATE INDEX IF NOT EXISTS idx_field_configs_cluster 
ON organization_field_configs(organization_id, mutually_exclusive_group, group_cluster) 
WHERE mutually_exclusive_group IS NOT NULL AND group_cluster IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN organization_field_configs.mutually_exclusive_group IS 'Identifier for fields that are mutually exclusive. Only one cluster or field in a group can have values at a time.';
COMMENT ON COLUMN organization_field_configs.group_cluster IS 'Identifier for fields that work together within a mutually exclusive group. Fields with the same cluster can all have values simultaneously.';

