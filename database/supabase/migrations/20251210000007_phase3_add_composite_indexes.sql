-- -*- mode: sql; sql-product: postgres -*-
-- Phase 3: Add composite indexes for common query patterns

-- Jobs by organization and location (with filtering by completed_at)
CREATE INDEX IF NOT EXISTS idx_job_org_location_active 
ON job(organization_id, location_id, completed_at) 
WHERE location_id IS NOT NULL;

-- Pricing rules by organization, context, and active status
CREATE INDEX IF NOT EXISTS idx_pricing_rule_org_context_active 
ON pricing_rule(organization_id, pricing_context, active, effective_at) 
WHERE active = true;

-- Locations by organization and active status
CREATE INDEX IF NOT EXISTS idx_location_org_active 
ON location(organization_id, active) 
WHERE active = true;

-- Location hierarchy by organization and active status
CREATE INDEX IF NOT EXISTS idx_location_hierarchy_org_active 
ON location_hierarchy(organization_id, active) 
WHERE active = true;

-- Workers by organization and active status
CREATE INDEX IF NOT EXISTS idx_worker_org_active 
ON worker(organization_id, active) 
WHERE active = true;

