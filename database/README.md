# Supabase

## Edge secrets (feedback requests)

| Variable                   | Required            | Notes                                                                                                                                                                                                                                                         |
| -------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FEEDBACK_REVIEW_BASE_URL` | Recommended         | Dashboard origin for `/review/{token}` (e.g. `https://app.tallyrunner.com`). If unset: `DASHBOARD_BASE_URL` → `NEXT_PUBLIC_APP_URL` → `WORKER_INVITATION_BASE_URL` → `https://app.tallyrunner.com`. **Never** use `send.tallyrunner.com` (Resend From: only). |
| `CRON_SHARED_SECRET`       | Required for poller | Generate with `openssl rand -hex 32`. Set as Edge Function secret **and** send the same value as header `x-cron-secret` on the 5‑minute schedule. Local: `database/supabase/functions/.env`. No default — poller returns 401 until set.                       |
| `RESEND_FROM_DOMAIN`       | Existing            | Platform mail From: host (typically `send.tallyrunner.com`). Not used for review links.                                                                                                                                                                       |
| `RESEND_API_KEY`           | Existing            | Unchanged                                                                                                                                                                                                                                                     |

### `CRON_SHARED_SECRET` placement

1. Generate: `openssl rand -hex 32`
2. Staging/prod: Supabase → Project Settings → Edge Functions → Secrets
3. Scheduler: `x-cron-secret: <same value>` on `POST …/functions/v1/process-feedback-email-outbox`
4. Local: `database/supabase/functions/.env`

### Review URL vs org custom email domain

Org custom sending domains only change the email **From:** header (`resolveOrgMailFrom`). Review links always point at the **dashboard** host that serves `/review/[token]`.

Schedule the poller every 5 minutes (Supabase Dashboard → Edge Functions → Schedules, or pg_cron Path A — see migration `20260721120400_schedule_feedback_email_outbox.sql`).

### Colleague confirmation auto-approve

`auto-approve-jobs` should also run every ~5 minutes in each environment. If the schedule is missing, expired joint jobs stay `pending` until something lists them — `list-jobs` and `list-pending-confirmations` now call auto-approve opportunistically so the UI self-heals, but a schedule is still recommended for invoices/notifications when nobody opens the app.

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
