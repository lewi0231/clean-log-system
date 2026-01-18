# User Story 005: Worker Payment History

## Overview

Admins need to view a complete history of all payment calculations and batches, with filtering, status tracking, and detailed views. This supports audit trails, payment reconciliation, and financial reporting.

## User Story

**As an** admin user  
**I want to** view a complete history of all worker payment calculations with filtering and status tracking  
**So that** I can audit payments, track payment processing status, and reconcile financial records

## Acceptance Criteria

1. History list displays all payment batches in reverse chronological order (newest first)
2. For each payment batch, show:
   - Date range of jobs included
   - Number of jobs in batch
   - Number of unique workers
   - Total payment amount
   - Payment status (calculated, approved, processing, paid, cancelled)
   - Calculated date/time
   - Calculated by (admin name)
3. Status badges clearly indicate payment state with appropriate colors
4. Date range filtering:
   - Filter by start date
   - Filter by end date
   - Clear filters button
   - Filters apply to calculation date, not job date
5. Admin can view detailed breakdown for any payment batch
6. Admin can mark payments as paid (see Story 006)
7. Admin can export payment batch to CSV
8. Empty state shown when no payments exist
9. Loading states during data fetch
10. Payment history updates when new batches are created

## Technical Details

### Current Implementation

- Component: `dashboard/components/worker-payments/payment-history-list.tsx`
- Hook: `dashboard/hooks/use-worker-payment-history.ts`
- Tab location: Worker Payments → "Payment History" tab
- Data source: `worker_payment_batch` table via edge function

### Payment Status Flow

**Batch Status Flow:**
```
calculated → approved → processing → completed
                ↓
            cancelled
```

**Individual Payment Status Flow:**
```
calculated → pending → processing → paid
                          ↓
                      failed/cancelled
```

Status meanings (Batch):
- **calculated**: Payment batch calculated but not reviewed
- **approved**: Reviewed and approved, ready for payment
- **processing**: Payments being processed (e.g., payroll system)
- **completed**: All individual payments in batch are paid
- **cancelled**: Batch cancelled (e.g., calculation error)

Status meanings (Individual Payment):
- **calculated**: Payment calculated, part of a batch
- **pending**: Approved and awaiting processing
- **processing**: Payment being processed
- **paid**: Payment completed
- **failed**: Payment failed (can be retried)
- **cancelled**: Payment cancelled

### Database Schema

- `worker_payment_batch` table:
  - `id`, `organization_id`, `calculated_at`, `calculated_by`
  - `total_payment`, `currency`, `job_count`, `worker_count`
  - `status` (calculated, approved, processing, completed, cancelled)
  - `calculation_data` (JSONB with full calculation details)
  - `notes`, `created_at`, `updated_at`

### Filtering Logic

- Date filters apply to `calculated_at` timestamp
- Frontend filtering via `filterByDateRange` function
- Backend could support server-side filtering for performance

### Export Functionality

- CSV export via `WorkerPaymentService.exportPaymentsToCSV()`
- Includes: Worker name, job details, payment amount, status
- Downloadable file with timestamp in filename

## Related Components

- `dashboard/components/worker-payments/payment-history-list.tsx` - Main component
- `dashboard/components/worker-payments/payment-detail-dialog.tsx` - Detail view
- `dashboard/components/worker-payments/mark-payment-paid-dialog.tsx` - Mark as paid
- `dashboard/hooks/use-worker-payment-history.ts` - Data fetching hook
- `dashboard/lib/services/worker-payment.service.ts` - Export service

## Testing Considerations

1. **Data Display**:
   - Verify all payment batches are shown
   - Verify correct date range display
   - Verify status badges match database status
   - Verify calculated by name is correct

2. **Filtering**:
   - Test start date filter
   - Test end date filter
   - Test both filters together
   - Test clear filters
   - Test edge cases (no results, all results)

3. **Actions**:
   - Test "View Details" opens correct dialog
   - Test "Mark as Paid" workflow (see Story 006)
   - Test CSV export generates correct file
   - Test export with different data sets

4. **Edge Cases**:
   - Empty history (no payments)
   - Very old payments (date formatting)
   - Payments with cancelled status
   - Payments with missing calculated_by user
   - Large number of batches (pagination if needed)

5. **Performance**:
   - Test with large payment history (1000+ batches)
   - Verify filtering performance
   - Consider server-side filtering for large datasets

## Priority

**Priority**: High  
**Complexity**: Medium  
**Estimated Effort**: 1-2 days (mostly implemented, needs refinement)

## Notes

- Current implementation exists but may need enhancements
- Consider adding search functionality (by worker name, job ID, batch ID)
- Consider adding bulk actions (mark multiple as paid)
- Future: Add payment reconciliation features
- Future: Add payment reports (PDF generation)
- Consider adding payment method tracking in history
- May want to add "payment period" concept (weekly, bi-weekly, monthly)

## Research References

- Payment history is standard in payroll and field service systems
- Users expect filtering, sorting, and export capabilities
- Status tracking is critical for audit trails
- Date range filtering is essential for financial reporting
- CSV export is standard for accounting integration
