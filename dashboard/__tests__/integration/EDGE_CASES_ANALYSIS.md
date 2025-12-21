# Integration Tests Edge Cases Analysis

## Current Test Coverage

### ✅ Well Covered Areas

#### 1. **Webhook Processing** (`webhook-processing.test.ts`)

- ✅ Invalid webhook signatures
- ✅ Wrong webhook secret
- ✅ Old timestamps (> 5 minutes)
- ✅ Missing signature header
- ✅ Missing metadata
- ✅ Idempotency (duplicate events)
- ✅ Multiple event types (checkout.session.completed, payment_intent.succeeded, payment_intent.payment_failed, charge.refunded)

#### 2. **Pricing Bulk Operations** (`pricing-bulk-operations.test.ts`)

- ✅ Concurrent bulk updates
- ✅ Mixed existing and new rules
- ✅ Race condition prevention
- ✅ Customer vs worker context separation
- ✅ Bulk operations for both contexts

#### 3. **Worker Payment Calculation** (`worker-payment-calculation.test.ts`)

- ✅ Null worker_payment_value handling
- ✅ Missing worker_payment_type (defaults to same_structure)
- ✅ Different worker payment types (same_structure, percentage, fixed_rate)
- ✅ Worker context rules vs customer rules with worker_payment
- ✅ Multiple jobs aggregation
- ✅ Multiple line items aggregation

#### 4. **Payment Link Creation** (`payment-link-creation.test.ts`)

- ✅ Invalid Stripe API key
- ✅ Missing required fields
- ✅ Network errors
- ✅ Edge Function errors
- ✅ Correct metadata inclusion
- ✅ Expiry time validation

### ⚠️ Missing Edge Cases

#### 1. **Payment Flow** (`payment-flow.test.ts`)

**Current:** Only happy path test

**Missing Edge Cases:**

##### Invoice Creation

- ❌ **Duplicate job invoicing** - Attempting to invoice a job that's already on an invoice
- ❌ **Jobs from different organizations** - Mixing jobs from different orgs in one invoice
- ❌ **Jobs without locations** - Jobs with `location_id = null`
- ❌ **Jobs without pricing rules** - Jobs that result in $0 total
- ❌ **Zero total invoice** - Invoice with no pricing rules or all zero values
- ❌ **Invalid job IDs** - Non-existent job IDs
- ❌ **Empty job_ids array** - Creating invoice with no jobs
- ❌ **Jobs without completed_at** - Attempting to invoice incomplete jobs
- ❌ **Missing field configs** - Jobs with submission_data referencing non-existent field configs
- ❌ **Invalid submission_data** - Malformed or missing submission data
- ❌ **Multiple jobs with conflicting pricing** - Jobs with different currencies or pricing contexts

##### Invoice Sending

- ❌ **Email sending failure** - Resend API failure (should invoice status still update?)
- ❌ **No email recipients** - Location without email, no default email configured
- ❌ **Invalid email addresses** - Malformed email addresses in location or config
- ❌ **Payment link creation failure** - Stripe API failure during invoice send
- ❌ **Resend invoice** - Resending already sent invoice (should create new payment link?)
- ❌ **Payment link already exists** - Sending invoice that already has a valid payment link
- ❌ **Expired payment link** - Resending invoice with expired payment link
- ❌ **Missing organization settings** - No currency configured
- ❌ **Missing invoice template config** - No email recipient config

##### Payment Processing

- ❌ **Payment for already paid invoice** - Webhook for invoice already marked as paid
- ❌ **Payment amount mismatch** - Stripe payment amount doesn't match invoice total
- ❌ **Currency mismatch** - Payment in different currency than invoice
- ❌ **Payment webhook with missing metadata** - No invoice_id in webhook metadata
- ❌ **Payment webhook for wrong invoice** - invoice_id doesn't exist or belongs to different org
- ❌ **Partial payment** - Payment for less than invoice total (if supported)
- ❌ **Overpayment** - Payment for more than invoice total
- ❌ **Payment confirmation email failure** - Email fails but payment succeeds
- ❌ **Multiple payment webhooks** - Same payment processed twice (idempotency)
- ❌ **Payment intent without checkout session** - Direct payment intent (not via checkout)

##### Payment Link Edge Cases

- ❌ **Payment link expiration** - Using expired payment link
- ❌ **Payment link for paid invoice** - Attempting to pay already paid invoice
- ❌ **Payment link for cancelled invoice** - Attempting to pay cancelled invoice
- ❌ **Payment link reuse** - Using existing payment link vs creating new one on resend

##### Data Integrity

- ❌ **Concurrent invoice creation** - Two invoices created for same jobs simultaneously
- ❌ **Invoice deletion during payment** - Invoice deleted while payment in progress
- ❌ **Organization deletion** - Organization deleted with pending invoices
- ❌ **Job deletion** - Job deleted after invoice created but before payment

##### Pricing Calculation Edge Cases

- ❌ **No pricing rules** - Jobs with no applicable pricing rules
- ❌ **Expired pricing rules** - Pricing rules with `expires_at` in the past
- ❌ **Future pricing rules** - Pricing rules with `effective_at` in the future
- ❌ **Multiple matching rules** - Priority and location hierarchy precedence
- ❌ **Location hierarchy conflicts** - Multiple hierarchy nodes with different pricing
- ❌ **Fixed price location** - Location with `pricing_mode = "fixed_price"`
- ❌ **Service pricing mode override** - Service-specific pricing taking precedence
- ❌ **Tiered pricing** - Pricing rules with tier_definition
- ❌ **Percentage pricing** - Pricing rules with percentage_rate
- ❌ **Conditional pricing** - Pricing rules with conditions
- ❌ **Negative totals** - Discounts that result in negative total (should be prevented?)
- ❌ **Very large amounts** - Currency precision and rounding
- ❌ **Very small amounts** - Sub-cent values and rounding

##### Email Edge Cases

- ❌ **Multiple recipients** - Invoice sent to multiple email addresses
- ❌ **Hierarchy billing email** - Using hierarchy metadata billing email
- ❌ **Form field email** - Jobs without locations using form field email
- ❌ **Default email fallback** - No location email, using default_email from config
- ❌ **Email rate limiting** - Resend API rate limits
- ❌ **Email delivery failure** - Resend API returns success but email bounces

## Recommended Additional Tests

### Priority 1 (Critical - Should Add)

1. **Duplicate Job Invoicing**

   ```typescript
   it("should prevent invoicing a job that's already on an invoice", async () => {
     // Create invoice with job
     // Attempt to create another invoice with same job
     // Should fail with clear error message
   });
   ```

2. **Zero Total Invoice**

   ```typescript
   it("should handle invoice with zero total", async () => {
     // Create job with no pricing rules
     // Create invoice
     // Should succeed but total = 0
     // Payment link should not be created (or should be disabled)
   });
   ```

3. **Email Sending Failure**

   ```typescript
   it("should handle email sending failure gracefully", async () => {
     // Mock Resend API failure
     // Attempt to send invoice
     // Should either: fail invoice send OR send but log error
     // Verify invoice status is correct
   });
   ```

4. **Payment for Already Paid Invoice**

   ```typescript
   it("should handle payment webhook for already paid invoice", async () => {
     // Mark invoice as paid
     // Send payment webhook
     // Should be idempotent (no error, no duplicate payment record)
   });
   ```

5. **Payment Amount Mismatch**

   ```typescript
   it("should handle payment amount mismatch", async () => {
     // Invoice total = $100
     // Payment webhook with amount = $50
     // Should either: reject payment OR handle partial payment
   });
   ```

6. **No Email Recipients**
   ```typescript
   it("should handle invoice send with no email recipients", async () => {
     // Location without email, no default email
     // Attempt to send invoice
     // Should fail with clear error OR skip email but create payment link
   });
   ```

### Priority 2 (High Priority - Should Consider)

7. **Jobs Without Locations**

   ```typescript
   it("should handle jobs without locations", async () => {
     // Create job with location_id = null
     // Use form_field_email for email recipient
     // Create and send invoice
   });
   ```

8. **Resend Invoice**

   ```typescript
   it("should create new payment link when resending invoice", async () => {
     // Send invoice (creates payment link)
     // Resend invoice
     // Should create new payment link OR reuse existing if still valid
   });
   ```

9. **Expired Payment Link**

   ```typescript
   it("should create new payment link if existing one is expired", async () => {
     // Create invoice with payment link
     // Expire the payment link
     // Resend invoice
     // Should create new payment link
   });
   ```

10. **Multiple Jobs in Invoice**

    ```typescript
    it("should handle invoice with multiple jobs", async () => {
      // Create multiple jobs
      // Create invoice with all jobs
      // Verify calculation aggregates correctly
      // Verify email includes all jobs
    });
    ```

11. **Payment Webhook Idempotency**

    ```typescript
    it("should handle duplicate payment webhooks idempotently", async () => {
      // Process payment webhook
      // Process same webhook again
      // Should not create duplicate payment records
    });
    ```

12. **Missing Metadata in Webhook**
    ```typescript
    it("should handle webhook with missing invoice_id metadata", async () => {
      // Send webhook without invoice_id
      // Should fail gracefully with clear error
    });
    ```

### Priority 3 (Nice to Have)

13. **Currency Mismatch**
14. **Very Large Amounts**
15. **Very Small Amounts (Rounding)**
16. **Concurrent Invoice Creation**
17. **Fixed Price Location**
18. **Tiered Pricing**
19. **Conditional Pricing Rules**
20. **Multiple Recipients Email**

## Test Organization Recommendations

### Option 1: Add to Existing `payment-flow.test.ts`

- Add edge case tests as separate `it()` blocks
- Keep happy path test separate
- Group related edge cases in `describe()` blocks

### Option 2: Create New Test Files

- `payment-flow-edge-cases.test.ts` - Invoice creation/sending edge cases
- `payment-processing-edge-cases.test.ts` - Payment webhook edge cases
- `invoice-email-edge-cases.test.ts` - Email sending edge cases

### Option 3: Hybrid Approach (Recommended)

- Keep happy path in `payment-flow.test.ts`
- Create `payment-flow-edge-cases.test.ts` for all edge cases
- Group by category (Invoice Creation, Invoice Sending, Payment Processing, etc.)

## Implementation Priority

### Immediate (P0)

1. Duplicate job invoicing prevention
2. Zero total invoice handling
3. Email sending failure handling
4. Payment for already paid invoice (idempotency)

### Short Term (P1)

5. Payment amount mismatch
6. No email recipients
7. Jobs without locations
8. Resend invoice behavior
9. Multiple jobs in invoice

### Medium Term (P2)

10. Payment webhook idempotency
11. Missing metadata handling
12. Expired payment links
13. Currency mismatches

### Long Term (P3)

14. All other edge cases from Priority 3 list

## Notes

- The current `payment-flow.test.ts` only tests the happy path
- Most edge cases are not covered in integration tests
- Unit tests may cover some of these, but integration tests verify end-to-end behavior
- Consider adding edge case tests incrementally, starting with P0 items
