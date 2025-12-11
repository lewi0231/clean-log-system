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
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # Optional for signature verification tests
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
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

## Test Structure

These tests:

- ✅ Make **real API calls** to Stripe Test Mode
- ✅ Test **actual webhook signature verification**
- ✅ Mock Supabase database (to focus on Stripe integration)
- ✅ Mock Edge Functions OR test real HTTP calls (configurable)

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
