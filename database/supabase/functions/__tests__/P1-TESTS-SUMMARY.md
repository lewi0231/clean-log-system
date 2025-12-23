# P1 Integration Tests - Implementation Summary

## ✅ Completed

### Test Files Created

1. **`test-db-helpers.ts`** - Database test utilities

   - `setupTestDatabase()` - Creates test organization, hierarchy, locations, field configs
   - `createTestWorker()` - Creates test workers
   - `createTestJob()` - Creates test jobs with submission data
   - `cleanupTestDatabase()` - Cleans up all test data in reverse dependency order
   - Uses service role client to bypass RLS

2. **`auto-generate-invoices-integration.test.ts`** - P1 Integration tests
   - 6 comprehensive integration tests covering all P1 scenarios
   - All tests use real local Supabase database
   - Automatic cleanup in `finally` blocks

### Test Coverage

#### P1.1: Complete Auto-Generate Flow (Happy Path) ✅

- Creates invoices from completed jobs
- Verifies `pending_review` status
- Verifies `invoice_job` records created
- Verifies sequential invoice numbers

#### P1.2: No Jobs to Invoice ✅

- Handles empty job list gracefully
- Returns success with 0 generated

#### P1.3: All Jobs Already Invoiced ✅

- Prevents duplicate invoices
- Skips already invoiced jobs

#### P1.4: Partial Jobs Already Invoiced ✅

- Creates invoice only for uninvoiced jobs
- Correctly filters invoiced vs uninvoiced

#### P1.5: Invoice Status Based on require_review ✅

- Creates `pending_review` when `require_review: true`
- Creates `draft` when `require_review: false`

#### P1.6: Edge Cases ✅

- Handles jobs with null `location_id`
- Handles missing data gracefully

## Running the Tests

### Prerequisites

1. **Start Local Supabase:**

   ```bash
   cd database
   supabase start
   ```

   **Note:** `supabase start` does NOT automatically serve edge functions. You must serve them separately (see step 4).

2. **Get Service Role Key:**

   ```bash
   supabase status
   # Copy the "service_role key" value
   ```

3. **Set Environment Variables:**

   ```bash
   export SUPABASE_URL="http://localhost:54321"
   export SUPABASE_SERVICE_ROLE_KEY="<from supabase status>"
   export RESEND_TEST_MODE="true"
   export SKIP_EMAIL_SENDING="true"  # Optional but recommended
   ```

4. **Serve the Edge Function:**
   ```bash
   cd database
   supabase functions serve auto-generate-invoices
   ```
   Keep this running in a separate terminal.

### Run Tests

From the `database` directory:

```bash
# Run all P1 integration tests
deno test --allow-all supabase/functions/__tests__/auto-generate-invoices-integration.test.ts

# Run specific test
deno test --allow-all supabase/functions/__tests__/auto-generate-invoices-integration.test.ts --filter "P1.1.1"

# Run with verbose output
deno test --allow-all supabase/functions/__tests__/auto-generate-invoices-integration.test.ts --reporter=verbose
```

## Test Data Flow

### Setup (per test)

1. Creates test organization with unique `org_code`
2. Creates location hierarchy node (company) with auto-generate config
3. Creates location under hierarchy
4. Creates field configs (service_type, quantity)
5. Creates organization_user (admin)
6. Creates invoice template config
7. Creates organization settings

### Test Execution

1. Creates completed jobs (if needed for test)
2. Updates hierarchy metadata to trigger at current time
3. Invokes `auto-generate-invoices` function
4. Verifies results (invoices created, status correct, etc.)

### Cleanup (always runs)

1. Deletes invoices and related records (invoice_job, pricing_snapshot)
2. Deletes jobs and job_worker records
3. Deletes workers
4. Deletes pricing rules
5. Deletes field configs
6. Deletes invoice template config
7. Deletes organization settings
8. Deletes locations
9. Deletes hierarchy nodes
10. Deletes organization

## Important Notes

### Function Serving Required

The tests invoke the edge function via HTTP, so you **must** have the function served:

```bash
supabase functions serve auto-generate-invoices
```

### Time-Based Scheduling

Tests dynamically set the hierarchy schedule to the current time to ensure the function runs. This means:

- Tests will work regardless of when they're run
- No need to mock Date or wait for specific times

### Database Isolation

- Each test creates its own organization with unique IDs
- Tests can run in parallel (each uses unique test IDs)
- Cleanup happens even if tests fail

### Error Handling

- If function is not served, tests will fail with helpful error message
- Database errors are caught and logged
- Cleanup errors don't fail tests (but are logged)

## Next Steps

After P1 tests pass:

- ✅ P0: Unit tests (30/30 passing)
- ✅ P1: Integration tests (6 tests created, ready to run)
- ⏭️ P2: Performance tests (large datasets)
- ⏭️ P3: Manual UI testing
- ⏭️ P4: Production readiness checks

## Troubleshooting

### "Edge function not available"

- Make sure `supabase functions serve auto-generate-invoices` is running
- Check the function is accessible at `http://localhost:54321/functions/v1/auto-generate-invoices`

### "SUPABASE_SERVICE_ROLE_KEY environment variable is required"

- Run `supabase status` in the `database` directory
- Copy the "service_role key" value
- Export it: `export SUPABASE_SERVICE_ROLE_KEY="<key>"`

### Tests fail with database errors

- Ensure migrations are applied: `supabase migration up`
- Check Supabase is running: `supabase status`
- Verify database connection

### Lock file errors

- Delete `deno.lock` and regenerate: `deno cache --reload`
- Or run with `--reload` flag: `deno test --allow-all --reload ...`
