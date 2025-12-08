-- -*- mode: sql; sql-product: postgres -*-
-- Add auto-send invoice configuration to location_hierarchy metadata
-- This allows companies/regions to configure automatic invoice sending with different time periods

-- The configuration is stored in location_hierarchy.metadata as JSONB:
-- {
--   "auto_send_invoices": {
--     "enabled": true,
--     "period": "daily" | "weekly" | "monthly",
--     "day_of_week": 0-6 (optional, for weekly: 0=Sunday, 6=Saturday),
--     "day_of_month": 1-31 (optional, for monthly),
--     "time": "HH:mm" (optional, default "09:00", e.g., "09:00", "14:30")
--   }
-- }

-- Example configurations:
-- Daily at 9 AM:
-- {"auto_send_invoices": {"enabled": true, "period": "daily", "time": "09:00"}}
--
-- Weekly on Mondays at 10 AM:
-- {"auto_send_invoices": {"enabled": true, "period": "weekly", "day_of_week": 1, "time": "10:00"}}
--
-- Monthly on the 1st at 8 AM:
-- {"auto_send_invoices": {"enabled": true, "period": "monthly", "day_of_month": 1, "time": "08:00"}}

-- Note: The auto-send function (auto-send-invoices) should be scheduled via Supabase cron
-- Example cron schedule (commented out - not ready to run yet):
-- SELECT cron.schedule(
--   'auto-send-invoices',
--   '0 * * * *', -- Run every hour
--   $$
--   SELECT net.http_post(
--     url := 'https://<your-project-ref>.supabase.co/functions/v1/auto-send-invoices',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer <service-role-key>"}'::jsonb,
--     body := '{}'::jsonb
--   ) AS request_id;
--   $$
-- );

COMMENT ON COLUMN location_hierarchy.metadata IS 'Arbitrary metadata including auto_send_invoices configuration: {auto_send_invoices: {enabled: boolean, period: "daily"|"weekly"|"monthly", day_of_week?: number, day_of_month?: number, time?: string}}';

