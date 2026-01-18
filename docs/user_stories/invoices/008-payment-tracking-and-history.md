# User Story 008: Payment Tracking and History

## Overview

Admins and customers need to track payments for invoices including payment status, methods, amounts, and history. This supports payment reconciliation and customer communication.

## User Story

**As an** admin user or customer  
**I want to** view payment history and track payment status for invoices  
**So that** I can reconcile payments, track outstanding amounts, and understand payment status

## Acceptance Criteria

### Payment History Display

1. Payment history shows all payments for an invoice:
   - Payment date/time
   - Payment amount (formatted with currency)
   - Payment method (card, bank transfer, digital wallet, etc.)
   - Payment status (succeeded, failed, pending, processing, refunded, etc.)
   - Payment reference number
   - Processing fees (if applicable)
   - Net amount received
2. Payment status indicators:
   - Succeeded: Green checkmark, "Succeeded" badge
   - Failed: Red X, "Failed" badge
   - Pending/Processing: Clock icon, "Pending" or "Processing" badge
   - Refunded: Refresh icon, "Refunded" badge
   - Disputed: Alert icon, "Disputed" badge
3. Payment methods displayed clearly:
   - Card (Stripe)
   - Bank Account (Stripe)
   - Digital Wallet (Stripe)
   - Bank Transfer (Manual)
   - Other
4. Payment totals calculated:
   - Total paid amount (sum of succeeded payments)
   - Remaining balance (invoice total - total paid)
   - Total fees (sum of all fees)
   - Net received (total paid - total fees)

### Payment Status Updates

5. Invoice status updates automatically:
   - When payment succeeds: Status → "paid", `paid_at` timestamp set
   - When payment fails: Status remains "sent" or "overdue"
   - When payment refunded: Status → "sent" (or "overdue" if past due)
6. Payment webhooks update status:
   - Stripe webhook handlers update payment status
   - Payment records created/updated automatically
   - Invoice status updated based on payment totals
7. Manual payment recording:
   - Admin can record manual payments (bank transfer, cash, check)
   - Manual payments include: amount, method, reference, date
   - Manual payments update invoice status

### Customer View

8. Customers can view payment history:
   - Via public invoice link
   - See their payments only
   - See payment status and details
   - See remaining balance

## Technical Details

### Current Implementation

- Component: `dashboard/components/invoicing/payment-history.tsx`
- Hook: `dashboard/hooks/use-payments.ts`
- Database: `payment` table
- Webhooks: Stripe webhook handlers update payments
- Edge function: `database/supabase/functions/create-payment-link/index.ts`

### Payment Data Structure

```typescript
interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  payment_reference: string | null;
  stripe_payment_intent_id: string | null;
  fees: number;
  net_amount: number;
  received_at: string | null;
  created_at: string;
}
```

### Payment Status Types

- `succeeded`: Payment completed successfully
- `failed`: Payment failed
- `pending`: Payment initiated but not completed
- `processing`: Payment being processed
- `refunded`: Payment refunded
- `partially_refunded`: Partial refund
- `disputed`: Payment disputed
- `canceled`: Payment cancelled

### Payment Methods

- `stripe_checkout_card`: Credit/debit card via Stripe
- `stripe_checkout_bank`: Bank account via Stripe
- `stripe_checkout_wallet`: Digital wallet via Stripe
- `bank_transfer_manual`: Manual bank transfer
- `other`: Other payment method

### Invoice Status Updates

Invoice status updates based on payment totals:
- If total paid >= invoice total: Status → "paid", `paid_at` set
- If total paid < invoice total and past due: Status → "overdue"
- If total paid < invoice total and not past due: Status → "sent"

## Related Components

- `dashboard/components/invoicing/payment-history.tsx` - Payment history display
- `dashboard/hooks/use-payments.ts` - Payment data fetching
- `dashboard/app/invoice/[id]/page.tsx` - Public invoice view with payments
- `database/supabase/functions/create-payment-link/index.ts` - Payment link creation

## Testing Considerations

1. **Payment Display**:
   - Test payment history shows all payments
   - Test payment status indicators
   - Test payment method labels
   - Test currency formatting
   - Test date formatting

2. **Payment Totals**:
   - Test total paid calculation
   - Test remaining balance calculation
   - Test fees calculation
   - Test net amount calculation

3. **Status Updates**:
   - Test invoice status updates on payment
   - Test paid_at timestamp set correctly
   - Test status updates for partial payments
   - Test status updates for refunds

4. **Webhooks**:
   - Test Stripe webhook updates payment status
   - Test webhook creates payment record
   - Test webhook updates invoice status

5. **Edge Cases**:
   - Invoice with no payments
   - Invoice with multiple payments
   - Invoice with failed payments
   - Invoice with refunded payments
   - Invoice with partial payments

## Priority

**Priority**: High  
**Complexity**: Medium  
**Estimated Effort**: 2-3 days (mostly implemented, needs refinement)

## Notes

- Current implementation exists but may need improvements
- Consider adding payment export (CSV/PDF)
- Consider adding payment reminders based on history
- Future: Payment analytics (average payment time, payment method trends)
- Consider adding payment notes/comments
- Future: Recurring payment support

## Research References

- Payment tracking is essential for accounts receivable
- Customers expect clear payment status visibility
- Payment history helps with reconciliation
- Status indicators improve user understanding
- Payment methods should be clearly displayed
