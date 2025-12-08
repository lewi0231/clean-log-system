# Database Schema Review and Recommendations

**Project ID:** mjsejwgrzwuqvhgleqjd  
**Review Date:** 2025-01-XX  
**Reviewer:** AI Assistant

## Executive Summary

This review evaluates the database schema for the Clean Log System SaaS platform, focusing on data modeling best practices, consistency, performance, and maintainability. The schema is generally well-structured with good multi-tenancy support, but several improvements are recommended for production readiness.

**Overall Assessment:** ⚠️ **Good with Improvements Needed**

---

## Critical Issues (Priority: High)

### 1. **Duplicate Pricing Tables** 🔴

**Issue:** Two pricing tables exist:

- `pricing_rules` (old, legacy - created Nov 24, 2024)
- `pricing_rule` (new unified - created Dec 2, 2024)

**Impact:**

- Confusion for developers
- Potential data inconsistency
- Increased maintenance burden
- The old `pricing_rules` table is currently empty

**Recommendation:**

```sql
-- Step 1: Verify no code references pricing_rules
-- Step 2: Create migration to drop pricing_rules table
DROP TABLE IF EXISTS pricing_rules CASCADE;
```

**Migration Strategy:**

1. Confirm no application code references `pricing_rules`
2. Verify edge functions use `pricing_rule` only
3. Create migration to remove `pricing_rules` table
4. Update any remaining documentation

---

### 2. **Missing NOT NULL Constraints** 🟡

**Issue:** Critical columns allow NULL values when they should be required.

**Affected Tables:**

- `invoice.invoice_number` - Should be NOT NULL (already has unique constraint)
- `job.location_id` - Jobs should always have a location
- `location.organization_id` - Should be NOT NULL (has FK but nullable in check)

**Recommendation:**

```sql
-- Job location should be required
ALTER TABLE job ALTER COLUMN location_id SET NOT NULL;

-- Invoice number should be explicitly NOT NULL
ALTER TABLE invoice ALTER COLUMN invoice_number SET NOT NULL;
```

**Note:** Before applying to `job.location_id`, ensure all existing jobs have a location or migrate legacy data.

---

### 3. **RLS Inconsistencies** 🟡

**Issue:** Some tables have RLS disabled that should have it enabled for security.

**Affected Tables:**

- `location_field_config` - RLS disabled
- `service_pricing_mode` - RLS disabled
- `organization_settings` - RLS disabled
- `pricing_rule_audit` - RLS disabled (may be intentional)
- `pricing_condition_audit` - RLS disabled (may be intentional)

**Recommendation:**

```sql
-- Enable RLS on tables that need it
ALTER TABLE location_field_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_pricing_mode ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

-- Add appropriate policies
CREATE POLICY "Service role can manage location_field_config"
ON location_field_config FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage service_pricing_mode"
ON service_pricing_mode FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage organization_settings"
ON organization_settings FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');
```

**Note:** Audit tables may intentionally have RLS disabled to prevent tampering.

---

## Schema Design Issues (Priority: Medium)

### 4. **Inconsistent Naming Conventions** 🟡

**Issue:** Mixed naming patterns throughout schema.

**Examples:**

- Foreign key names: `car_yard_organization_id_fkey` (legacy name, table is now `location`)
- Table names: Mix of singular/plural (`pricing_rule` vs `pricing_rules`)
- Index names: Some use `idx_` prefix, others don't (though most do)

**Recommendation:**

```sql
-- Rename legacy foreign key constraints
ALTER TABLE location
  RENAME CONSTRAINT car_yard_organization_id_fkey
  TO location_organization_id_fkey;

ALTER TABLE location
  RENAME CONSTRAINT car_yard_pkey
  TO location_pkey;
```

**Future Standard:**

- Use singular table names: `pricing_rule`, `field_config` (not `pricing_rules`)
- Foreign keys: `{table}_{column}_fkey`
- Indexes: `idx_{table}_{column(s)}`

---

### 5. **Missing Updated_at Triggers** 🟡

**Issue:** Not all tables with `updated_at` columns have automatic triggers.

**Affected Tables:**

- `form_section` - Has `updated_at` but no trigger
- `location_hierarchy` - Has `updated_at` but no trigger
- `pricing_rule` - Has `updated_at` but no trigger
- `pricing_condition` - Has `updated_at` but no trigger

**Current Triggers:** Only audit triggers exist

**Recommendation:**

```sql
-- Create generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_form_section_updated_at
  BEFORE UPDATE ON form_section
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_location_hierarchy_updated_at
  BEFORE UPDATE ON location_hierarchy
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_rule_updated_at
  BEFORE UPDATE ON pricing_rule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_condition_updated_at
  BEFORE UPDATE ON pricing_condition
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### 6. **Currency Data Type Inconsistency** 🟡

**Issue:** Currency stored as TEXT with CHECK constraints instead of standardized approach.

**Current State:**

- `organization.currency` - TEXT with CHECK constraint (AUD, USD, GBP, EUR, CAD, NZD)
- `field_pricing.currency` - TEXT DEFAULT 'USD'
- `option_pricing.currency` - TEXT DEFAULT 'USD'
- `base_pricing.currency` - TEXT DEFAULT 'USD'
- `pricing_rule.currency` - TEXT DEFAULT 'USD'
- `location.fixed_price_currency` - TEXT DEFAULT 'USD'

**Recommendation:**

```sql
-- Create currency enum type
CREATE TYPE currency_code AS ENUM (
  'AUD', 'USD', 'GBP', 'EUR', 'CAD', 'NZD'
);

-- Migrate columns to use enum (incrementally)
ALTER TABLE organization
  ALTER COLUMN currency TYPE currency_code
  USING currency::currency_code;

-- Future: Apply to other tables as needed
-- Note: This is a breaking change - coordinate with application code
```

**Alternative:** Keep TEXT but ensure all CHECK constraints match and use organization default consistently.

---

### 7. **Missing Composite Indexes** 🟡

**Issue:** Some common query patterns may benefit from composite indexes.

**Recommendations:**

```sql
-- Common query: Get active jobs by organization and location
CREATE INDEX IF NOT EXISTS idx_job_org_location_active
ON job(organization_id, location_id, completed_at)
WHERE location_id IS NOT NULL;

-- Common query: Get pricing rules by organization, context, and active status
CREATE INDEX IF NOT EXISTS idx_pricing_rule_org_context_active
ON pricing_rule(organization_id, pricing_context, active, effective_at)
WHERE active = true;

-- Common query: Field configs by organization and active status with ordering
-- Already exists: idx_organization_field_configs_active

-- Common query: Locations by organization and active status
CREATE INDEX IF NOT EXISTS idx_location_org_active
ON location(organization_id, active)
WHERE active = true;
```

---

### 8. **Missing Unique Constraints** 🟡

**Issue:** Some tables could benefit from additional unique constraints to prevent duplicates.

**Recommendations:**

```sql
-- Prevent duplicate service pricing modes
-- Already exists: idx_service_pricing_mode_unique ✓

-- Prevent duplicate worker invitations for same org/worker
-- Already exists: worker_invitation_organization_id_worker_id_key ✓

-- Consider: Prevent duplicate field config names per organization (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_field_configs_name_unique_ci
ON organization_field_configs(organization_id, LOWER(name))
WHERE active = true;
```

---

## Data Integrity Improvements (Priority: Medium)

### 9. **Foreign Key Constraint Gaps** 🟡

**Issue:** Some relationships could benefit from explicit foreign key constraints.

**Recommendations:**

```sql
-- pricing_rule.created_by and updated_by should reference users if possible
-- Note: Currently these reference auth.users, which may not be in public schema
-- If organization_user.id is meant, add FK:
-- ALTER TABLE pricing_rule
--   ADD CONSTRAINT pricing_rule_created_by_fkey
--   FOREIGN KEY (created_by) REFERENCES organization_user(id);

-- worker.auth_user_id - verify this references auth.users correctly
-- If not, consider adding FK if auth.users is accessible
```

---

### 10. **Check Constraint Improvements** 🟢

**Issue:** Some columns could benefit from additional validation.

**Recommendations:**

```sql
-- Ensure email addresses are valid format (basic check)
ALTER TABLE organization_user
  ADD CONSTRAINT check_email_format
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE worker
  ADD CONSTRAINT check_worker_email_format
  CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE location
  ADD CONSTRAINT check_location_email_format
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Ensure numeric fields are non-negative where appropriate
-- Most already have this, verify all pricing fields do
```

---

## Performance Optimizations (Priority: Low)

### 11. **Missing Partial Indexes** 🟢

**Issue:** Some queries filter by active/status fields that could use partial indexes.

**Recommendations:**

```sql
-- Most critical indexes already exist
-- Consider adding for location hierarchy:
CREATE INDEX IF NOT EXISTS idx_location_hierarchy_org_active
ON location_hierarchy(organization_id, active)
WHERE active = true;

-- For workers:
CREATE INDEX IF NOT EXISTS idx_worker_org_active
ON worker(organization_id, active)
WHERE active = true;
```

---

### 12. **JSONB Indexing Opportunities** 🟢

**Issue:** JSONB columns may benefit from GIN indexes for query performance.

**Recommendations:**

```sql
-- If querying specific keys in submission_data frequently:
CREATE INDEX IF NOT EXISTS idx_job_submission_data_gin
ON job USING GIN (submission_data);

-- If querying metadata in pricing_rule:
CREATE INDEX IF NOT EXISTS idx_pricing_rule_metadata_gin
ON pricing_rule USING GIN (metadata);

-- If querying tier_definition:
CREATE INDEX IF NOT EXISTS idx_pricing_rule_tier_definition_gin
ON pricing_rule USING GIN (tier_definition);
```

**Note:** Only add these if queries actually filter/search within JSONB fields.

---

## Documentation Improvements (Priority: Low)

### 13. **Missing Table Comments** 🟢

**Issue:** Several tables lack descriptive comments.

**Recommendations:**

```sql
COMMENT ON TABLE base_pricing IS 'Base pricing configuration for job types or standalone services';
COMMENT ON TABLE field_pricing IS 'Per-unit or fixed pricing for field configurations';
COMMENT ON TABLE option_pricing IS 'Pricing for select field options';
COMMENT ON TABLE job_worker IS 'Many-to-many relationship between jobs and assigned workers';
COMMENT ON TABLE worker IS 'Workers who complete jobs for organizations';
COMMENT ON TABLE location IS 'Physical locations (customers/sites) where jobs are performed';
COMMENT ON TABLE worker_invitation IS 'Pending invitations for workers to join organizations';
```

---

### 14. **Missing Column Comments** 🟢

**Issue:** Some complex columns lack explanations.

**Recommendations:**

```sql
COMMENT ON COLUMN job.submission_data IS 'JSONB containing all field values submitted by workers during job completion';
COMMENT ON COLUMN organization_field_configs.conditional_logic IS 'JSON structure defining when this field should be visible based on other field values';
COMMENT ON COLUMN location.pricing_mode IS 'field_based: pricing from field configs. fixed_price: uses fixed_customer_price';
```

---

## Recommended Migration Plan

### Phase 1: Critical Fixes (Week 1)

1. ✅ Remove `pricing_rules` table (after verification)
2. ✅ Add NOT NULL constraints where appropriate
3. ✅ Enable RLS on missing tables

### Phase 2: Consistency Improvements (Week 2)

4. ✅ Rename legacy foreign key constraints
5. ✅ Add updated_at triggers
6. ✅ Standardize currency handling (if creating enum)

### Phase 3: Performance & Integrity (Week 3)

7. ✅ Add composite indexes
8. ✅ Add missing unique constraints
9. ✅ Add check constraints for data validation

### Phase 4: Documentation (Week 4)

10. ✅ Add table and column comments
11. ✅ Review and update schema documentation

---

## Summary of Tables Reviewed

### Core Tables ✅

- `organization` - Good structure
- `organization_user` - Good structure
- `location` - Good structure (rename legacy FKs)
- `worker` - Good structure
- `job` - Good structure (make location_id NOT NULL)

### Pricing Tables ✅

- `pricing_rule` - Excellent unified design
- `pricing_condition` - Good structure
- `pricing_rules` - **DEPRECATE** (legacy, empty)
- `base_pricing` - Good structure
- `field_pricing` - Good structure
- `option_pricing` - Good structure
- `pricing_snapshot` - Good audit structure
- `pricing_rule_audit` - Good audit structure
- `pricing_condition_audit` - Good audit structure

### Configuration Tables ✅

- `organization_field_configs` - Excellent structure
- `form_section` - Good structure
- `location_field_config` - Good structure (enable RLS)
- `service_pricing_mode` - Good structure (enable RLS)
- `organization_settings` - Good structure (enable RLS)
- `invoice_template_config` - Good structure

### Invoice Tables ✅

- `invoice` - Good structure
- `invoice_job` - Good junction table

### Hierarchy Tables ✅

- `location_hierarchy` - Good recursive structure

### Supporting Tables ✅

- `feedback` - Good structure
- `worker_invitation` - Good structure
- `job_worker` - Good junction table

---

## Best Practices Assessment

✅ **Strengths:**

- Excellent multi-tenancy support with organization_id on all relevant tables
- Good use of UUIDs for primary keys
- Proper foreign key relationships
- Comprehensive indexing strategy
- Good use of JSONB for flexible data storage
- Audit trails for pricing changes
- Effective dating on pricing rules
- RLS enabled on most tables

⚠️ **Areas for Improvement:**

- Remove duplicate/legacy tables
- Add missing NOT NULL constraints
- Enable RLS on all tables that need it
- Standardize naming conventions
- Add automatic updated_at triggers
- Improve currency type consistency
- Add missing composite indexes where needed

---

## Next Steps

1. **Review this document** with the development team
2. **Prioritize** which recommendations to implement first
3. **Create migration files** for approved changes
4. **Test migrations** in development environment
5. **Deploy incrementally** following the phased approach above

---

## Questions for Team

1. Is `pricing_rules` table still referenced anywhere in the codebase?
2. Should `job.location_id` always be required, or can jobs exist without locations?
3. Should audit tables have RLS enabled or remain accessible only via service role?
4. Do we want to create a currency enum type or keep TEXT with CHECK constraints?
5. Are there specific JSONB fields that need GIN indexing based on query patterns?

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-XX
