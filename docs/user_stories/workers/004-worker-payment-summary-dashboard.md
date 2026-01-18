# User Story 004: Worker Payment Summary Dashboard

## Overview

Admins need a comprehensive dashboard view showing worker payment summaries, including total payments per worker, job counts, averages, and payment trends. This helps with financial planning and understanding worker compensation patterns.

## User Story

**As an** admin user  
**I want to** view a summary dashboard of worker payments grouped by worker  
**So that** I can quickly understand payment totals, averages, and identify workers who need payment processing

## Acceptance Criteria

1. Dashboard displays a table/list of all workers who have received payments
2. For each worker, show:
   - Worker name
   - Total number of jobs paid
   - Total payment amount (sum of all payments)
   - Average payment per job
   - Last payment date (optional)
3. Data is aggregated from all completed/paid payment batches (excluding cancelled)
4. Only workers with at least one payment record are shown (workers with no payment history are excluded from this view)
5. Currency formatting matches organization settings
6. Table supports sorting by:
   - Worker name (alphabetical)
   - Total payment (high to low, low to high)
   - Job count (high to low, low to high)
   - Average payment (high to low, low to high)
7. Admin can click to view detailed payment history for a specific worker
8. Summary updates when new payments are calculated/saved
9. Loading states shown while fetching data
10. Empty state shown when no payments exist

## Technical Details

### Current Implementation

- Component: `dashboard/components/worker-payments/worker-payment-summary.tsx`
- Hook: `dashboard/hooks/use-worker-payment-summary.ts`
- Tab location: Worker Payments → "Worker Summary" tab
- Data source: Payment history from `useWorkerPaymentHistory` hook

### Data Aggregation Logic

```typescript
interface WorkerSummary {
  workerId: string;
  workerName: string;
  jobCount: number;
  totalPayment: number;
  averagePayment: number;
  jobs: string[]; // Job IDs
}
```

Aggregation process:
1. Fetch all payment records from history
2. Group by worker_id
3. Sum payment amounts per worker
4. Count unique jobs per worker
5. Calculate average (totalPayment / jobCount)
6. Sort and display

### Related Data Sources

- `worker_payment` table: Individual payment records
- `worker` table: Worker names and details
- `job` table: Job information for context
- Payment history hook: Cached payment data

### UI Components

- Table component from `@/components/ui/table`
- Currency formatting via `useOrganizationCurrency` hook
- Card layout for summary statistics
- "View Details" button linking to payment detail dialog

## Related Components

- `dashboard/components/worker-payments/worker-payment-summary.tsx` - Main component
- `dashboard/hooks/use-worker-payment-summary.ts` - Data aggregation hook
- `dashboard/components/worker-payments/payment-detail-dialog.tsx` - Detail view
- `dashboard/app/dashboard/worker-payments/page.tsx` - Parent page with tabs

## Testing Considerations

1. **Data Accuracy**:
   - Verify totals match sum of individual payments
   - Verify job counts are correct (unique jobs per worker)
   - Verify averages are calculated correctly
   - Test with workers who have payments across multiple batches

2. **UI/UX**:
   - Test table sorting in all columns
   - Test with large number of workers (pagination if needed)
   - Test empty state when no payments
   - Test loading states
   - Test currency formatting for different currencies

3. **Edge Cases**:
   - Worker with single job payment
   - Worker with many jobs (100+)
   - Worker with zero payment amount (should still show)
   - Worker deleted but has payment history
   - Multiple payments for same job (should count once)

4. **Performance**:
   - Test with large payment history (1000+ payments)
   - Verify aggregation performance
   - Consider pagination or virtualization for large datasets

## Priority

**Priority**: High  
**Complexity**: Medium  
**Estimated Effort**: 1-2 days

## Notes

- Current implementation exists but may need enhancements
- Consider adding filters (date range, worker selection)
- Future: Add charts/graphs for payment trends over time
- Future: Add export functionality for summary data
- Consider adding "pending payments" vs "paid payments" breakdown
- May want to add worker performance metrics (jobs per period, payment trends)

## Research References

- Field service management dashboards typically show worker payment summaries
- Users expect sorting, filtering, and export capabilities
- Aggregated views help with financial planning and payroll processing
- Average payment per job helps identify high-value workers
