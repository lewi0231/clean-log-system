# Stripe Payment Integration Testing Plan

## Overview

This document outlines integration testing strategies for the Stripe payment integration, covering end-to-end payment flows, webhook handling, and system interactions.

## Test Categories

### 1. Payment Link Creation Flow

#### Test: Create Payment Link for Invoice

**Objective**: Verify complete flow from invoice to payment link creation

**Steps**:

1. User opens invoice preview dialog
2. Navigates to Payments tab
3. Clicks "Create Payment Link" button
4. System calls `create-payment-link` edge function
5. Edge function creates Stripe Checkout Session
6. Payment link stored in database
7. Payment link URL returned to frontend
8. Payment link opens in new tab

**Expected Results**:

- Payment link created in Stripe
- Payment link record created in `payment_link` table
- Invoice `payment_link_id` updated
- Frontend displays "Open Payment Link" button
- Payment link URL is valid Stripe Checkout URL

**Test Data**:

- Invoice ID: `invoice-1`
- Organization ID: `org-1`
- Invoice total: $1,000.00 AUD

**Edge Cases**:

- Invoice already has active payment link
- Invoice is in draft status
- Network failure during creation
- Stripe API error

---

### 2. Payment Processing Flow

#### Test: Complete Payment via Stripe Checkout

**Objective**: Verify payment completion updates invoice and creates payment record

**Steps**:

1. Customer clicks payment link
2. Completes payment in Stripe Checkout
3. Stripe sends `checkout.session.completed` webhook
4. Webhook handler processes event
5. Payment record created in database
6. Invoice totals updated
7. Invoice status updated to "paid" if fully paid

**Expected Results**:

- Payment record created with correct amount
- Payment status is "succeeded"
- Invoice `total_paid` updated
- Invoice `payment_count` incremented
- Invoice status updated appropriately
- Payment link status updated to "complete"

**Test Data**:

- Payment amount: $1,000.00 AUD
- Payment method: Card
- Stripe Payment Intent ID: `pi_test_xxx`
- Stripe Checkout Session ID: `cs_test_xxx`

**Edge Cases**:

- Partial payment (less than invoice total)
- Overpayment (more than invoice total)
- Payment with fees
- Multiple payments for same invoice

---

### 3. Webhook Event Handling

#### Test: Handle Various Stripe Webhook Events

**Objective**: Verify webhook handler processes all relevant events correctly

**Events to Test**:

1. `checkout.session.completed` - Payment successful
2. `payment_intent.succeeded` - Payment confirmed
3. `payment_intent.payment_failed` - Payment failed
4. `charge.refunded` - Refund processed
5. `charge.dispute.created` - Dispute created

**Expected Results**:

- Webhook signature verified
- Event processed correctly
- Database updated appropriately
- Error handling for invalid events
- Idempotency (duplicate events handled)

**Test Scenarios**:

- Valid webhook with correct signature
- Invalid webhook signature (should reject)
- Duplicate webhook event (should handle gracefully)
- Unknown event type (should log and continue)
- Database error during processing

---

### 4. Manual Payment Recording

#### Test: Record Bank Transfer Payment

**Objective**: Verify manual payment recording updates invoice correctly

**Steps**:

1. User opens invoice preview
2. Navigates to Payments tab
3. Clicks "Record Payment" button
4. Fills in payment form:
   - Amount: $500.00
   - Reference: TRANS-123456
   - Date: 2025-01-15
   - Notes: Bank transfer
5. Submits form
6. Payment record created
7. Invoice totals updated

**Expected Results**:

- Payment record created with `bank_transfer_manual` method
- Invoice `total_paid` increased by $500.00
- Invoice `payment_count` incremented
- Invoice status remains "sent" (partial payment)
- Payment appears in payment history

**Edge Cases**:

- Payment amount exceeds remaining balance
- Payment amount equals invoice total (status → "paid")
- Invalid payment reference
- Future payment date
- Negative amount

---

### 5. Payment History Display

#### Test: Display Payment History for Invoice

**Objective**: Verify payment history shows all payments correctly

**Steps**:

1. Create multiple payments for invoice:
   - Stripe payment: $600.00
   - Manual payment: $400.00
2. Open invoice preview
3. Navigate to Payments tab
4. View payment history table

**Expected Results**:

- All payments displayed in table
- Payments sorted by date (newest first)
- Correct currency formatting
- Payment methods displayed correctly
- Status badges show correct colors
- Fees and net amounts displayed
- Reference numbers shown

**Test Data**:

- Payment 1: Stripe card, $600.00, succeeded
- Payment 2: Bank transfer, $400.00, succeeded
- Total paid: $1,000.00

---

### 6. Invoice Status Updates

#### Test: Invoice Status Updates Based on Payments

**Objective**: Verify invoice status changes correctly as payments are received

**Test Scenarios**:

**Scenario 1: Partial Payment**

- Invoice total: $1,000.00
- Payment: $500.00
- Expected status: "sent" (remains unchanged)

**Scenario 2: Full Payment**

- Invoice total: $1,000.00
- Payment: $1,000.00
- Expected status: "paid"
- Expected `paid_at`: Set to payment date

**Scenario 3: Overpayment**

- Invoice total: $1,000.00
- Payment: $1,200.00
- Expected status: "paid"
- Expected `total_paid`: $1,200.00

**Scenario 4: Multiple Payments**

- Invoice total: $1,000.00
- Payment 1: $300.00 (status: "sent")
- Payment 2: $400.00 (status: "sent")
- Payment 3: $300.00 (status: "paid")

---

### 7. Error Handling and Edge Cases

#### Test: Error Scenarios

**Objective**: Verify system handles errors gracefully

**Scenarios**:

1. **Stripe API Failure**

   - Create payment link when Stripe is down
   - Expected: Error message displayed, no payment link created

2. **Webhook Processing Failure**

   - Send webhook with invalid data
   - Expected: Error logged, webhook rejected

3. **Database Constraint Violation**

   - Attempt to create duplicate payment
   - Expected: Error handled, user notified

4. **Network Timeout**

   - Slow network during payment link creation
   - Expected: Loading state shown, timeout handled

5. **Invalid Payment Amount**
   - Attempt to record negative payment
   - Expected: Validation error, payment not created

---

### 8. Integration with Email System

#### Test: Payment Link in Invoice Email

**Objective**: Verify payment links are included in invoice emails

**Steps**:

1. Create invoice
2. Send invoice email
3. Verify email contains payment link
4. Click payment link
5. Verify link works correctly

**Expected Results**:

- Email contains "Pay Now" button
- Button links to Stripe Checkout
- Payment link is active and valid
- Payment link expires after 30 days

---

## Test Environment Setup

### Prerequisites

1. Stripe test account with test API keys
2. Supabase local or test environment
3. Test database with sample data
4. Webhook forwarding (Stripe CLI for local)

### Test Data Setup

```sql
-- Create test organization
INSERT INTO organization (id, name) VALUES ('org-test', 'Test Org');

-- Create test invoice
INSERT INTO invoice (
  id, organization_id, invoice_number, status, total, currency
) VALUES (
  'inv-test', 'org-test', 'INV-001', 'sent', 1000.00, 'AUD'
);
```

### Stripe Test Cards

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0027 6000 3184`

---

## Test Execution Strategy

### Phase 1: Unit Tests (Completed)

- ✅ Payment utilities
- ✅ Payment service
- ✅ Payment hooks
- ✅ Payment components

### Phase 2: Integration Tests (To Do)

1. **Payment Link Creation**

   - Test with real Stripe test API
   - Verify database updates
   - Test error scenarios

2. **Webhook Processing**

   - Use Stripe CLI to send test webhooks
   - Verify database updates
   - Test signature verification

3. **Manual Payment Recording**

   - Test form submission
   - Verify invoice updates
   - Test validation

4. **Payment History**
   - Test with multiple payments
   - Verify display and formatting
   - Test filtering

### Phase 3: End-to-End Tests (Future)

1. Complete payment flow from invoice to payment
2. Multiple payment scenarios
3. Error recovery flows
4. Email integration

---

## Test Tools and Libraries

### Recommended Tools

- **Vitest**: Unit and integration testing
- **Playwright/Cypress**: E2E testing
- **Stripe CLI**: Webhook testing
- **MSW**: API mocking for integration tests

### Test Utilities Needed

```typescript
// Test helpers for Stripe
export const createTestStripeEvent = (type: string, data: any) => {
  // Create properly formatted Stripe webhook event
};

export const createTestPaymentIntent = (amount: number) => {
  // Create test payment intent data
};

// Test helpers for database
export const createTestInvoice = async (total: number) => {
  // Create test invoice in database
};

export const cleanupTestData = async () => {
  // Clean up test data after tests
};
```

---

## Success Criteria

### Functional Requirements

- ✅ Payment links can be created for invoices
- ✅ Payments are recorded correctly
- ✅ Invoice totals update automatically
- ✅ Payment history displays correctly
- ✅ Manual payments can be recorded
- ✅ Webhooks update payment status

### Non-Functional Requirements

- Payment link creation < 2 seconds
- Webhook processing < 1 second
- Payment history loads < 1 second
- Error messages are user-friendly
- System handles Stripe API failures gracefully

---

## Risk Areas

### High Risk

1. **Webhook Signature Verification**: Critical for security
2. **Payment Amount Calculations**: Must be accurate
3. **Invoice Status Updates**: Business logic critical
4. **Concurrent Payments**: Race conditions possible

### Medium Risk

1. **Payment Link Expiration**: Time-based logic
2. **Currency Formatting**: Display accuracy
3. **Error Recovery**: User experience

### Low Risk

1. **UI Display**: Cosmetic issues
2. **Loading States**: UX improvements

---

## Next Steps

1. **Set up test environment** with Stripe test account
2. **Create integration test suite** using Vitest
3. **Set up webhook testing** with Stripe CLI
4. **Write integration tests** for each flow
5. **Set up CI/CD** to run tests automatically
6. **Create E2E tests** for critical paths

---

## Test Coverage Goals

- **Unit Tests**: 90%+ coverage
- **Integration Tests**: All critical flows
- **E2E Tests**: Main user journeys
- **Webhook Tests**: All event types
- **Error Handling**: All error scenarios
