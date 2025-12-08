# Database Schema Cleanup Plan

This document provides step-by-step migration plans to implement the recommendations from the schema review.

## Prerequisites

Before starting:

1. ✅ Backup the database
2. ✅ Test in development environment first
3. ✅ Coordinate with development team
4. ✅ Schedule maintenance window for production changes

---

## Phase 1: Critical Fixes

### Migration 1: Remove Legacy `pricing_rules` Table

**Status:** ✅ Safe to remove (table is empty, no active references)

**File:** `database/supabase/migrations/202501XX00000_remove_legacy_pricing_rules.sql`

```sql
-- -*- mode: sql; sql-product: postgres -*-
-- Remove legacy pricing_rules table
-- The unified pricing_rule table replaces this functionality
-- Verified: Table is empty and not referenced in application code

DROP TABLE IF EXISTS pricing_rules CASCADE;

-- Note: This will also drop:
-- - All indexes on pricing_rules
-- - RLS policies on pricing_rules
-- - Foreign key constraints referencing pricing_rules
```

**Verification:**

```sql
-- Confirm table no longer exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'pricing_rules'
) AS table_exists;
```

---

### Migration 2: Add Missing NOT NULL Constraints

**File:** `database/supabase/migrations/202501XX00001_add_not_null_constraints.sql`

```sql
-- -*- mode: sql; sql-product: postgres -*-
-- Add NOT NULL constraints to critical columns

-- Invoice number should always be set
ALTER TABLE invoice
  ALTER COLUMN invoice_number SET NOT NULL;

-- Job location - verify data first!
-- IMPORTANT: Run this check before applying:
-- SELECT COUNT(*) FROM job WHERE location_id IS NULL;
-- If count > 0, migrate data first

-- Only uncomment if all jobs have locations:
-- ALTER TABLE job
--   ALTER COLUMN location_id SET NOT NULL;

-- Add comment explaining why location_id is nullable (if it needs to stay nullable)
COMMENT ON COLUMN job.location_id IS
  'Location where job was performed. NULL allowed for legacy jobs or system-generated records.';
```

**Verification:**

```sql
-- Check constraint was applied
SELECT
    column_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'invoice'
  AND column_name = 'invoice_number';
```

---

### Migration 3: Enable RLS on Missing Tables

**File:** `database/supabase/migrations/202501XX00002_enable_rls_on_tables.sql`

```sql
-- -*- mode: sql; sql-product: postgres -*-
-- Enable Row Level Security on tables that currently have it disabled

-- Enable RLS
ALTER TABLE location_field_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_pricing_mode ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for service role access
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

**Verification:**

```sql
-- Check RLS is enabled
SELECT
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('location_field_config', 'service_pricing_mode', 'organization_settings');
```

---

## Phase 2: Consistency Improvements

### Migration 4: Rename Legacy Foreign Key Constraints

**File:** `database/supabase/migrations/202501XX00003_rename_legacy_constraints.sql`

```sql
-- -*- mode: sql; sql-product: postgres -*-
-- Rename legacy foreign key constraints that reference old table name 'car_yard'

-- Rename constraint referencing organization
ALTER TABLE location
  RENAME CONSTRAINT car_yard_organization_id_fkey
  TO location_organization_id_fkey;

-- Rename primary key constraint
ALTER TABLE location
  RENAME CONSTRAINT car_yard_pkey
  TO location_pkey;
```

**Verification:**

```sql
-- Check constraints were renamed
SELECT
    constraint_name,
    table_name
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'location'
  AND constraint_type = 'FOREIGN KEY';
```

---

### Migration 5: Add Updated_at Triggers

**File:** `database/supabase/migrations/202501XX00004_add_updated_at_triggers.sql`

```sql
-- -*- mode: sql; sql-product: postgres -*-
-- Create generic trigger function for updating updated_at timestamps

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_form_section_updated_at
  BEFORE UPDATE ON form_section
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_location_hierarchy_updated_at
  BEFORE UPDATE ON location_hierarchy
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_rule_updated_at
  BEFORE UPDATE ON pricing_rule
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_condition_updated_at
  BEFORE UPDATE ON pricing_condition
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Verification:**

```sql
-- Test trigger works
-- Update a record and check updated_at changes
UPDATE form_section SET description = 'Test' WHERE id = (SELECT id FROM form_section LIMIT 1);
SELECT updated_at FROM form_section WHERE description = 'Test';
```

---

### Migration 6: Standardize Currency Handling (Optional)

**Status:** ⚠️ **Optional** - Requires application code changes

**File:** `database/supabase/migrations/202501XX00005_create_currency_enum.sql`

```sql
-- -*- mode: sql; sql-product: postgres -*-
-- Create currency enum type for better type safety
-- NOTE: This is a breaking change - coordinate with application team

-- Create enum type
CREATE TYPE currency_code AS ENUM (
  'AUD', 'USD', 'GBP', 'EUR', 'CAD', 'NZD'
);

-- Migrate organization.currency first (has CHECK constraint)
ALTER TABLE organization
  ALTER COLUMN currency TYPE currency_code
  USING currency::currency_code;

-- Drop the old CHECK constraint
ALTER TABLE organization
  DROP CONSTRAINT IF EXISTS organization_currency_check;

-- Add comment
COMMENT ON TYPE currency_code IS 'ISO 4217 currency codes supported by the platform';

-- Future: Migrate other currency columns as needed:
-- ALTER TABLE field_pricing ALTER COLUMN currency TYPE currency_code USING currency::currency_code;
-- ALTER TABLE option_pricing ALTER COLUMN currency TYPE currency_code USING currency::currency_code;
-- etc.
```

**Note:** This is a breaking change. Ensure all application code uses the enum type or update TypeScript types accordingly.

---

## Phase 3: Performance & Integrity

### Migration 7: Add Composite Indexes

**File:** `database/supabase/migrations/202501XX00006_add_composite_indexes.sql`

```sql
-- -*- mode: sql; sql-product: postgres -*-
-- Add composite indexes for common query patterns

-- Jobs by organization and location
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
```

**Verification:**

```sql
-- Check indexes were created
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%_org_%_active';
```

---

### Migration 8: Add Missing Unique Constraints

**File:** `database/supabase/migrations/202501XX00007_add_unique_constraints.sql`

```sql
-- -*- mode: sql; sql-product: postgres -*-
-- Add unique constraints to prevent duplicates

-- Case-insensitive unique field config names per organization (for active configs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_field_configs_name_unique_ci
ON organization_field_configs(organization_id, LOWER(name))
WHERE active = true;

-- Note: This prevents duplicate active field configs with the same name
-- (case-insensitive). Archived/deleted configs can have the same name.
```

**Verification:**

```sql
-- Test unique constraint
-- This should fail if duplicate names exist:
INSERT INTO organization_field_configs (organization_id, name, label, field_type, order_position)
VALUES (
  (SELECT id FROM organization LIMIT 1),
  'TestField',
  'Test Field',
  'text',
  1
);
-- Then try same name with different case
```

---

### Migration 9: Add Data Validation Constraints

**File:** `database/supabase/migrations/202501XX00008_add_validation_constraints.sql`

```sql
-- -*- mode: sql; sql-product: postgres -*-
-- Add check constraints for data validation

-- Email format validation
ALTER TABLE organization_user
  ADD CONSTRAINT check_email_format
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Worker email (nullable, but if set, must be valid)
ALTER TABLE worker
  ADD CONSTRAINT check_worker_email_format
  CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Location email
ALTER TABLE location
  ADD CONSTRAINT check_location_email_format
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
```

**Verification:**

```sql
-- Test constraint with invalid email (should fail)
INSERT INTO organization_user (organization_id, email, role)
VALUES (
  (SELECT id FROM organization LIMIT 1),
  'invalid-email',
  'admin'
);
```

---

## Phase 4: Documentation

### Migration 10: Add Missing Table Comments

**File:** `database/supabase/migrations/202501XX00009_add_table_comments.sql`

```sql
-- -*- mode: sql; sql-product: postgres -*-
-- Add descriptive comments to tables that lack them

COMMENT ON TABLE base_pricing IS
  'Base pricing configuration for job types or standalone services. Supports both field-based (linked to field configs) and standalone pricing.';

COMMENT ON TABLE field_pricing IS
  'Per-unit or fixed pricing rules for field configurations. Can be organization-wide or location-specific.';

COMMENT ON TABLE option_pricing IS
  'Pricing configuration for select field options. Each option value can have different pricing per location.';

COMMENT ON TABLE job_worker IS
  'Many-to-many relationship table linking jobs to assigned workers. A job can have multiple workers, and a worker can be assigned to multiple jobs.';

COMMENT ON TABLE worker IS
  'Workers who complete jobs for organizations. Linked to auth.users via auth_user_id for authentication.';

COMMENT ON TABLE location IS
  'Physical locations (customers/sites) where jobs are performed. Can belong to a location hierarchy node for pricing inheritance.';

COMMENT ON TABLE worker_invitation IS
  'Pending invitations for workers to join organizations. Contains invitation token and expiration details.';

COMMENT ON TABLE pricing_rule IS
  'Unified pricing table supporting field, option, and base pricing with location hierarchies and effective dating. Replaces legacy pricing_rules, base_pricing, field_pricing, and option_pricing tables.';

COMMENT ON TABLE pricing_condition IS
  'Defines conditional logic for pricing rules. Allows complex pricing scenarios based on field values.';

COMMENT ON TABLE pricing_snapshot IS
  'Immutable record of pricing rule data stored at invoice creation time. Ensures historical accuracy of invoice pricing.';
```

---

### Migration 11: Add Missing Column Comments

**File:** `database/supabase/migrations/202501XX00010_add_column_comments.sql`

```sql
-- -*- mode: sql; sql-product: postgres -*-
-- Add descriptive comments to complex columns

COMMENT ON COLUMN job.submission_data IS
  'JSONB containing all field values submitted by workers during job completion. Structure matches organization_field_configs structure at time of submission.';

COMMENT ON COLUMN organization_field_configs.conditional_logic IS
  'JSON structure defining when this field should be visible based on other field values. Format: {"conditions": [{"field_id": "uuid", "operator": "equals", "value": "any"}], "match_type": "all|any"}.';

COMMENT ON COLUMN location.pricing_mode IS
  'field_based: pricing calculated from field configs using pricing rules. fixed_price: uses fixed_customer_price regardless of field data.';

COMMENT ON COLUMN location.fixed_customer_price IS
  'Fixed price for customer invoicing when pricing_mode is fixed_price. Field config data is still collected for operational purposes.';

COMMENT ON COLUMN pricing_rule.pricing_context IS
  'Determines if the rule applies to customer invoicing (customer) or worker payments (worker). Allows independent pricing structures for each.';

COMMENT ON COLUMN pricing_rule.effective_at IS
  'Timestamp when the pricing rule becomes active. Rules are selected based on effective_at and expires_at timestamps.';

COMMENT ON COLUMN pricing_rule.expires_at IS
  'Timestamp when the pricing rule stops being active. NULL means the rule is open-ended and remains active indefinitely.';
```

---

## Optional: JSONB Indexing (Only if Needed)

### Migration 12: Add JSONB GIN Indexes (Performance)

**Status:** ⚠️ **Optional** - Only add if queries filter/search within JSONB

**File:** `database/supabase/migrations/202501XX00011_add_jsonb_indexes.sql`

```sql
-- -*- mode: sql; sql-product: postgres -*-
-- Add GIN indexes for JSONB columns if queries search within them
-- ONLY CREATE THESE IF YOU ACTUALLY QUERY WITHIN THE JSONB FIELDS

-- If querying specific keys in submission_data frequently:
-- CREATE INDEX IF NOT EXISTS idx_job_submission_data_gin
-- ON job USING GIN (submission_data);

-- If querying metadata in pricing_rule:
-- CREATE INDEX IF NOT EXISTS idx_pricing_rule_metadata_gin
-- ON pricing_rule USING GIN (metadata);

-- If querying tier_definition:
-- CREATE INDEX IF NOT EXISTS idx_pricing_rule_tier_definition_gin
-- ON pricing_rule USING GIN (tier_definition);

-- Note: GIN indexes add overhead on writes, only create if needed for reads
```

**When to use:** Only if you have queries like:

- `WHERE submission_data->>'field_name' = 'value'`
- `WHERE metadata @> '{"key": "value"}'`
- `WHERE tier_definition ? 'min'`

---

## Rollback Plans

Each migration should include a rollback plan. Here are examples:

### Rollback Migration 1 (Remove pricing_rules)

```sql
-- Recreate table if needed (only if rollback required)
-- Note: This is provided for safety but should not be needed
-- as the table is empty and deprecated

-- CREATE TABLE pricing_rules (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
--   -- ... restore full schema from migration 20251124000004
-- );
```

### Rollback Migration 2 (NOT NULL constraints)

```sql
-- Remove NOT NULL constraints
ALTER TABLE invoice ALTER COLUMN invoice_number DROP NOT NULL;
-- ALTER TABLE job ALTER COLUMN location_id DROP NOT NULL;
```

---

## Testing Checklist

Before deploying to production:

- [ ] All migrations run successfully in development
- [ ] Application code still works after migrations
- [ ] RLS policies allow service role access as expected
- [ ] Triggers update `updated_at` correctly
- [ ] Indexes improve query performance (check EXPLAIN ANALYZE)
- [ ] Unique constraints prevent duplicates as intended
- [ ] Check constraints reject invalid data
- [ ] No breaking changes to API contracts
- [ ] Database backups completed
- [ ] Rollback plan tested

---

## Deployment Order

1. **Phase 1** (Critical): Migrations 1-3

   - Remove legacy table
   - Add NOT NULL constraints
   - Enable RLS

2. **Phase 2** (Consistency): Migrations 4-6

   - Rename constraints
   - Add triggers
   - Currency enum (optional)

3. **Phase 3** (Performance): Migrations 7-9

   - Add indexes
   - Add unique constraints
   - Add validation

4. **Phase 4** (Documentation): Migrations 10-11

   - Add comments

5. **Optional**: Migration 12 (JSONB indexes, if needed)

---

## Estimated Impact

- **Phase 1**: Low risk, immediate security/consistency improvements
- **Phase 2**: Low risk, improves maintainability
- **Phase 3**: Medium risk, may affect write performance slightly
- **Phase 4**: Zero risk, documentation only

**Total Estimated Time:** 2-4 hours for all phases

---

## Notes

- Test each migration individually before combining
- Monitor database performance after index additions
- Consider maintenance window for production deployments
- Keep this plan updated as changes are made
