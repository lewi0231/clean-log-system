# Payment Processing Best Practices for Tally Runner (monorepo)

**Research Date:** January 2025  
**Focus:** Stripe integration for all payment methods and comprehensive payment tracking

---

## Executive Summary

For a SaaS platform managing field workers, jobs, and customer invoicing, we're implementing a **Stripe-first** payment system that handles:

1. **Payment Links via Stripe Checkout**: Convenient payment links for customers
2. **Bank Transfers via Stripe**: Australian bank debits and transfers supported
3. **Webhooks for Automatic Updates**: Real-time payment status updates
4. **Stripe Dashboard for Reconciliation**: Use Stripe's built-in reconciliation tools
5. **Comprehensive Payment Tracking**: Track all payments within the application with full audit trails

**Strategy:** Start with Stripe for everything, add other providers later if needed.

---

## 1. Payment Provider: Stripe Australia

### Why Stripe for Everything

**Stripe Australia** provides a complete payment solution that covers all our needs:

#### **Payment Methods Supported:**

- ✅ **Payment Links** via Stripe Checkout (cards, digital wallets)
- ✅ **Bank Transfers** (Australian bank debits via Direct Debit)
- ✅ **Bank Account Payments** (ACH-style transfers)
- ✅ **Card Payments** (Visa, Mastercard, Amex)
- ✅ **Digital Wallets** (Apple Pay, Google Pay)

#### **Key Features:**

- **Excellent Developer Experience**: Best-in-class API and documentation
- **Webhook Infrastructure**: Real-time payment status updates
- **Stripe Dashboard**: Built-in reconciliation and reporting
- **Australian Support**: Full support for AUD, BSB/account numbers, and local payment methods
- **Security**: PCI DSS compliant, fraud detection built-in
- **Scalability**: Handles everything from small to enterprise volumes

#### **Pricing:**

- Card payments: 1.75% + $0.30 per transaction (AUD)
- Bank transfers: Lower fees (typically 0.1-0.5%)
- Payment links: Included at no extra cost
- No monthly fees (pay-as-you-go)

### Future Expansion

While we start with Stripe for everything, we can add other providers later if needed:

- **Azupay/Zai**: For direct NPP integration if lower fees are needed
- **Monoova**: For advanced PayTo features
- **GoCardless**: For specialized direct debit scenarios

---

## 2. Payment Methods Architecture (Stripe)

### Payment Method Types via Stripe

#### **A. Payment Links (Stripe Checkout)**

- **Use Case:** Primary method - convenient for all customers
- **Implementation:**
  - Generate unique Stripe Checkout Session per invoice
  - Include payment link in invoice email
  - Track click-through and payment status via webhooks
  - Supports: Cards, Digital Wallets, Bank Transfers (all in one link)

#### **B. Bank Transfers (Stripe Direct Debit)**

- **Use Case:** For customers who prefer bank account payments
- **Implementation:**
  - Customer authorizes bank debit via Stripe Checkout
  - Stripe handles the bank transfer
  - Real-time webhook confirmation
  - Lower fees than card payments

#### **C. Manual Bank Transfer (BSB/Account Display)**

- **Use Case:** For businesses that prefer traditional bank transfers
- **Implementation:**
  - Display organization's BSB and account number on invoice
  - Include invoice number in payment reference
  - Manual reconciliation via Stripe dashboard or bank statement import
  - Can be automated later with bank feed integration

### **Stripe Payment Flow**

```
Invoice Created
    ↓
┌─────────────────────────────────────┐
│  Generate Stripe Payment Link        │
│  (Stripe Checkout Session)           │
└─────────────────────────────────────┘
    ↓
    ├─→ Payment Link in Email
    │   ├─ Customer clicks link
    │   ├─ Stripe Checkout opens
    │   └─ Customer chooses payment method:
    │       ├─ Card Payment
    │       ├─ Digital Wallet (Apple/Google Pay)
    │       └─ Bank Transfer (Direct Debit)
    │
    └─→ BSB/Account Number (Fallback)
        ├─ Displayed on invoice PDF
        └─ Manual bank transfer
            └─ Reconciliation via Stripe dashboard
```

### **Payment Link Features**

- **One Link, Multiple Methods**: Single link supports all payment types
- **Mobile Optimized**: Works perfectly on mobile devices
- **Automatic Receipts**: Stripe sends receipts automatically
- **Real-time Status**: Webhooks update payment status instantly

---

## 3. Database Schema Design for Payment Tracking

### Current State Analysis

Your current `invoice` table has:

- `status`: draft, sent, paid, overdue, cancelled
- `paid_at`: timestamp when paid
- Basic payment tracking

### Recommended Schema Extensions

#### **A. Payment Table (Stripe-Focused)**

```sql
CREATE TABLE payment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES invoice(id) ON DELETE SET NULL,

  -- Payment Details
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'AUD',
  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'stripe_checkout_card',
    'stripe_checkout_bank',
    'stripe_checkout_wallet',
    'bank_transfer_manual',
    'other'
  )),

  -- Stripe Information
  stripe_payment_intent_id TEXT UNIQUE, -- Stripe PaymentIntent ID
  stripe_checkout_session_id TEXT, -- Stripe Checkout Session ID
  stripe_customer_id TEXT, -- Stripe Customer ID (if created)
  stripe_charge_id TEXT, -- Stripe Charge ID

  -- Status Tracking (aligned with Stripe statuses)
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'canceled',
    'refunded',
    'partially_refunded',
    'disputed'
  )),

  -- Payment Metadata
  payment_reference TEXT, -- Customer's payment reference (for manual transfers)
  payment_date TIMESTAMPTZ, -- When payment was made
  received_at TIMESTAMPTZ, -- When payment was received/confirmed
  fees DECIMAL(10, 2) DEFAULT 0, -- Stripe processing fees
  net_amount DECIMAL(10, 2), -- Amount after fees (amount - fees)

  -- Reconciliation
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES organization_user(id),
  reconciliation_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb -- Stripe webhook data, etc.
);

-- Indexes
CREATE INDEX idx_payment_invoice ON payment(invoice_id);
CREATE INDEX idx_payment_org ON payment(organization_id);
CREATE INDEX idx_payment_status ON payment(status);
CREATE INDEX idx_payment_stripe_intent ON payment(stripe_payment_intent_id);
CREATE INDEX idx_payment_stripe_session ON payment(stripe_checkout_session_id);
CREATE INDEX idx_payment_reference ON payment(payment_reference);
CREATE INDEX idx_payment_date ON payment(payment_date);
```

#### **B. Payment Link Table (Stripe Checkout Sessions)**

```sql
CREATE TABLE payment_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES invoice(id) ON DELETE CASCADE NOT NULL,

  -- Stripe Checkout Session
  stripe_checkout_session_id TEXT UNIQUE NOT NULL,
  checkout_url TEXT NOT NULL, -- The payment link URL

  -- Link Status
  status TEXT DEFAULT 'open' CHECK (status IN (
    'open',           -- Session created, waiting for payment
    'complete',       -- Payment completed
    'expired',        -- Session expired
    'canceled'        -- Session canceled
  )),

  -- Tracking
  clicked_at TIMESTAMPTZ,
  clicked_count INTEGER DEFAULT 0,
  payment_completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- When the checkout session expires

  -- Metadata
  customer_email TEXT, -- Email of customer (if known)
  amount_total DECIMAL(10, 2) NOT NULL, -- Total amount for this session

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_link_invoice ON payment_link(invoice_id);
CREATE INDEX idx_payment_link_stripe_session ON payment_link(stripe_checkout_session_id);
CREATE INDEX idx_payment_link_status ON payment_link(status);
```

#### **C. Payment Reconciliation Table**

```sql
CREATE TABLE payment_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,

  -- Reconciliation Details
  reconciliation_date DATE NOT NULL,
  source TEXT NOT NULL, -- 'bank_statement', 'provider_webhook', 'manual'
  source_reference TEXT, -- Statement file name, webhook ID, etc.

  -- Matched Payments
  matched_payment_ids UUID[], -- Array of payment IDs matched

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'completed',
    'failed',
    'requires_review'
  )),

  -- Results
  total_matched DECIMAL(10, 2),
  total_unmatched DECIMAL(10, 2),
  unmatched_count INTEGER,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES organization_user(id),
  completed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX idx_reconciliation_org ON payment_reconciliation(organization_id);
CREATE INDEX idx_reconciliation_date ON payment_reconciliation(reconciliation_date);
```

#### **D. Update Invoice Table**

```sql
-- Add payment tracking columns
ALTER TABLE invoice
  ADD COLUMN IF NOT EXISTS payment_link_id UUID REFERENCES payment_link(id),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT, -- Stripe customer ID (if created)
  ADD COLUMN IF NOT EXISTS bsb TEXT, -- Organization's BSB for manual transfers
  ADD COLUMN IF NOT EXISTS account_number TEXT, -- Organization's account number
  ADD COLUMN IF NOT EXISTS account_name TEXT, -- Account name for bank transfers
  ADD COLUMN IF NOT EXISTS total_paid DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method_used TEXT; -- Track which method was used

COMMENT ON COLUMN invoice.payment_link_id IS 'Reference to Stripe Checkout payment link';
COMMENT ON COLUMN invoice.stripe_customer_id IS 'Stripe customer ID for this invoice';
COMMENT ON COLUMN invoice.total_paid IS 'Sum of all payments received for this invoice';
COMMENT ON COLUMN invoice.payment_count IS 'Number of payments received (supports partial payments)';
COMMENT ON COLUMN invoice.payment_method_used IS 'Payment method used: stripe_checkout, bank_transfer_manual';
```

---

## 4. Payment Tracking Implementation

### **A. Payment Status Workflow**

```
Invoice Status → Payment Status → Reconciliation Status
───────────────────────────────────────────────────────
draft          → (no payment)    → N/A
sent           → pending          → awaiting_payment
sent           → processing       → in_progress
sent           → completed        → matched
sent           → failed           → failed
paid           → completed        → reconciled
```

### **B. Stripe Webhook Handling**

**Best Practice:** Implement Stripe webhook endpoints for real-time payment updates

```typescript
// Stripe webhook event types we'll handle
type StripeWebhookEvent =
  | "checkout.session.completed" // Payment link used successfully
  | "payment_intent.succeeded" // Payment succeeded
  | "payment_intent.payment_failed" // Payment failed
  | "charge.refunded" // Refund processed
  | "charge.dispute.created"; // Dispute created

// Webhook processing flow:
// 1. Verify Stripe webhook signature (CRITICAL for security)
// 2. Check idempotency (Stripe sends idempotency key)
// 3. Find invoice by metadata.invoice_id
// 4. Create/update payment record
// 5. Update invoice status
// 6. Update payment_link status
// 7. Trigger notifications (email, dashboard updates)
```

**Key Stripe Webhook Events:**

- `checkout.session.completed`: Customer completed checkout
- `payment_intent.succeeded`: Payment successfully processed
- `payment_intent.payment_failed`: Payment failed (card declined, etc.)
- `charge.refunded`: Refund processed
- `charge.dispute.created`: Customer disputed the charge

### **C. Payment Matching Logic**

**For Stripe Payments:**

1. **Automatic (via Webhooks):**
   - Stripe sends webhook when payment succeeds
   - Match by `metadata.invoice_id` in webhook
   - Update payment and invoice status automatically
   - No manual intervention needed

**For Manual Bank Transfers (BSB/Account):**

1. **Manual Entry:**
   - Admin enters payment details in dashboard
   - System matches to invoice by reference number
   - Updates invoice status
   - Creates payment record

2. **Stripe Dashboard Reconciliation:**
   - Use Stripe's reconciliation tools
   - Match Stripe transactions to invoices
   - Export data for accounting integration

3. **Future: Bank Feed Integration:**
   - Connect bank account feed to Stripe
   - Automated matching of manual transfers
   - Real-time reconciliation

---

## 5. Implementation Best Practices

### **A. Security**

1. **Webhook Security:**
   - Verify webhook signatures
   - Use HTTPS only
   - Implement idempotency keys
   - Rate limiting

2. **Payment Data:**
   - Never store full card numbers
   - Tokenize sensitive data
   - Encrypt BSB/account numbers at rest
   - PCI DSS compliance (if handling cards)

3. **Access Control:**
   - RLS policies for payment data
   - Audit logs for payment changes
   - Role-based access (only admins can mark payments)

### **B. Error Handling**

1. **Failed Payments:**
   - Track failure reasons
   - Automatic retry logic (with backoff)
   - Customer notifications
   - Admin alerts for repeated failures

2. **Partial Payments:**
   - Support multiple payments per invoice
   - Track remaining balance
   - Automatic status updates

3. **Disputes/Refunds:**
   - Track dispute status
   - Link refunds to original payment
   - Maintain audit trail

### **C. User Experience**

1. **Payment Links:**
   - Mobile-optimized
   - Clear payment amount
   - Multiple payment method options
   - Receipt generation

2. **BSB/Account Payments:**
   - Clear instructions on invoice
   - Prominent reference number
   - Confirmation email when payment received

3. **Payment Status:**
   - Real-time updates in dashboard
   - Email notifications
   - Payment history view

---

## 6. Recommended Implementation Phases

### **Phase 1: Foundation (Weeks 1-2)**

- [ ] Database schema migration (payment tables)
- [ ] Basic payment record creation
- [ ] Invoice status updates
- [ ] Admin payment entry UI

### **Phase 2: Payment Links (Weeks 3-4)**

- [ ] Stripe integration
- [ ] Payment link generation
- [ ] Webhook handling
- [ ] Payment link tracking

### **Phase 3: BSB/Account Support (Weeks 5-6)**

- [ ] BSB/account display on invoices
- [ ] Manual payment entry
- [ ] Payment matching logic
- [ ] Reconciliation UI

### **Phase 4: Automation (Weeks 7-8)**

- [ ] Bank statement import
- [ ] Automated matching
- [ ] PayTo integration (optional)
- [ ] Advanced reconciliation

### **Phase 5: Polish (Weeks 9-10)**

- [ ] Payment analytics
- [ ] Reporting
- [ ] Notifications
- [ ] Error handling improvements

---

## 7. Cost Considerations

### **Payment Provider Fees (Approximate)**

**Stripe:**

- Card payments: 1.75% + $0.30 per transaction
- Bank transfers: Lower fees, varies
- Payment links: Included

**Azupay/Zai:**

- NPP payments: Typically 0.1-0.5% per transaction
- Lower fees than card processing
- May have monthly minimums

**Monoova:**

- PayTo: Competitive rates
- Volume-based pricing

**Recommendation:**

- Use Stripe for payment links (convenience, higher fees)
- Use Azupay/Zai for BSB/account (lower fees, B2B preference)
- Consider hybrid based on invoice size and customer preference

---

## 8. Key Takeaways

1. **Stripe-First Strategy:** Start with Stripe for everything - it handles all payment methods we need.

2. **Comprehensive Tracking:** Every payment should be tracked in your database, regardless of method.

3. **Webhook-First Design:** Build your system to handle Stripe webhooks for instant status updates.

4. **Reconciliation:** Use Stripe dashboard for reconciliation, with manual entry as fallback.

5. **Flexible Payment Methods:** Stripe Checkout supports cards, wallets, and bank transfers in one link.

6. **Audit Trail:** Maintain complete history of all payment-related actions in database.

7. **User Experience:** Make it easy for customers to pay (one-click link) and admins to track.

8. **Future-Proof:** Easy to add other providers later if needed, but Stripe covers all current requirements.

---

## 9. Next Steps

1. **Evaluate Providers:**
   - Request API documentation from Azupay and Zai
   - Compare with Stripe Australia pricing
   - Consider Monoova for PayTo if needed

2. **Design Database Schema:**
   - Review recommended tables above
   - Adapt to your specific needs
   - Plan migration strategy

3. **Prototype Integration:**
   - Start with Stripe (easiest integration)
   - Test payment link flow
   - Implement webhook handling

4. **Build Payment Tracking:**
   - Create payment table
   - Implement status workflow
   - Build admin UI for payment management

5. **Add BSB/Account Support:**
   - Display on invoices
   - Build reconciliation tools
   - Test matching logic

---

## 10. Resources

- **Stripe Australia:** https://stripe.com/au
- **Stripe Checkout Docs:** https://stripe.com/docs/payments/checkout
- **Stripe Webhooks Guide:** https://stripe.com/docs/webhooks
- **Stripe API Reference:** https://stripe.com/docs/api
- **Stripe Testing:** https://stripe.com/docs/testing
- **Stripe Dashboard:** https://dashboard.stripe.com/

---

## 11. Implementation Checklist

### Setup

- [ ] Create Stripe account
- [ ] Get API keys (test mode)
- [ ] Configure webhook endpoint
- [ ] Set up Australian bank account

### Database

- [ ] Create payment table migration
- [ ] Create payment_link table migration
- [ ] Update invoice table with payment columns
- [ ] Add indexes for performance

### Backend

- [ ] Install Stripe SDK
- [ ] Create Checkout Session endpoint
- [ ] Create webhook handler endpoint
- [ ] Implement webhook signature verification
- [ ] Add payment record creation logic

### Frontend

- [ ] Add payment link to invoice emails
- [ ] Create payment history view
- [ ] Add manual payment entry form
- [ ] Display payment status on invoices
- [ ] Add payment analytics dashboard

### Testing

- [ ] Test payment link generation
- [ ] Test webhook handling (use Stripe CLI)
- [ ] Test manual payment entry
- [ ] Test payment status updates
- [ ] Test with Stripe test cards

---

**Note:** This implementation plan focuses on Stripe as the single payment provider. All payment methods (cards, bank transfers, digital wallets) are handled through Stripe Checkout, simplifying the architecture while maintaining flexibility.
