-- -*- mode: sql; sql-product: postgres -*-
-- Phase 3: Add unique constraints to prevent duplicates

-- Case-insensitive unique field config names per organization (for active configs only)
-- This prevents duplicate active field configs with the same name (case-insensitive).
-- Archived/deleted configs can have the same name.
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_field_configs_name_unique_ci
ON organization_field_configs(organization_id, LOWER(name))
WHERE active = true;

