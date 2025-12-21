# Stripe Integration Tests

These tests verify the integration between the dashboard, Edge Functions, and Stripe using **real Stripe Test Mode API calls**.

## Prerequisites

### 1. Stripe Test Account

- Create a Stripe account at https://stripe.com
- Get your test API keys from the Stripe Dashboard

### 2. Environment Variables

**Using `.env.development` (Recommended)**

Since you're using test mode during development, you can keep your Stripe test keys in `.env.development`. Vitest will read from `process.env`, so ensure your environment variables are set:

```env
# In .env.development
# Stripe Test Mode (REQUIRED)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # Optional for signature verification tests

# Supabase Local (REQUIRED for payment-flow test)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Get from 'supabase status' command

# Resend Test Mode (REQUIRED for payment-flow test)
RESEND_API_KEY=re_...
RESEND_FROM_DOMAIN=your-domain.com
RESEND_TEST_MODE=true  # IMPORTANT: Set to true to prevent sending real emails
SKIP_EMAIL_SENDING=true  # OPTIONAL: Skip actual email sending to avoid rate limits (emails are mocked)
```

**Getting SUPABASE_SERVICE_ROLE_KEY:**

Run `supabase status` in the `database` directory to get the service role key:

```bash
cd database
supabase status
# Look for "service_role key" in the output
```

**Note**: If environment variables aren't automatically loaded, you can source them before running tests:

```bash
# Load from .env.development (if using dotenv-cli or similar)
export $(cat .env.development | xargs)
npm test -- integration
```

### 3. Stripe CLI (Required for Webhook Testing)

Install Stripe CLI and login:

```bash
brew install stripe/stripe-cli/stripe
stripe login
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Unit Tests Only (Excludes Integration Tests)

```bash
npm run test:unit
```

### Run Integration Tests Only

```bash
npm run test:integration        # Watch mode
npm run test:integration:run    # Run once
```

### Run Integration Tests with Webhook Forwarding

This automatically starts the Stripe webhook listener, runs tests, then stops the listener:

```bash
npm run test:integration:with-webhook
```

This is useful when you want to test against a real running Supabase Edge Function.

### Run Stripe Webhook Listener Manually

If you want to keep the webhook listener running in a separate terminal:

```bash
npm run stripe:webhook:listen
```

This forwards Stripe webhooks to: `http://localhost:54321/functions/v1/stripe-webhook`

**Note**: Make sure your local Supabase is running before starting the webhook listener.

## Test Scripts Summary

| Script                                  | Description                                             |
| --------------------------------------- | ------------------------------------------------------- |
| `npm test`                              | Run all tests (unit + integration)                      |
| `npm run test:unit`                     | Run unit tests only (excludes integration folder)       |
| `npm run test:integration`              | Run integration tests in watch mode                     |
| `npm run test:integration:run`          | Run integration tests once (no watch)                   |
| `npm run test:integration:with-webhook` | Run integration tests with automatic webhook forwarding |
| `npm run stripe:webhook:listen`         | Start Stripe webhook listener manually                  |

## Test Files

### `payment-link-creation.test.ts`

- Tests Stripe Checkout Session creation with real API
- Tests Edge Function integration
- Tests error handling
- Tests metadata and URL generation

### `webhook-processing.test.ts`

- Tests webhook signature verification
- Tests webhook event processing
- Tests different event types (checkout.session.completed, payment_intent.succeeded, etc.)
- Tests idempotency

### `test-helpers.ts`

- Utility functions for creating test events
- Cleanup helpers
- Test data generators

### `test-db-helpers.ts`

- Database setup and cleanup utilities
- Functions to create test organizations, locations, field configs
- Functions to create test jobs
- Cleanup functions that remove test data in correct order

### `payment-flow.test.ts`

- **Full end-to-end integration test** using real local Supabase database
- Tests complete flow: field configs → job → pricing → invoice → send → payment link
- Creates real test data and cleans up after test
- Requires local Supabase running and all environment variables set
- Validates that Stripe and Resend are in test mode

## Test Structure

### Payment Link & Webhook Tests

These tests:

- ✅ Make **real API calls** to Stripe Test Mode
- ✅ Test **actual webhook signature verification**
- ✅ Mock Supabase database (to focus on Stripe integration)
- ✅ Mock Edge Functions OR test real HTTP calls (configurable)

### Payment Flow Test

The `payment-flow.test.ts` test is different:

- ✅ Uses **real local Supabase database** (not mocked)
- ✅ Creates **real test data** (organization, location, field configs, jobs, invoices)
- ✅ Calls **real Edge Functions** via Supabase Functions API
- ✅ Makes **real Stripe API calls** (test mode)
- ✅ Sends **real emails via Resend** (test mode - redirected to test addresses)
- ✅ **Cleans up all test data** after test completes
- ✅ Validates environment variables and test mode settings

## What Gets Tested

### Payment Link Creation

- Real Stripe Checkout Session creation
- Correct metadata storage
- Amount and currency handling
- Expiry date calculation
- Edge Function HTTP integration
- Error handling

### Webhook Processing

- Webhook signature verification (real Stripe signatures)
- Event parsing and processing
- Different event types
- Metadata extraction
- Idempotency handling
- Error scenarios

## Important Notes

1. **Test Mode Only**: All tests use Stripe Test Mode - no real charges
2. **Real API Calls**: Tests make actual HTTP requests to Stripe API
3. **Rate Limits**: Stripe test mode has generous rate limits
4. **Idempotency**: Tests verify idempotent processing
5. **Isolation**: Each test is independent and cleans up after itself
6. **Environment Variables**: Tests will skip if required env vars are not set
7. **Webhook Forwarding**: Only needed when testing against real Edge Functions

## Troubleshooting

### Tests Skipping

- **Cause**: Environment variables not set
- **Solution**: Ensure `.env.development` has the required variables, or export them in your shell

### "Webhook signature verification failed"

- **Cause**: Invalid or missing webhook secret
- **Solution**: Get the webhook secret from `stripe listen` output when running `npm run stripe:webhook:listen`

### "Stripe CLI not found"

- **Cause**: Stripe CLI not installed
- **Solution**: `brew install stripe/stripe-cli/stripe && stripe login`

### Tests Timing Out

- **Cause**: Network issues or Stripe API unavailable
- **Solution**: Check internet connection and Stripe API status

### Edge Function Errors

- **Cause**: Supabase not running locally
- **Solution**: Start Supabase with `supabase start` before running tests

## Payment Flow Test

The `payment-flow.test.ts` is a comprehensive end-to-end integration test that verifies the complete payment flow from field configs to invoice payment.

### Prerequisites for Payment Flow Test

1. **Local Supabase Running**

   ```bash
   cd database
   supabase start
   ```

2. **All Environment Variables Set** (see Environment Variables section above)

   - `STRIPE_SECRET_KEY` (must be `sk_test_...`)
   - `SUPABASE_SERVICE_ROLE_KEY` (from `supabase status`)
   - `RESEND_API_KEY`
   - `RESEND_FROM_DOMAIN`
   - `RESEND_TEST_MODE=true` (critical - prevents sending real emails)
   - `SKIP_EMAIL_SENDING=true` (recommended - skips actual email sending to avoid rate limits)
   - `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321`

3. **Test Mode Validation**
   - The test will fail if `STRIPE_SECRET_KEY` is not a test key
   - The test will warn if `RESEND_TEST_MODE` is not `true`

### What the Payment Flow Test Does

1. **Setup**: Creates test organization, location, and field configs
2. **Create Job**: Creates a completed job with submission data
3. **Calculate Pricing**: Calls `calculate-invoice` Edge Function
4. **Create Invoice**: Calls `create-invoice` Edge Function
5. **Send Invoice**: Calls `update-invoice-status` Edge Function
   - Verifies invoice email sent
   - Verifies payment link created
6. **Verify Payment Link**: Checks payment link exists and is valid
7. **Cleanup**: Removes all test data in correct order

### Running Payment Flow Test

```bash
# Run just the payment flow test
npm test -- payment-flow

# Or run all integration tests
npm run test:integration:run
```

### Test Data Cleanup

The test automatically cleans up all created data:

- Payments
- Payment links
- Invoices and invoice jobs
- Pricing snapshots
- Jobs
- Pricing rules
- Field configs
- Invoice template configs
- Organization settings
- Locations
- Organizations

Cleanup happens in `afterAll` hook, even if the test fails.

### Troubleshooting Payment Flow Test

**"Missing required environment variables"**

- Ensure all required env vars are set in `.env.development`
- Check that `SUPABASE_SERVICE_ROLE_KEY` is correct (from `supabase status`)

**"STRIPE_SECRET_KEY must be a test key"**

- Ensure you're using `sk_test_...` not `sk_live_...`
- Production keys are not allowed in tests

**"RESEND_TEST_MODE is not set to 'true'"**

- Set `RESEND_TEST_MODE=true` in `.env.development`
- This prevents sending emails to real addresses

**"Failed to create test organization"**

- Ensure Supabase is running: `supabase start`
- Check database connection: `supabase status`

**Test data not cleaned up**

- Check test logs for cleanup errors
- Manually clean up if needed (test data is prefixed with `test_`)

### Completing the Full Payment Flow

The test currently verifies the setup and payment link creation. To complete the full flow including payment processing:

1. Use the payment link URL from test output
2. Complete checkout with Stripe test card: `4242 4242 4242 4242`
3. Use Stripe CLI to forward webhooks: `stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook`
4. Verify webhook processes payment
5. Verify payment confirmation email sent (check Resend dashboard or test inbox)
6. Verify invoice status updated to "paid"
