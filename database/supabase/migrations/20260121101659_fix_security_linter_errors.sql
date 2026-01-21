-- -*- mode: sql; sql-product: postgres -*-
-- Fix Supabase security linter errors:
-- 1. Remove SECURITY DEFINER from job_summary view
-- 2. Enable RLS on audit and infrastructure tables
-- 3. Add appropriate RLS policies

-- ============================================================================
-- Issue 1: Remove SECURITY DEFINER from job_summary view
-- ============================================================================
-- Drop the existing view and recreate without SECURITY DEFINER
-- SECURITY DEFINER can bypass RLS and user permissions, which is dangerous

DROP VIEW IF EXISTS job_summary;

CREATE VIEW job_summary AS
SELECT 
  cj.id as job_id,
  cj.organization_id,
  o.name as organization_name,
  w.name as worker_name,
  w.id as worker_id,
  l.name as location_name,
  cj.completed_at,
  f.rating,
  f.comment
FROM job cj
JOIN organization o ON cj.organization_id = o.id
JOIN job_worker jw ON cj.id = jw.job_id
JOIN worker w ON jw.worker_id = w.id
LEFT JOIN location l ON cj.location_id = l.id
LEFT JOIN feedback f ON cj.id = f.job_id
ORDER BY cj.completed_at DESC;

COMMENT ON VIEW job_summary IS 'Summary view of jobs with worker, organization, and feedback data';

-- ============================================================================
-- Issue 2: Enable RLS on pricing_rule_audit table
-- ============================================================================
-- Audit tables should have RLS enabled since they're in the public schema

ALTER TABLE pricing_rule_audit ENABLE ROW LEVEL SECURITY;

-- Service role has full access (needed for trigger functions)
CREATE POLICY "Service role can manage pricing_rule_audit"
  ON pricing_rule_audit
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Authenticated users can read audit logs (read-only for transparency)
-- Note: If you want to restrict this further, modify the policy below
CREATE POLICY "Authenticated users can read pricing_rule_audit"
  ON pricing_rule_audit
  FOR SELECT
  USING (auth.role() = 'authenticated');

COMMENT ON TABLE pricing_rule_audit IS 'Audit log for pricing_rule changes. RLS enabled for security.';

-- ============================================================================
-- Issue 3: Enable RLS on pricing_condition_audit table
-- ============================================================================

ALTER TABLE pricing_condition_audit ENABLE ROW LEVEL SECURITY;

-- Service role has full access (needed for trigger functions)
CREATE POLICY "Service role can manage pricing_condition_audit"
  ON pricing_condition_audit
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Authenticated users can read audit logs
CREATE POLICY "Authenticated users can read pricing_condition_audit"
  ON pricing_condition_audit
  FOR SELECT
  USING (auth.role() = 'authenticated');

COMMENT ON TABLE pricing_condition_audit IS 'Audit log for pricing_condition changes. RLS enabled for security.';

-- ============================================================================
-- Issue 4: Enable RLS on webhook_event table
-- ============================================================================
-- Infrastructure tables in public schema should have RLS enabled

ALTER TABLE webhook_event ENABLE ROW LEVEL SECURITY;

-- Service role has full access (edge functions need to write webhook events)
CREATE POLICY "Service role can manage webhook_event"
  ON webhook_event
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Authenticated admins can read webhook events for debugging
-- Note: Add organization_id if you need to filter by organization
CREATE POLICY "Authenticated users can read webhook_event"
  ON webhook_event
  FOR SELECT
  USING (auth.role() = 'authenticated');

COMMENT ON TABLE webhook_event IS 'Webhook event tracking for idempotency. RLS enabled for security.';

-- ============================================================================
-- Issue 5: Enable RLS on rate_limit table
-- ============================================================================

ALTER TABLE rate_limit ENABLE ROW LEVEL SECURITY;

-- Service role has full access (rate limiting is managed by edge functions)
CREATE POLICY "Service role can manage rate_limit"
  ON rate_limit
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- No read access for regular authenticated users (internal infrastructure only)

COMMENT ON TABLE rate_limit IS 'Rate limiting tracking table. RLS enabled, service role only.';

-- ============================================================================
-- Issue 6: Enable RLS on invoice_send_outbox table
-- ============================================================================

ALTER TABLE invoice_send_outbox ENABLE ROW LEVEL SECURITY;

-- Service role has full access (edge functions manage outbox processing)
CREATE POLICY "Service role can manage invoice_send_outbox"
  ON invoice_send_outbox
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Note: Currently no authenticated user read access since organization_user table
-- is email-based (no auth.uid() column). If you need dashboard visibility of
-- invoice send status, you'll need to add an auth_user_id column to organization_user
-- or handle this through edge functions with proper organization checks.

COMMENT ON TABLE invoice_send_outbox IS 'Outbox for invoice sending. RLS enabled, service role only.';
