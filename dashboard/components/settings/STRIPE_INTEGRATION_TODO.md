# Stripe Integration TODO

## Overview

This document outlines the tasks needed to complete the Stripe payment integration for invoice payments.

## Current Status

- ✅ Database schema updated with `stripe_account_id` and `payment_provider` fields
- ✅ Settings UI created for Stripe connection
- ✅ Basic disconnect functionality implemented
- ❌ Stripe OAuth connection flow (not implemented)
- ❌ Payment processing (not implemented)
- ❌ Webhook handlers (not implemented)

## Implementation Tasks

### Phase 1: Stripe OAuth Connection

1. **Create Stripe OAuth Initiation Edge Function**

   - File: `database/supabase/functions/initiate-stripe-oauth/index.ts`
   - Generate Stripe OAuth authorization URL
   - Store state token for verification
   - Redirect user to Stripe authorization page

2. **Create Stripe OAuth Callback Handler**

   - File: `database/supabase/functions/stripe-oauth-callback/index.ts`
   - Verify OAuth state token
   - Exchange authorization code for access token
   - Retrieve Stripe account information
   - Store `stripe_account_id` in organization table
   - Set `payment_provider` to "stripe"

3. **Update Settings UI**
   - File: `dashboard/app/dashboard/settings/page.tsx`
   - Implement `handleConnectStripe` function
   - Redirect to OAuth initiation endpoint
   - Handle callback and update UI

### Phase 2: Payment Processing

4. **Create Payment Link Generation**

   - File: `database/supabase/functions/create-stripe-payment-link/index.ts`
   - Generate Stripe Checkout Session or Payment Link
   - Associate with invoice
   - Return payment URL to frontend

5. **Update Invoice Service**

   - File: `dashboard/lib/services/invoice.service.ts`
   - Add method to generate payment links
   - Add method to check payment status

6. **Update Invoice Preview**
   - File: `dashboard/components/invoicing/invoice-preview.tsx`
   - Add "Pay Now" button when Stripe is connected
   - Display payment status

### Phase 3: Webhook Handlers

7. **Create Stripe Webhook Handler**

   - File: `database/supabase/functions/stripe-webhook/index.ts`
   - Verify webhook signature
   - Handle payment events:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `checkout.session.completed`
   - Update invoice payment status
   - Log payment events

8. **Add Payment Status Tracking**
   - Update invoice table to include payment status
   - Track payment history
   - Add payment receipt generation

### Phase 4: Additional Features

9. **Payment History View**

   - Create payment history component
   - Display all payments for an organization
   - Filter by invoice, date, status

10. **Payment Receipts**

    - Generate PDF receipts
    - Email receipts to customers
    - Store receipts in storage

11. **Refund Handling**
    - Create refund functionality
    - Update invoice status
    - Handle partial refunds

## Environment Variables Needed

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CLIENT_ID=ca_...  # For OAuth
```

## Database Changes Required

- ✅ `organization.stripe_account_id` (already added)
- ✅ `organization.payment_provider` (already added)
- TODO: Add `invoice.payment_status` field
- TODO: Add `invoice.stripe_payment_intent_id` field
- TODO: Create `payment` table for payment history

## Testing Checklist

- [ ] OAuth connection flow works end-to-end
- [ ] Payment links are generated correctly
- [ ] Webhooks are received and processed
- [ ] Payment status updates correctly
- [ ] Error handling for failed payments
- [ ] Disconnect functionality works
- [ ] Multiple organizations can connect different Stripe accounts

## Security Considerations

- Store Stripe keys in environment variables only
- Verify webhook signatures
- Use Stripe Connect for multi-tenant support (if needed)
- Encrypt sensitive payment data
- Implement rate limiting on payment endpoints

## Future Payment Providers

- PayPal
- Square
- Bank transfer
- Custom payment methods
