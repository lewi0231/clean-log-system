# Supabase

## Running Locally

```
<!-- This starts the local instance-->
supabase start

<!-- This stops the local instance -->
supabase stop

<!-- This updates the local server with the migration -->
supabase migration up

<!-- Logs you into remote supabase -->
supabase link
```

## Run Tests

All edge function tests use Deno's built-in test runner. The `deno.json` file at the database root configures all required imports.

### From database directory (recommended):

```bash
# Run all tests in all test directories
deno test --allow-all supabase/functions/**/__tests__/*.test.ts

# Run all tests in main test directory
deno test --allow-all supabase/functions/__tests__/*.test.ts

# Run all tests in utils test directory
deno test --allow-all supabase/functions/_utils/__tests__/*.test.ts

# Run specific test files
deno test --allow-all supabase/functions/__tests__/stripe-utils.test.ts
deno test --allow-all supabase/functions/__tests__/stripe-webhook.test.ts
deno test --allow-all supabase/functions/_utils/__tests__/feedback-email.test.ts
deno test --allow-all supabase/functions/_utils/__tests__/invoice-email.test.ts
```

### From test directory:

```bash
cd supabase/functions/_utils/__tests__
deno test --allow-all feedback-email.test.ts
```

The root `deno.json` file in the database directory automatically configures all required imports (`@std/assert`, `@supabase/supabase-js`, `stripe`, etc.).
