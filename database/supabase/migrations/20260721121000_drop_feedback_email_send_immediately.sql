-- -*- mode: sql; sql-product: postgres -*-
-- Phase 2 ONLY — run after Edge + dashboard read feedback_auto_send exclusively
-- (rg gate: zero matches outside migrations/docs).
-- ROLLBACK: ADD COLUMN feedback_email_send_immediately BOOLEAN DEFAULT false;
--           UPDATE organization SET feedback_email_send_immediately = feedback_auto_send;

ALTER TABLE public.organization
  DROP COLUMN IF EXISTS feedback_email_send_immediately;
