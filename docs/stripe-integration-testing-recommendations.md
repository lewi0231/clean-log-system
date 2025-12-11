# Stripe Integration Testing Recommendations

## Testing Strategy: Layered Approach

For Stripe payment integration, I recommend a **three-tiered testing approach** rather than relying on a single tool:

### Tier 1: API Integration Tests (Vitest + Stripe Test Mode)

**Best for**: Testing backend logic with real Stripe APIs

**Tools**:

- **Vitest** (already in use)
- **Stripe Test Mode** (real Stripe API in test mode)
- **MSW (Mock Service Worker)** for Supabase Edge Functions

**What to Test**:

- Payment link creation via Edge Functions
- Webhook processing and signature verification
- Database updates after webhook events
- Error handling with Stripe API failures

**Example**:

```typescript
describe("Payment Link Creation Integration", () => {
  it("should create real Stripe Checkout Session", async () => {
    // Use real Stripe test API keys
    const result = await createPaymentLink({
      invoiceId: "test-invoice",
      organizationId: "test-org",
    });

    expect(result.url).toMatch(/checkout\.stripe\.com/);
    // Verify in Stripe dashboard or via API
  });
});
```

**Pros**:

- Tests real API interactions
- Catches integration issues early
- No browser overhead
- Fast execution
- Can run in CI/CD

**Cons**:

- Requires API keys management
- Rate limits may apply
- Network dependency

---

### Tier 2: Component Integration Tests (Vitest + React Testing Library)

**Best for**: Testing components working together

**Tools**:

- **Vitest** (already in use)
- **React Testing Library** (already in use)
- **MSW** for API mocking

**What to Test**:

- Payment components interacting together
- Payment flow within invoice preview
- State management across components
- Error propagation

**Example**:

```typescript
describe("Payment Flow Integration", () => {
  it("should create payment link and display in UI", async () => {
    // Render invoice preview with payment components
    // Click create payment link
    // Verify payment link appears
    // Verify payment history updates
  });
});
```

**Pros**:

- Tests component interactions
- No browser needed
- Fast execution
- Good for regression testing

**Cons**:

- Doesn't test full browser environment
- Limited to React component tree

---

### Tier 3: End-to-End Tests (Playwright)

**Best for**: Testing complete user journeys

**Tools**:

- **Playwright** (recommended over Cypress for Next.js)
- **Stripe Test Mode**
- **Test Database**

**What to Test**:

- Complete payment flow from invoice to payment
- User interactions in real browser
- Cross-browser compatibility
- Visual regressions
- Payment link opening and completion

**Example**:

```typescript
test("complete payment flow", async ({ page }) => {
  // Navigate to invoice
  await page.goto("/dashboard/invoicing");
  await page.click("text=View Invoice");

  // Create payment link
  await page.click("text=Create Payment Link");
  const [paymentPage] = await Promise.all([
    page.context().waitForEvent("page"),
    page.waitForSelector("text=Open Payment Link"),
  ]);

  // Complete payment in Stripe Checkout (test mode)
  await paymentPage.fill("input[name='cardNumber']", "4242 4242 4242 4242");
  await paymentPage.click("button:has-text('Pay')");

  // Verify payment completion
  await page.waitForSelector("text=Payment Successful");
});
```

**Pros**:

- Tests real user experience
- Catches browser-specific issues
- Tests entire flow end-to-end
- Can test Stripe Checkout UI

**Cons**:

- Slower execution
- More complex setup
- Requires browser environment
- Can be flaky

---

## Recommended Testing Stack

### For Your Project

```json
{
  "devDependencies": {
    "vitest": "^4.0.10", // ✅ Already have
    "@playwright/test": "^1.40.0", // Add for E2E
    "msw": "^2.0.0", // Add for API mocking
    "@testing-library/react": "^16.3.0" // ✅ Already have
  }
}
```

---

## Testing Pyramid

```
         /\
        /  \      E2E Tests (Playwright)
       /____\     - Critical user flows
      /      \    - ~10-15 tests
     /        \
    /__________\  Integration Tests (Vitest)
   /            \ - API integrations
  /              \ - Component interactions
 /________________\ - ~30-50 tests

                  Unit Tests (Vitest)
                  - Components
                  - Hooks
                  - Services
                  - ~100+ tests (✅ Done)
```

---

## Implementation Plan

### Phase 1: API Integration Tests (Week 1)

**Priority**: High
**Tool**: Vitest + Stripe Test API

1. **Set up Stripe test environment**

   ```bash
   # Install Stripe CLI for webhook testing
   brew install stripe/stripe-cli/stripe
   ```

2. **Create integration test files**

   - `dashboard/__tests__/integration/payment-link-creation.test.ts`
   - `dashboard/__tests__/integration/webhook-processing.test.ts`

3. **Use Stripe test keys**

   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

4. **Test scenarios**:
   - Create payment link with real Stripe API
   - Verify Checkout Session creation
   - Test webhook signature verification
   - Test payment processing flow

---

### Phase 2: Component Integration Tests (Week 1-2)

**Priority**: Medium
**Tool**: Vitest + React Testing Library

1. **Create integration test files**

   - `dashboard/__tests__/integration/payment-components.test.tsx`
   - `dashboard/__tests__/integration/invoice-payment-flow.test.tsx`

2. **Test scenarios**:
   - Payment link button + payment history interaction
   - Manual payment dialog + payment history update
   - Invoice status updates after payment
   - Error state propagation

---

### Phase 3: E2E Tests (Week 2-3)

**Priority**: Medium-Low
**Tool**: Playwright

1. **Install Playwright**

   ```bash
   npm install -D @playwright/test
   npx playwright install
   ```

2. **Set up Playwright config**

   ```typescript
   // playwright.config.ts
   export default defineConfig({
     testDir: "./e2e",
     use: {
       baseURL: "http://localhost:3000",
     },
   });
   ```

3. **Create E2E test files**

   - `e2e/payment-flow.spec.ts`
   - `e2e/manual-payment.spec.ts`

4. **Test scenarios**:
   - Complete payment flow
   - Payment link creation and usage
   - Manual payment recording
   - Payment history display

---

## When to Use Each

### Use API Integration Tests When:

- ✅ Testing backend Edge Functions
- ✅ Testing webhook handlers
- ✅ Testing Stripe API integration
- ✅ Need fast feedback in CI/CD

### Use Component Integration Tests When:

- ✅ Testing multiple components together
- ✅ Testing state management
- ✅ Testing error propagation
- ✅ Need fast tests with good coverage

### Use E2E Tests When:

- ✅ Testing critical user journeys
- ✅ Need to test Stripe Checkout UI
- ✅ Testing cross-browser compatibility
- ✅ Final verification before release

---

## Stripe Testing Best Practices

### 1. Use Stripe Test Mode

```typescript
// Always use test keys
const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY);
```

### 2. Use Stripe Test Cards

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0027 6000 3184`

### 3. Use Stripe CLI for Webhooks

```bash
# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### 4. Clean Up Test Data

```typescript
afterEach(async () => {
  // Delete test payment links
  // Delete test payments
  // Reset test invoices
});
```

### 5. Mock External Services

```typescript
// Mock Supabase in integration tests
vi.mock("@/lib/supabase", () => ({
  supabase: createMockSupabaseClient(),
}));
```

---

## Recommended Test Distribution

For your Stripe payment integration:

| Test Type             | Count | Purpose                                 |
| --------------------- | ----- | --------------------------------------- |
| Unit Tests            | 50+   | ✅ Done - Components, hooks, services   |
| API Integration       | 15-20 | Payment links, webhooks, Edge Functions |
| Component Integration | 10-15 | Payment UI flows                        |
| E2E Tests             | 5-10  | Critical payment journeys               |

**Total**: ~80-95 tests covering all payment functionality

---

## CI/CD Integration

### Recommended Workflow

```yaml
# .github/workflows/test.yml
- name: Run Unit Tests
  run: npm test

- name: Run Integration Tests
  run: npm run test:integration
  env:
    STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}

- name: Run E2E Tests
  run: npm run test:e2e
  env:
    STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
```

---

## Summary

**For your Stripe integration, I recommend**:

1. **Start with API Integration Tests** (Vitest + Stripe Test API)

   - Fast, reliable, tests real integrations
   - Can be done immediately

2. **Add Component Integration Tests** (Vitest + RTL)

   - Tests UI interactions
   - Complements unit tests

3. **Add E2E Tests with Playwright** (Later)
   - For critical flows only
   - Run less frequently (nightly/weekly)

**Avoid**:

- ❌ Using Playwright for everything (too slow)
- ❌ Mocking Stripe APIs completely (misses integration issues)
- ❌ Only unit tests (misses integration issues)

This layered approach gives you confidence at every level while maintaining fast feedback loops.
