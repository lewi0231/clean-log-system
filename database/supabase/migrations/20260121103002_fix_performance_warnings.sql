-- -*- mode: sql; sql-product: postgres -*-
-- Fix Supabase performance linter warnings:
-- 1. Optimize auth function calls in RLS policies (wrap with select)
-- 2. Consolidate multiple permissive policies
-- 3. Remove duplicate indexes

-- ============================================================================
-- PART 1: Optimize RLS policies - wrap auth functions with select
-- ============================================================================
-- Performance issue: auth.jwt() and auth.role() are re-evaluated for each row
-- Fix: Wrap with (select ...) to evaluate once per query instead
-- Note: Must use lowercase 'select' for Postgres optimizer to recognize pattern

-- Organization
DROP POLICY IF EXISTS "Service role can manage organization" ON organization;
CREATE POLICY "Service role can manage organization"
  ON organization FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Organization User
DROP POLICY IF EXISTS "Service role can manage organization_user" ON organization_user;
CREATE POLICY "Service role can manage organization_user"
  ON organization_user FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Worker - consolidate two SELECT policies
DROP POLICY IF EXISTS "Service role can manage worker" ON worker;
DROP POLICY IF EXISTS "Workers can view own record" ON worker;
CREATE POLICY "Service role and authenticated can view worker"
  ON worker FOR SELECT
  USING (
    (select auth.jwt() ->> 'role') = 'service_role'
    OR (select auth.role()) = 'authenticated'
  );
CREATE POLICY "Service role can modify worker"
  ON worker FOR INSERT
  WITH CHECK ((select auth.jwt() ->> 'role') = 'service_role');
CREATE POLICY "Service role can update worker"
  ON worker FOR UPDATE
  USING ((select auth.jwt() ->> 'role') = 'service_role');
CREATE POLICY "Service role can delete worker"
  ON worker FOR DELETE
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Job
DROP POLICY IF EXISTS "Service role can manage job" ON job;
CREATE POLICY "Service role can manage job"
  ON job FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Job Worker
DROP POLICY IF EXISTS "Service role can manage job_worker" ON job_worker;
CREATE POLICY "Service role can manage job_worker"
  ON job_worker FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Feedback
DROP POLICY IF EXISTS "Service role can read feedback" ON feedback;
CREATE POLICY "Service role can read feedback"
  ON feedback FOR SELECT
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Location
DROP POLICY IF EXISTS "Service role can manage location" ON location;
CREATE POLICY "Service role can manage location"
  ON location FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Organization Field Configs
DROP POLICY IF EXISTS "Service role can manage organization_field_configs" ON organization_field_configs;
CREATE POLICY "Service role can manage organization_field_configs"
  ON organization_field_configs FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Field Pricing
DROP POLICY IF EXISTS "Service role can manage field_pricing" ON field_pricing;
CREATE POLICY "Service role can manage field_pricing"
  ON field_pricing FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Option Pricing
DROP POLICY IF EXISTS "Service role can manage option_pricing" ON option_pricing;
CREATE POLICY "Service role can manage option_pricing"
  ON option_pricing FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Base Pricing
DROP POLICY IF EXISTS "Service role can manage base_pricing" ON base_pricing;
CREATE POLICY "Service role can manage base_pricing"
  ON base_pricing FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Service Pricing Mode
DROP POLICY IF EXISTS "Service role can manage service_pricing_mode" ON service_pricing_mode;
CREATE POLICY "Service role can manage service_pricing_mode"
  ON service_pricing_mode FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Organization Settings
DROP POLICY IF EXISTS "Service role can manage organization_settings" ON organization_settings;
CREATE POLICY "Service role can manage organization_settings"
  ON organization_settings FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Invoice
DROP POLICY IF EXISTS "Service role can manage invoice" ON invoice;
CREATE POLICY "Service role can manage invoice"
  ON invoice FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Invoice Job
DROP POLICY IF EXISTS "Service role can manage invoice_job" ON invoice_job;
CREATE POLICY "Service role can manage invoice_job"
  ON invoice_job FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Invoice Template Config
DROP POLICY IF EXISTS "Service role can manage invoice_template_config" ON invoice_template_config;
CREATE POLICY "Service role can manage invoice_template_config"
  ON invoice_template_config FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Location Hierarchy
DROP POLICY IF EXISTS "Service role can manage location_hierarchy" ON location_hierarchy;
CREATE POLICY "Service role can manage location_hierarchy"
  ON location_hierarchy FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Pricing Rule
DROP POLICY IF EXISTS "Service role can manage pricing_rule" ON pricing_rule;
CREATE POLICY "Service role can manage pricing_rule"
  ON pricing_rule FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Pricing Condition
DROP POLICY IF EXISTS "Service role can manage pricing_condition" ON pricing_condition;
CREATE POLICY "Service role can manage pricing_condition"
  ON pricing_condition FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Pricing Snapshot
DROP POLICY IF EXISTS "Service role can manage pricing_snapshot" ON pricing_snapshot;
CREATE POLICY "Service role can manage pricing_snapshot"
  ON pricing_snapshot FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Job Edits
DROP POLICY IF EXISTS "Service role can manage job_edits" ON job_edits;
CREATE POLICY "Service role can manage job_edits"
  ON job_edits FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Payment
DROP POLICY IF EXISTS "Service role can manage payment" ON payment;
CREATE POLICY "Service role can manage payment"
  ON payment FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Payment Link
DROP POLICY IF EXISTS "Service role can manage payment_link" ON payment_link;
CREATE POLICY "Service role can manage payment_link"
  ON payment_link FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Worker Payment Batch
DROP POLICY IF EXISTS "Service role can manage worker_payment_batch" ON worker_payment_batch;
CREATE POLICY "Service role can manage worker_payment_batch"
  ON worker_payment_batch FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Location Field Config
DROP POLICY IF EXISTS "Service role can manage location_field_config" ON location_field_config;
CREATE POLICY "Service role can manage location_field_config"
  ON location_field_config FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Worker Payment
DROP POLICY IF EXISTS "Service role can manage worker_payment" ON worker_payment;
CREATE POLICY "Service role can manage worker_payment"
  ON worker_payment FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Form Section (multiple policies - use lowercase select)
DROP POLICY IF EXISTS "Users can view their organization's sections" ON form_section;
CREATE POLICY "Users can view their organization's sections"
  ON form_section FOR SELECT
  USING ((select auth.jwt() ->> 'role') = 'authenticated');

DROP POLICY IF EXISTS "Users can create sections for their organization" ON form_section;
CREATE POLICY "Users can create sections for their organization"
  ON form_section FOR INSERT
  WITH CHECK ((select auth.jwt() ->> 'role') = 'authenticated');

DROP POLICY IF EXISTS "Users can update their organization's sections" ON form_section;
CREATE POLICY "Users can update their organization's sections"
  ON form_section FOR UPDATE
  USING ((select auth.jwt() ->> 'role') = 'authenticated');

DROP POLICY IF EXISTS "Users can delete their organization's sections" ON form_section;
CREATE POLICY "Users can delete their organization's sections"
  ON form_section FOR DELETE
  USING ((select auth.jwt() ->> 'role') = 'authenticated');

-- Notification
DROP POLICY IF EXISTS "Service role can manage notification" ON notification;
CREATE POLICY "Service role can manage notification"
  ON notification FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Worker Rate Card
DROP POLICY IF EXISTS "Service role can manage worker_rate_card" ON worker_rate_card;
CREATE POLICY "Service role can manage worker_rate_card"
  ON worker_rate_card FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Worker Payment Allocation
DROP POLICY IF EXISTS "Service role can manage worker_payment_allocation" ON worker_payment_allocation;
CREATE POLICY "Service role can manage worker_payment_allocation"
  ON worker_payment_allocation FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Worker Rate Card Field
DROP POLICY IF EXISTS "Service role can manage worker_rate_card_field" ON worker_rate_card_field;
CREATE POLICY "Service role can manage worker_rate_card_field"
  ON worker_rate_card_field FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- ============================================================================
-- PART 2: Consolidate multiple permissive policies on audit/infrastructure tables
-- ============================================================================

-- Pricing Rule Audit
DROP POLICY IF EXISTS "Service role can manage pricing_rule_audit" ON pricing_rule_audit;
DROP POLICY IF EXISTS "Authenticated users can read pricing_rule_audit" ON pricing_rule_audit;
DROP POLICY IF EXISTS "Service role full access and authenticated read on pricing_rule_audit" ON pricing_rule_audit;

CREATE POLICY "Service role and authenticated read pricing_rule_audit"
  ON pricing_rule_audit
  FOR ALL
  USING (
    (select auth.jwt() ->> 'role') = 'service_role'
    OR ((select auth.role()) = 'authenticated' AND true)
  )
  WITH CHECK ((select auth.jwt() ->> 'role') = 'service_role');

-- Pricing Condition Audit
DROP POLICY IF EXISTS "Service role can manage pricing_condition_audit" ON pricing_condition_audit;
DROP POLICY IF EXISTS "Authenticated users can read pricing_condition_audit" ON pricing_condition_audit;
DROP POLICY IF EXISTS "Service role full access and authenticated read on pricing_condition_audit" ON pricing_condition_audit;

CREATE POLICY "Service role and authenticated read pricing_condition_audit"
  ON pricing_condition_audit
  FOR ALL
  USING (
    (select auth.jwt() ->> 'role') = 'service_role'
    OR ((select auth.role()) = 'authenticated' AND true)
  )
  WITH CHECK ((select auth.jwt() ->> 'role') = 'service_role');

-- Webhook Event
DROP POLICY IF EXISTS "Service role can manage webhook_event" ON webhook_event;
DROP POLICY IF EXISTS "Authenticated users can read webhook_event" ON webhook_event;
DROP POLICY IF EXISTS "Service role full access and authenticated read on webhook_event" ON webhook_event;

CREATE POLICY "Service role and authenticated read webhook_event"
  ON webhook_event
  FOR ALL
  USING (
    (select auth.jwt() ->> 'role') = 'service_role'
    OR ((select auth.role()) = 'authenticated' AND true)
  )
  WITH CHECK ((select auth.jwt() ->> 'role') = 'service_role');

-- Rate Limit (keep service role only)
DROP POLICY IF EXISTS "Service role can manage rate_limit" ON rate_limit;
CREATE POLICY "Service role can manage rate_limit"
  ON rate_limit FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- Invoice Send Outbox (keep service role only)
DROP POLICY IF EXISTS "Service role can manage invoice_send_outbox" ON invoice_send_outbox;
CREATE POLICY "Service role can manage invoice_send_outbox"
  ON invoice_send_outbox FOR ALL
  USING ((select auth.jwt() ->> 'role') = 'service_role');

-- ============================================================================
-- PART 3: Remove duplicate indexes
-- ============================================================================

-- Job table: Remove idx_job_token (keep idx_job_feedback_token)
DROP INDEX IF EXISTS idx_job_token;

-- Organization Settings: Remove idx_organization_settings_org (keep idx_organization_settings_org_id)
DROP INDEX IF EXISTS idx_organization_settings_org;

-- Webhook Event: Keep UNIQUE constraint, drop redundant index
DROP INDEX IF EXISTS idx_webhook_event_id;
