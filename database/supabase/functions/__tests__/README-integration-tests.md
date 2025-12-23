# Integration Tests for Auto-Generate Invoices

## Overview

These integration tests verify the complete end-to-end auto-generate invoices workflow using a **real local Supabase database**. All test data is automatically cleaned up after each test.

## Prerequisites

### 1. Local Supabase Running

```bash
cd database
supabase start
```

**Note:** `supabase start` starts the local Supabase instance (database, API, etc.) but does **NOT** automatically serve edge functions. You need to serve functions separately (see step 4).

### 2. Environment Variables

The tests require these environment variables to be set. You can set them in your shell or create a `.env.test` file:

```bash
# Required
export SUPABASE_URL="http://localhost:54321"
export SUPABASE_SERVICE_ROLE_KEY="<get from 'supabase status'>"

# Optional (for email testing)
export RESEND_TEST_MODE="true"
export SKIP_EMAIL_SENDING="true"  # Recommended to avoid rate limits
```

**Getting SUPABASE_SERVICE_ROLE_KEY:**

```bash
cd database
supabase status
# Look for "service_role key" in the output
```

### 3. Database Migrations Applied

Ensure all migrations are applied:

```bash
cd database
supabase migration up
```

## Running Tests

### Run All Integration Tests

```bash
deno test --allow-all database/supabase/functions/__tests__/auto-generate-invoices-integration.test.ts
```

### Run Specific Test

```bash
deno test --allow-all database/supabase/functions/__tests__/auto-generate-invoices-integration.test.ts --filter "P1.1.1"
```

### Run with Verbose Output

```bash
deno test --allow-all database/supabase/functions/__tests__/auto-generate-invoices-integration.test.ts --reporter=verbose
```

## Test Structure

### Test Data Setup

Each test:

1. Creates a test organization with hierarchy node
2. Creates test locations, field configs, and jobs
3. Runs the auto-generate-invoices function
4. Verifies the results
5. **Automatically cleans up all test data** (even if test fails)

### Test Categories

#### P1.1: Complete Auto-Generate Flow (Happy Path)

- ✅ Creates invoices from completed jobs
- ✅ Sets correct status (pending_review or draft)
- ✅ Creates invoice_job records
- ✅ Generates sequential invoice numbers

#### P1.2: No Jobs to Invoice

- ✅ Handles empty job list gracefully
- ✅ Returns success with 0 generated

#### P1.3: All Jobs Already Invoiced

- ✅ Prevents duplicate invoices
- ✅ Skips already invoiced jobs

#### P1.4: Partial Jobs Already Invoiced

- ✅ Creates invoice only for uninvoiced jobs
- ✅ Correctly filters invoiced vs uninvoiced

#### P1.5: Invoice Status Based on require_review

- ✅ Creates pending_review when require_review: true
- ✅ Creates draft when require_review: false

#### P1.6: Edge Cases

- ✅ Handles jobs with null location_id
- ✅ Handles missing data gracefully

## Test Data Cleanup

All tests use `cleanupTestDatabase()` which:

- Deletes invoices and related records (invoice_job, pricing_snapshot)
- Deletes jobs and job_worker records
- Deletes workers
- Deletes pricing rules
- Deletes field configs
- Deletes organization settings
- Deletes locations
- Deletes hierarchy nodes
- Deletes organization (cascades to related data)

Cleanup happens in `finally` blocks, so data is removed even if tests fail.

## Troubleshooting

### "SUPABASE_URL environment variable is required"

Make sure you've set the environment variables:

```bash
export SUPABASE_URL="http://localhost:54321"
export SUPABASE_SERVICE_ROLE_KEY="<your-key>"
```

### "Failed to create test organization"

- Check that Supabase is running: `supabase status`
- Verify migrations are applied: `supabase migration up`
- Check database connection

### "Function should return success" but got error

- Check edge function logs: `supabase functions logs auto-generate-invoices`
- Verify the function is deployed: `supabase functions list`
- Check that the function can be invoked (may need to deploy first)

### Tests are slow

- Integration tests are slower than unit tests (they use real database)
- Each test creates and cleans up data
- Consider running specific tests during development

### Data not cleaned up

- Check cleanup function logs
- Manually clean up test data if needed (look for `test_` prefix)
- Verify foreign key constraints allow deletion

## Notes

- Tests use **real local Supabase database** (not mocks)
- All test data is prefixed with `test_` for easy identification
- Tests are isolated - each test creates its own organization
- Cleanup happens automatically in `finally` blocks
- Tests can be run in parallel (each uses unique test IDs)

## Next Steps

After P1 tests pass, proceed to:

- P2: Performance tests (large datasets)
- P3: Manual UI testing
- P4: Production readiness checks
