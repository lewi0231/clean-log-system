# Stripe API Integration Tests - Implementation Summary

## Overview

API integration tests have been implemented using **Vitest + Stripe Test Mode** as recommended in the testing strategy. These tests verify the integration between the dashboard, Edge Functions, and Stripe using real Stripe Test Mode API calls.

## Files Created

### Test Files

1. **`dashboard/__tests__/integration/payment-link-creation.test.ts`**

   - Tests Stripe Checkout Session creation with real API calls
   - Tests Edge Function HTTP integration
   - Tests error handling and validation
   - 10 test cases covering:
     - Real Stripe Checkout Session creation
     - Amount and currency handling
     - Metadata storage
     - Expiry date calculation
     - Edge Function integration
     - Error scenarios

2. **`dashboard/__tests__/integration/webhook-processing.test.ts`**

   - Tests webhook signature verification
   - Tests webhook event processing
   - Tests different event types
   - 12 test cases covering:
     - Webhook signature verification (valid/invalid)
     - Different event types (checkout.session.completed, payment_intent.succeeded, payment_intent.payment_failed, charge.refunded)
     - Metadata extraction
     - Idempotency handling
     - Error scenarios

3. **`dashboard/__tests__/integration/test-helpers.ts`**

   - Utility functions for creating test Stripe events
   - Cleanup helpers for test resources
   - Helper functions for webhook signature creation

4. **`dashboard/__tests__/integration/README.md`**
   - Complete documentation for running and understanding the tests
   - Prerequisites and setup instructions
   - Troubleshooting guide

## Test Structure

### What Gets Tested

#### Payment Link Creation

- ✅ Real Stripe Checkout Session creation (actual API calls)
- ✅ Correct metadata storage
- ✅ Amount and currency handling
- ✅ Expiry date calculation
- ✅ Edge Function HTTP integration (mocked or real)
- ✅ Error handling (network errors, invalid keys, missing fields)

#### Webhook Processing

- ✅ Webhook signature verification (using real Stripe signature format)
- ✅ Event parsing and processing
- ✅ Different event types:
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.refunded`
- ✅ Metadata extraction
- ✅ Idempotency handling
- ✅ Error scenarios (invalid signatures, wrong secrets, missing headers)

### What's Mocked

- **Supabase Database**: Mocked to focus on Stripe integration
- **Edge Functions**: Can be mocked (via `mockFetch`) or tested with real HTTP calls
- **Network Requests**: Configurable via `mockFetch` global

### What's Real

- ✅ **Stripe API Calls**: All tests use real Stripe Test Mode API
- ✅ **Webhook Signatures**: Real Stripe signature format and verification
- ✅ **Event Structure**: Real Stripe event payloads

## Setup

### Prerequisites

1. **Stripe Test Account**

   - Create account at https://stripe.com
   - Get test API keys from Stripe Dashboard

2. **Environment Variables**

   Create a `.env.test` file (or set in your test environment):

   ```env
   # Required for all tests
   STRIPE_SECRET_KEY=sk_test_...

   # Required for webhook signature tests
   STRIPE_WEBHOOK_SECRET=whsec_...

   # Required for Edge Function integration tests
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   ```

3. **Stripe CLI (Optional)**
   - For webhook testing: `brew install stripe/stripe-cli/stripe`
   - Not required for these integration tests (they test signature verification logic)

## Running Tests

### Run All Integration Tests

```bash
cd dashboard
npm test -- integration
```

### Run Specific Test File

```bash
npm test -- payment-link-creation
npm test -- webhook-processing
```

### Run with Watch Mode

```bash
npm test -- --watch integration
```

### Expected Behavior

- If environment variables are not set, tests will **skip** (not fail)
- If environment variables are set, tests will make **real API calls** to Stripe Test Mode
- Tests clean up resources automatically (expire sessions, etc.)

## Test Coverage

### Payment Link Creation (`payment-link-creation.test.ts`)

- 10 test cases
- Covers: Stripe API integration, Edge Function calls, error handling
- Makes real Stripe API calls to create Checkout Sessions

### Webhook Processing (`webhook-processing.test.ts`)

- 12 test cases
- Covers: Signature verification, event processing, all major event types
- Uses real Stripe webhook signature format

**Total**: 22 integration test cases

## Important Notes

1. **Test Mode Only**: All tests use Stripe Test Mode - no real charges
2. **Real API Calls**: Tests make actual HTTP requests to Stripe API
3. **Rate Limits**: Stripe test mode has generous rate limits
4. **Idempotency**: Tests verify idempotent processing
5. **Isolation**: Each test is independent and cleans up after itself
6. **Environment Variables**: Tests will skip if required env vars are not set

## Next Steps

These integration tests cover **Tier 1** of the recommended testing strategy:

- ✅ **API Integration Tests** (Done) - This implementation
- ⏭️ **Component Integration Tests** (Next) - Vitest + React Testing Library
- ⏭️ **E2E Tests** (Future) - Playwright for critical user journeys

## Troubleshooting

### Tests Skipping

- **Cause**: Environment variables not set
- **Solution**: Set `STRIPE_SECRET_KEY` in your test environment

### "Webhook signature verification failed"

- **Cause**: Invalid or missing webhook secret
- **Solution**: Use test webhook secret or set `STRIPE_WEBHOOK_SECRET`

### Tests Timing Out

- **Cause**: Network issues or Stripe API unavailable
- **Solution**: Check internet connection and Stripe API status

### Edge Function Errors

- **Cause**: Supabase not running or MSW mocks not configured
- **Solution**: Ensure Supabase is running locally or mocks are set up correctly

## Implementation Details

### Stripe API Version

- Using `2025-11-17.clover` (latest available in Stripe npm package)
- Matches the version used in Edge Functions (`2025-08-27.basil` is used in Deno)

### Mock Strategy

- **Supabase**: Mocked via `vi.mock("@/lib/supabase")`
- **Fetch/HTTP**: Mocked via `global.fetch = mockFetch` for Edge Function calls
- **Stripe**: Real API calls (not mocked)

### Test Helpers

- `createTestWebhookEvent()`: Creates properly formatted Stripe events
- `createCheckoutSessionCompletedEvent()`: Creates checkout completion events
- `createPaymentIntentSucceededEvent()`: Creates payment success events
- `createChargeRefundedEvent()`: Creates refund events
- `cleanupTestResources()`: Cleans up created Stripe resources

## Success Criteria

✅ All tests pass with proper environment variables set  
✅ Tests make real API calls to Stripe Test Mode  
✅ Tests verify webhook signature verification logic  
✅ Tests cover major event types and error scenarios  
✅ Tests are isolated and clean up after themselves  
✅ Tests skip gracefully when environment variables are not set

---

**Status**: ✅ Complete and ready for use
