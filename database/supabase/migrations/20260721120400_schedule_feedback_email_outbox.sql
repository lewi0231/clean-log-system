-- -*- mode: sql; sql-product: postgres -*-
-- Phase 3 ONLY — enable AFTER process-feedback-email-outbox Edge is deployed
-- and CRON_SHARED_SECRET is set on the Edge function secrets.
--
-- Path selection (S4 P4):
--   Path A: Uncomment the pg_cron + pg_net block below when both extensions exist:
--     SELECT extname FROM pg_extension WHERE extname IN ('pg_cron','pg_net');
--   Path B (default for fresh local / when extensions unavailable):
--     Supabase Dashboard → Edge Functions → Schedules → every 5 minutes
--     POST .../functions/v1/process-feedback-email-outbox
--     Headers: Authorization: Bearer <service_role_or_anon>, x-cron-secret: <CRON_SHARED_SECRET>
--
-- ROLLBACK (Path A): SELECT cron.unschedule('process-feedback-email-outbox');
-- ROLLBACK (Path B): Delete the Dashboard schedule.

-- ---------------------------------------------------------------------------
-- Path A template (DO NOT enable blindly — requires pg_cron + pg_net + vault/secret):
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- SELECT cron.schedule(
--   'process-feedback-email-outbox',
--   '*/5 * * * *',
--   $$
--   SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/process-feedback-email-outbox',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
--       'x-cron-secret', current_setting('app.settings.cron_shared_secret')
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'feedback email outbox schedule: use Path B (Dashboard) or uncomment Path A after confirming pg_cron/pg_net + secrets';
END $$;
