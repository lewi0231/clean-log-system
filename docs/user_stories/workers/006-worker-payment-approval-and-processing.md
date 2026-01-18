# User Story 006: Worker Payment Approval and Processing

## Overview

Admins need a workflow to review, approve, and mark payments as paid. This includes reviewing payment details, adding notes, tracking payment methods, and updating payment status through the lifecycle from calculated to paid.

## User Story

**As an** admin user  
**I want to** review, approve, and mark worker payments as paid with payment method tracking  
**So that** I can manage the payment workflow from calculation through completion and maintain accurate payment records

## Acceptance Criteria

1. Admin can view payment batch details before approval
2. Admin can approve a payment batch (status: calculated → approved)
3. Admin can mark a payment batch as paid (status: approved/processing → paid)
4. When marking as paid, admin can specify:
   - Payment method (bank transfer, cash, check, payroll system, other)
   - Payment reference (bank reference number, check number, etc.)
   - Payment date (defaults to today, can be adjusted)
   - Notes (optional)
5. Payment status updates are reflected immediately in payment history
6. Batch status automatically updates when all individual payments are marked paid
7. Individual payment records can be updated separately if needed
8. Payment status changes are audited (who, when, what changed)
9. Admin can cancel a payment batch if calculation was incorrect
10. Status badges clearly show current payment state

## Technical Details

### Current Implementation

- Edge function: `database/supabase/functions/update-worker-payment-status/index.ts`
- Component: `dashboard/components/worker-payments/mark-payment-paid-dialog.tsx`
- Status update supports both individual payments and batch updates
- Database supports status tracking in `worker_payment` and `worker_payment_batch` tables

### Payment Status Workflow

```
Payment Batch Lifecycle:
calculated → approved → processing → completed (all paid)

Individual Payment Lifecycle:
calculated → pending → processing → paid
```

### Status Update Endpoint

**Endpoint**: `update-worker-payment-status`

**Request Body**:
```typescript
{
  organization_id: string;
  batch_id?: string;        // Update all payments in batch
  payment_id?: string;       // Update single payment
  status: 'approved' | 'paid' | 'cancelled' | 'processing';
  payment_method?: 'bank_transfer' | 'cash' | 'check' | 'payroll_system' | 'other';
  payment_reference?: string;
  paid_at?: string;          // ISO timestamp
  notes?: string;
}
```

### Database Updates

When marking as paid:
- `worker_payment.status` → `'paid'`
- `worker_payment.payment_method` → selected method
- `worker_payment.payment_reference` → reference number
- `worker_payment.paid_at` → payment date
- `worker_payment.paid_by` → current user ID
- `worker_payment_batch.status` → `'completed'` (if all payments paid)

### Approval Workflow

1. **Review**: Admin views payment details
2. **Approve**: Admin approves batch (status: `approved`)
3. **Process**: Admin marks as processing (optional, status: `processing`)
4. **Pay**: Admin marks as paid with payment details (status: `paid`)
5. **Complete**: Batch automatically marked `completed` when all payments paid

## Related Components

- `dashboard/components/worker-payments/mark-payment-paid-dialog.tsx` - Mark as paid UI
- `dashboard/components/worker-payments/payment-detail-dialog.tsx` - Review details
- `dashboard/components/worker-payments/payment-history-list.tsx` - Status display
- `database/supabase/functions/update-worker-payment-status/index.ts` - Status update logic

## Testing Considerations

1. **Status Updates**:
   - Test batch status update (all payments)
   - Test individual payment status update
   - Test status transitions (calculated → approved → paid)
   - Test invalid status transitions (should error)

2. **Payment Details**:
   - Test payment method selection
   - Test payment reference input
   - Test payment date selection (past, today, future)
   - Test notes field
   - Test required vs optional fields

3. **Batch Completion**:
   - Test batch auto-completion when all payments paid
   - Test batch with mixed payment statuses
   - Test cancellation workflow

4. **UI/UX**:
   - Test status badge updates immediately
   - Test dialog opens/closes correctly
   - Test form validation
   - Test error handling
   - Test success feedback

5. **Edge Cases**:
   - Marking single payment as paid in batch
   - Cancelling approved batch
   - Updating payment method after marking paid
   - Payment date in future (should be allowed for scheduled payments)

6. **Audit Trail**:
   - Verify `paid_by` is set correctly
   - Verify `paid_at` timestamp is accurate
   - Verify status changes are logged (if audit table exists)

## Priority

**Priority**: High  
**Complexity**: Medium  
**Estimated Effort**: 2-3 days

## Notes

- Current implementation supports marking as paid
- May need to add explicit "approve" action/button
- Consider adding "bulk mark as paid" for multiple batches
- Payment method tracking is important for accounting integration
- Payment reference helps with bank reconciliation
- Consider adding payment confirmation emails to workers
- Future: Integration with payroll systems (automatic status updates)

## Research References

- Payment approval workflows are standard in financial systems
- Users expect clear status indicators and workflow steps
- Payment method tracking is essential for accounting
- Audit trails are required for financial compliance
- Status badges help users quickly understand payment state
