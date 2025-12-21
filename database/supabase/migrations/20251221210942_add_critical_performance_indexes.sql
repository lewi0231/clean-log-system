-- -*- mode: sql; sql-product: postgres -*-
-- Add critical performance indexes for common query patterns
-- Based on codebase review recommendations

-- Invoice queries: Filter by organization, status, and date range
CREATE INDEX IF NOT EXISTS idx_invoice_org_status_created 
ON invoice(organization_id, status, created_at) 
WHERE status IN ('draft', 'sent', 'paid', 'overdue');

-- Invoice queries: Filter by organization and date range (for reporting)
CREATE INDEX IF NOT EXISTS idx_invoice_org_created 
ON invoice(organization_id, created_at DESC);

-- Payment queries: Filter by organization, status, and date
CREATE INDEX IF NOT EXISTS idx_payment_org_status_created 
ON payment(organization_id, status, created_at DESC);

-- Payment queries: Lookup by invoice
CREATE INDEX IF NOT EXISTS idx_payment_invoice 
ON payment(invoice_id) 
WHERE invoice_id IS NOT NULL;

-- Payment link queries: Lookup by Stripe checkout session ID (for webhooks)
CREATE INDEX IF NOT EXISTS idx_payment_link_stripe_session 
ON payment_link(stripe_checkout_session_id) 
WHERE stripe_checkout_session_id IS NOT NULL;

-- Job queries: Filter by organization and completion date (for date ranges)
CREATE INDEX IF NOT EXISTS idx_job_org_completed 
ON job(organization_id, completed_at DESC);

-- Worker payment queries: Filter by organization and status
CREATE INDEX IF NOT EXISTS idx_worker_payment_org_status 
ON worker_payment(organization_id, status, created_at DESC);

-- Worker payment batch queries: Filter by organization and status
CREATE INDEX IF NOT EXISTS idx_worker_payment_batch_org_status 
ON worker_payment_batch(organization_id, status, calculated_at DESC);

-- Invoice job junction: For invoice details queries
CREATE INDEX IF NOT EXISTS idx_invoice_job_invoice 
ON invoice_job(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_job_job 
ON invoice_job(job_id);

-- Pricing rule queries: Filter by organization, context, and effective dates
-- (Note: idx_pricing_rule_org_context_active already exists, but adding date index)
CREATE INDEX IF NOT EXISTS idx_pricing_rule_effective_dates 
ON pricing_rule(organization_id, effective_at, expires_at) 
WHERE active = true;

-- Location hierarchy: For auto-send invoice queries
CREATE INDEX IF NOT EXISTS idx_location_hierarchy_org_type_active 
ON location_hierarchy(organization_id, type, active) 
WHERE active = true;

-- Location: For auto-send invoice location lookups
CREATE INDEX IF NOT EXISTS idx_location_hierarchy_parent 
ON location(hierarchy_parent_id) 
WHERE hierarchy_parent_id IS NOT NULL;

-- Organization settings: For auto-send config lookups
CREATE INDEX IF NOT EXISTS idx_organization_settings_org 
ON organization_settings(organization_id);

COMMENT ON INDEX idx_invoice_org_status_created IS 'Optimizes invoice filtering by organization, status, and creation date';
COMMENT ON INDEX idx_payment_org_status_created IS 'Optimizes payment filtering by organization, status, and creation date';
COMMENT ON INDEX idx_payment_link_stripe_session IS 'Optimizes webhook lookups by Stripe checkout session ID';
COMMENT ON INDEX idx_job_org_completed IS 'Optimizes job queries by organization and completion date';
COMMENT ON INDEX idx_worker_payment_org_status IS 'Optimizes worker payment queries by organization and status';

