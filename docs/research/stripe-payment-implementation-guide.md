# Stripe Payment Implementation Guide

**Created:** January 2025  
**Status:** Implementation Plan

---

## Overview

This guide outlines the implementation of Stripe payment processing for the Tally Runner (monorepo). We're using Stripe for all payment methods:

- Payment links via Stripe Checkout
- Bank transfers via Stripe Direct Debit
- Manual bank transfers (with Stripe dashboard reconciliation)

---

## Phase 1: Setup & Configuration

### 1.1 Stripe Account Setup

1. **Create Stripe Account**
   - Sign up at https://stripe.com/au
   - Complete business verification
   - Add Australian bank account for payouts
   - **Note:** If using a Stripe Sandbox for testing, all the same steps apply - just make sure you're in the Sandbox when getting keys and setting up webhooks

2. **Get API Keys**
   - Test keys: Dashboard → Developers → API keys
   - Live keys: (after account activation)
   - Store in environment variables:
     - `STRIPE_SECRET_KEY` (server-side only)
     - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client-side)

3. **Configure Webhook Endpoint**

   **Important:** The webhook signing secret (`whsec_...`) is different from your API secret key (`sk_test_...`). You'll get the webhook secret after creating the endpoint.

   **Step-by-Step Instructions:**
   1. **Go to Stripe Dashboard:**
      - Log into your Stripe account (make sure you're in your Sandbox if using one)
      - Navigate to: **Developers** → **Webhooks** (in the left sidebar)

   2. **Add Destination:**
      - Click the **"+ Add destination"** button (purple button, top right)
      - You'll see options for destination types
      - **Choose "Webhook endpoint"** as the destination type

   3. **Configure Webhook Endpoint:**
      - **Endpoint URL:** Enter your Supabase function URL:
        ```
        https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
        ```

        - Replace `YOUR_PROJECT_REF` with your actual Supabase project reference
        - You can find this in your Supabase dashboard under Project Settings → API
        - Example: `https://abcdefghijklmnop.supabase.co/functions/v1/stripe-webhook`

   4. **Select Events to Listen To:**
      - You'll see an option to select which events to listen to
      - Choose these specific events (don't select "Send all events"):
        - ✅ `checkout.session.completed`
        - ✅ `payment_intent.succeeded`
        - ✅ `payment_intent.payment_failed`
        - ✅ `charge.refunded`
        - ✅ `charge.dispute.created`
      - Click **"Add events"**

   5. **Save the Destination:**
      - Click **"Add destination"** or **"Save"** at the bottom
      - Stripe will test the endpoint (it will fail initially since we haven't created the function yet - that's OK and expected)

   6. **Get the Webhook Signing Secret:**
      - After creating the endpoint, click on it in the webhooks list
      - In the endpoint details, find **"Signing secret"**
      - Click **"Reveal"** to show the secret (starts with `whsec_...`)
      - Copy this value - this is your `STRIPE_WEBHOOK_SECRET`
      - **Note:** This is different from your API secret key (`sk_test_...`)

   **For Testing with Stripe CLI (Local Development):**
   - You can use Stripe CLI to forward webhooks locally
   - The CLI will give you a different signing secret (also starts with `whsec_...`)
   - Use that secret when testing locally

### 1.2 Environment Variables

**Important Notes:**

- You're using a Stripe Sandbox for testing - that's perfect! All test keys work the same way.
- The webhook secret (`whsec_...`) is different from your API secret key (`sk_test_...`)
- You'll get the webhook secret after creating the webhook endpoint in Stripe Dashboard

**Add to `.env.local` (dashboard):**

```bash
# Stripe Keys (from your Sandbox)
STRIPE_SECRET_KEY=sk_test_...          # Your test secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Your test publishable key
STRIPE_WEBHOOK_SECRET=whsec_...        # Get this from webhook endpoint (different from secret key!)
```

**Add to Supabase Secrets (for Edge Functions):**

You'll need to add these to Supabase so your edge functions can access them:

```bash
# In Supabase Dashboard → Project Settings → Edge Functions → Secrets
# Or via CLI:
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

**Note:** The publishable key is only needed client-side, so it goes in `.env.local` only.

**Organization Payment Settings (stored in database):**

- These will be stored in the `organization` table, not environment variables
- Each organization will have:
  - `stripe_account_id` (if using Stripe Connect in future)
  - `bsb`, `account_number`, `account_name` (for manual transfers)

---

## Phase 2: Database Migration

### 2.1 Run Migration

```bash
# Apply the migration
supabase migration up
```

This creates:

- `payment` table
- `payment_link` table
- Updates `invoice` table with payment columns

### 2.2 Verify Schema

Check that tables are created correctly:

- Payment table has all Stripe-related columns
- Payment link table has checkout session tracking
- Invoice table has payment tracking columns

---

## Phase 3: Backend Implementation

### 3.1 Install Stripe SDK

```bash
# In dashboard directory
npm install stripe
npm install --save-dev @types/stripe
```

### 3.2 Create Stripe Client Utility

**File:** `dashboard/lib/stripe.ts`

```typescript
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20.acacia",
  typescript: true,
});
```

### 3.3 Create Payment Link Endpoint

**File:** `database/supabase/functions/create-payment-link/index.ts`

This function:

1. Creates a Stripe Checkout Session
2. Stores the session in `payment_link` table
3. Links it to the invoice
4. Returns the checkout URL

**Key Implementation:**

- Use `stripe.checkout.sessions.create()`
- Set `metadata.invoice_id` for webhook matching
- Set `success_url` and `cancel_url`
- Enable all payment methods (cards, bank transfers, wallets)

### 3.4 Create Webhook Handler

**File:** `database/supabase/functions/stripe-webhook/index.ts`

This function:

1. Verifies webhook signature
2. Handles different event types
3. Updates payment and invoice records
4. Sends notifications

**Event Handling:**

- `checkout.session.completed`: Create payment record, update invoice
- `payment_intent.succeeded`: Update payment status
- `payment_intent.payment_failed`: Log failure, notify admin
- `charge.refunded`: Update payment status, adjust invoice
- `charge.dispute.created`: Flag for admin review

---

## Phase 4: Frontend Implementation

### 4.1 Payment Link Generation

**Component:** `dashboard/components/invoicing/payment-link-button.tsx`

- Button to generate payment link for invoice
- Calls `create-payment-link` function
- Displays link or opens in new tab
- Shows link status (open, completed, expired)

### 4.2 Add Payment Link to Invoice Emails

**File:** `database/supabase/functions/_utils/email.ts`

Update `sendInvoiceEmail()` to:

- Check if invoice has payment link
- Include payment link in email template
- Add "Pay Now" button in email

### 4.3 Payment History View

**Component:** `dashboard/components/invoicing/payment-history.tsx`

- List all payments for an invoice
- Show payment status
- Display payment method
- Show fees and net amount

### 4.4 Manual Payment Entry

**Component:** `dashboard/components/invoicing/manual-payment-dialog.tsx`

- Form to enter manual bank transfer
- Match to invoice by reference number
- Create payment record
- Update invoice status

---

## Phase 5: Testing

### 5.1 Stripe Test Mode

Use Stripe test cards:

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

### 5.2 Test Webhooks Locally

**Option 1: Using Stripe CLI (Recommended for Local Development)**

1. **Install Stripe CLI:**

   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Or download from: https://stripe.com/docs/stripe-cli
   ```

2. **Login to Stripe CLI:**

   ```bash
   stripe login
   ```

   - This will open your browser to authorize the CLI
   - Make sure you're logged into the same Stripe account (and Sandbox if applicable)

3. **Forward Webhooks to Local Supabase:**

   ```bash
   # Start your local Supabase (if not already running)
   supabase start

   # Forward webhooks to your local edge function
   stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
   ```

   - The CLI will output a webhook signing secret (starts with `whsec_...`)
   - **Use this secret for local testing** - update your `.env.local` or Supabase local secrets
   - Keep this terminal running while testing

4. **Trigger Test Events:**
   ```bash
   # In a new terminal, trigger test events
   stripe trigger checkout.session.completed
   stripe trigger payment_intent.succeeded
   stripe trigger payment_intent.payment_failed
   ```

**Option 2: Using Stripe Dashboard (For Production/Staging Testing)**

- Use the webhook endpoint you created in the dashboard (points to production Supabase)
- This only works when your webhook handler is **deployed** to production Supabase
- Make test payments in Stripe's test mode
- Check the webhook logs in Stripe Dashboard → Developers → Webhooks → [Your Endpoint] → Events

**When to Use Each:**

| Scenario                   | Method                       | Webhook Secret                           |
| -------------------------- | ---------------------------- | ---------------------------------------- |
| Local development          | Stripe CLI (`stripe listen`) | CLI output secret (`whsec_...` from CLI) |
| Production/staging testing | Dashboard endpoint           | Dashboard secret (from webhook settings) |
| Real payments              | Dashboard endpoint           | Dashboard secret (from webhook settings) |

**Important:**

- Local CLI webhook secret is different from production webhook secret
- Use the CLI secret when testing locally
- Use the dashboard webhook secret for production/staging

### 5.3 Test Scenarios

1. **Payment Link Flow:**
   - Generate link for invoice
   - Click link, complete payment
   - Verify webhook updates database
   - Check invoice status updated

2. **Failed Payment:**
   - Use declined card
   - Verify failure logged
   - Check invoice remains unpaid

3. **Manual Payment:**
   - Enter manual payment
   - Verify payment record created
   - Check invoice status updated

4. **Partial Payments:**
   - Make partial payment
   - Verify invoice shows partial payment
   - Make second payment
   - Verify invoice marked as paid

---

## Phase 6: Production Deployment

### 6.1 Switch to Live Keys

1. Replace test keys with live keys
2. Update webhook endpoint to production URL
3. Test with small real transaction

### 6.2 Configure Organization Settings

Each organization needs:

- BSB and account number (for manual transfers)
- Account name (for bank transfers)
- Optional: Stripe Connect account (if multi-tenant)

### 6.3 Monitoring

Set up:

- Error logging for webhook failures
- Alerts for failed payments
- Dashboard for payment analytics
- Reconciliation reports

---

## Key Files to Create/Modify

### New Files:

- `database/supabase/migrations/20250115000000_add_stripe_payment_tables.sql`
- `dashboard/lib/stripe.ts`
- `database/supabase/functions/create-payment-link/index.ts`
- `database/supabase/functions/stripe-webhook/index.ts`
- `dashboard/components/invoicing/payment-link-button.tsx`
- `dashboard/components/invoicing/payment-history.tsx`
- `dashboard/components/invoicing/manual-payment-dialog.tsx`

### Modified Files:

- `database/supabase/functions/_utils/email.ts` (add payment link to emails)
- `dashboard/components/invoicing/invoice-preview-dialog.tsx` (show payment link)
- `dashboard/hooks/use-invoices.ts` (add payment data)

---

## Next Steps

1. ✅ Database migration created
2. ⏳ Set up Stripe account and get API keys
3. ⏳ Install Stripe SDK
4. ⏳ Create payment link endpoint
5. ⏳ Create webhook handler
6. ⏳ Build frontend components
7. ⏳ Test in Stripe test mode
8. ⏳ Deploy to production

---

## Resources

- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe API Reference](https://stripe.com/docs/api)
