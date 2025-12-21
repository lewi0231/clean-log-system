-- -*- mode: sql; sql-product: postgres -*-
-- Add worker payment cycle configuration to organization_settings table
-- This allows organizations to configure payment cycles for worker payments

-- The configuration is stored in organization_settings.worker_payment_cycle_config as JSONB:
-- {
--   "payment_frequency": "weekly" | "fortnightly" | "monthly",
--   "payment_day_of_week": 0-6 (optional, for weekly/fortnightly: 0=Monday, 6=Sunday),
--   "payment_day_of_month": 1-31 (optional, for monthly),
--   "cut_off_time": "HH:mm:ss" (optional, default "17:00:00"),
--   "require_approval": true | false (optional, default true),
--   "auto_calculate": true | false (optional, default false)
-- }

-- Example configurations:
-- Weekly, payments on Friday, cut-off 5pm:
-- {"payment_frequency": "weekly", "payment_day_of_week": 4, "cut_off_time": "17:00:00", "require_approval": true}

-- Fortnightly, payments on Friday:
-- {"payment_frequency": "fortnightly", "payment_day_of_week": 4, "require_approval": true}

-- Monthly, payments on last business day:
-- {"payment_frequency": "monthly", "payment_day_of_month": -1, "require_approval": true}

-- Add column to organization_settings table
ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS worker_payment_cycle_config JSONB DEFAULT NULL;

COMMENT ON COLUMN organization_settings.worker_payment_cycle_config IS 'Worker payment cycle configuration: {payment_frequency: "weekly"|"fortnightly"|"monthly", payment_day_of_week?: number, payment_day_of_month?: number, cut_off_time?: string, require_approval?: boolean, auto_calculate?: boolean}. All cycles start on Monday.';

