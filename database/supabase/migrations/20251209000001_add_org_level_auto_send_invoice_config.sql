-- -*- mode: sql; sql-product: postgres -*-
-- Add organization-level auto-send invoice configuration to organization_settings table
-- This allows organizations without location hierarchies to configure automatic invoice sending

-- The configuration is stored in organization_settings.auto_send_invoices_config as JSONB:
-- {
--   "enabled": true,
--   "period": "daily" | "weekly" | "monthly",
--   "day_of_week": 0-6 (optional, for weekly: 0=Sunday, 6=Saturday),
--   "day_of_month": 1-31 (optional, for monthly),
--   "time": "HH:mm" (optional, default "09:00", e.g., "09:00", "14:30")
-- }

-- Example configurations:
-- Daily at 9 AM:
-- {"enabled": true, "period": "daily", "time": "09:00"}
--
-- Weekly on Mondays at 10 AM:
-- {"enabled": true, "period": "weekly", "day_of_week": 1, "time": "10:00"}
--
-- Monthly on the 1st at 8 AM:
-- {"enabled": true, "period": "monthly", "day_of_month": 1, "time": "08:00"}

-- Note: This complements the location_hierarchy-level auto-send config.
-- If both are enabled, location_hierarchy config takes precedence for those locations.
-- Organization-level config applies to all invoices not covered by hierarchy-level config.

ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS auto_send_invoices_config JSONB DEFAULT NULL;

COMMENT ON COLUMN organization_settings.auto_send_invoices_config IS 'Organization-level auto-send invoice configuration: {enabled: boolean, period: "daily"|"weekly"|"monthly", day_of_week?: number, day_of_month?: number, time?: string}. Applies to invoices not covered by location_hierarchy auto-send config.';

