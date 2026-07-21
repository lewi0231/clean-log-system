# Supabase

## Edge secrets (feedback requests)

| Variable                       | Required                            | Notes                                                                                            |
| ------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `FEEDBACK_REVIEW_BASE_URL`     | For internal/both modes             | Base URL of the dashboard (e.g. `https://app.example.com`) used to build `/review/{token}` links |
| `CRON_SHARED_SECRET`           | For `process-feedback-email-outbox` | Shared secret; poller rejects requests without matching `x-cron-secret` header                   |
| `RESEND_API_KEY` / from domain | Existing                            | Unchanged                                                                                        |

Schedule the poller every 5 minutes (Supabase Dashboard → Edge Functions → Schedules, or pg_cron Path A — see migration `20260721120400_schedule_feedback_email_outbox.sql`).

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

All edge function tests use Deno's built-in test runner. The `deno.json` file at the database root configures all required imports and tasks.

### Using deno task (recommended — includes --allow-all for network access):

```bash
# Run all tests (unit + integration, with required permissions)
deno task test

# Run only integration tests (requires Supabase running)
deno task test:integration
```

### From database directory (manual):

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

**Note:** Integration tests that connect to Supabase require `--allow-net` and `--allow-env`. Use `deno task test` or `deno task test:integration` for proper permissions.

The root `deno.json` file in the database directory automatically configures all required imports (`@std/assert`, `@supabase/supabase-js`, `stripe`, etc.).
