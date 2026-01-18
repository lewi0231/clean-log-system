# User Story 003: Worker Payment Calculation Flow

## Overview

Admins need a streamlined workflow to calculate worker payments for completed jobs. This includes selecting jobs, previewing calculations, understanding payment breakdowns, and saving payment batches for processing.

## User Story

**As an** admin user  
**I want to** calculate worker payments for completed jobs with a clear preview and breakdown  
**So that** I can accurately determine how much to pay each worker before processing payments

## Acceptance Criteria

1. Admin can select multiple completed jobs from a list or date range
2. System calculates worker payments based on configured pricing rules
3. Calculation preview shows:
   - Total payment amount per job
   - Payment breakdown per worker per job
   - Line items and applied pricing rules
   - Currency display matching organization settings
4. Admin can review calculation details before saving
5. Admin can save calculation as a payment batch with status "calculated"
6. System handles multiple workers on same job (currently equal split, with future support for custom rates)
7. Calculation respects worker payment rules from pricing configuration
8. Error messages are clear if calculation fails (e.g., missing pricing rules, invalid job data)
9. Calculation can be cancelled without saving
10. Saved calculations appear in payment history immediately

## Technical Details

### Current Implementation

- Calculation endpoint: `database/supabase/functions/calculate-worker-payment/index.ts`
- Save endpoint: `database/supabase/functions/save-worker-payment/index.ts`
- UI component: `dashboard/components/worker-payments/calculate-payment-dialog.tsx`
- Service: `dashboard/lib/services/worker-payment.service.ts`
- Payment calculation uses pricing rules from `pricing_rule` table
- Worker payment types: `same_structure`, `percentage`, `fixed_rate`
- Current split: Equal split among workers (see `save-worker-payment/index.ts` lines 197-209)

### Calculation Flow

1. **Job Selection**: Admin selects jobs from completed jobs list
2. **Calculation Request**: Frontend calls `calculate-worker-payment` edge function
3. **Payment Calculation**: System:
   - Fetches job data, pricing rules, field configs
   - Applies pricing rules to calculate customer invoice
   - Calculates worker payment based on `worker_payment_type` and `worker_payment_value`
   - Returns calculation with breakdown per job and worker
4. **Preview Display**: Frontend shows calculation preview
5. **Save**: Admin confirms, frontend calls `save-worker-payment` edge function
6. **Batch Creation**: System creates `worker_payment_batch` and `worker_payment` records

### Payment Split Logic

**Current**: Equal split among all workers assigned to a job
- Job pays $100, 2 workers → $50 each
- Job pays $300, 3 workers → $100 each

**Future Enhancement**: Support for:
- Worker rate cards (hourly rates per worker)
- Percentage-based allocation per job
- Hours-based proportional split
- See `docs/worker-payment-split-strategies.md` for details

### Database Schema

- `worker_payment_batch`: Groups related payments
  - Status: `calculated`, `approved`, `processing`, `completed`, `cancelled`
- `worker_payment`: Individual payment per job/worker
  - Status: `calculated`, `pending`, `processing`, `paid`, `failed`, `cancelled`
  - Includes `calculation_details` JSONB for audit trail

## Related Components

- `dashboard/components/worker-payments/calculate-payment-dialog.tsx` - Main calculation UI
- `dashboard/components/worker-payments/payment-overview.tsx` - Overview tab with calculate button
- `dashboard/hooks/use-worker-payments.ts` - Payment calculation hook
- `database/supabase/functions/calculate-worker-payment/index.ts` - Calculation logic
- `database/supabase/functions/save-worker-payment/index.ts` - Save logic

## Testing Considerations

1. **Calculation Accuracy**:
   - Test with single worker per job
   - Test with multiple workers (equal split)
   - Test with different payment types (percentage, fixed_rate, same_structure)
   - Test with jobs that have no pricing rules (should error gracefully)

2. **UI/UX**:
   - Test job selection (single, multiple, all)
   - Test calculation preview display
   - Test save confirmation
   - Test error handling and messages
   - Test loading states during calculation

3. **Edge Cases**:
   - Jobs with no workers assigned
   - Jobs with zero payment amount
   - Jobs with missing field data
   - Concurrent calculation requests
   - Large batch calculations (100+ jobs)

4. **Data Integrity**:
   - Verify batch and payment records are created correctly
   - Verify calculation_details JSONB contains expected data
   - Verify currency is set correctly from organization

## Priority

**Priority**: High  
**Complexity**: Medium  
**Estimated Effort**: 2-3 days (mostly implemented, needs refinement)

## Notes

- Current implementation exists but may need UX improvements
- Equal split limitation is documented and planned for enhancement
- Calculation uses same pricing engine as customer invoicing
- Payment batches support approval workflow (see Story 006)
- Consider adding "recalculate" functionality for existing batches

## Research References

- Field service management systems typically support batch payment calculations
- Users expect clear breakdowns showing how payments are calculated
- Preview before save is standard practice in financial workflows
- Support for different payment methods (hourly, piece rate, percentage) is common
