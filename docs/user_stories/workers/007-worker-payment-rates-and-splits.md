# User Story 007: Worker Payment Rates and Custom Splits

## Overview

Admins need to configure different payment rates for workers (e.g., supervisor rates, apprentice rates) and customize payment splits when multiple workers are assigned to the same job. This supports fair compensation based on roles, experience, and work allocation.

## User Story

**As an** admin user  
**I want to** configure different payment rates for workers and customize payment splits for jobs with multiple workers  
**So that** I can fairly compensate workers based on their roles, experience levels, and actual work contribution

## Acceptance Criteria

### Worker Rate Cards

1. Admin can create and manage rate cards for each worker
2. Rate card includes:
   - Worker selection
   - Hourly rate (decimal, currency)
   - Role/title (e.g., "Supervisor", "Senior Technician", "Apprentice")
   - Effective date range (from/to)
   - Rate type (standard, overtime, holiday, etc.)
   - Notes (optional)
3. Admin can view all rate cards for a worker
4. Admin can edit existing rate cards
5. Admin can deactivate rate cards (set effective_to date)
6. System uses active rate card when calculating payments
7. If no rate card exists, system falls back to equal split (backward compatible)

### Job-Level Payment Allocation

8. Admin can configure custom payment allocation for jobs with multiple workers
9. Allocation options:
   - Percentage-based (must sum to 100%)
   - Fixed amount per worker (must sum to total)
   - Hours-based (proportional to hours worked)
10. Admin can set allocation per job before or after calculation
11. Allocation can be per grouped breakdown field option (e.g., Room 101: Worker A 60%, Worker B 40%)
12. System validates allocations (percentages sum to 100%, amounts sum correctly)
13. Admin can use "auto-split equally" button for quick equal distribution
14. Allocation overrides worker rate cards when specified

### Payment Calculation with Rates

15. When calculating payments with rate cards:
    - System looks up each worker's hourly rate
    - For hourly-based payments: `payment = (job_total / sum_of_all_rates) * worker_rate`
    - For percentage-based: Uses configured percentages
    - For hours-based: Uses hours worked × hourly rate
16. Calculation preview shows rate-based breakdown
17. Admin can see which rate card was used for each worker

### Mobile App Integration (Future)

18. When workers complete jobs with grouped breakdown fields, they can allocate percentages per item
19. Mobile app shows worker selection and percentage sliders
20. Percentages auto-sum to 100% with validation
21. Allocation saved to job submission data

## Technical Details

### Database Schema (Proposed)

**Worker Rate Card Table**:
```sql
CREATE TABLE worker_rate_card (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
  hourly_rate DECIMAL(10, 2) NOT NULL CHECK (hourly_rate > 0),
  currency TEXT NOT NULL DEFAULT 'AUD',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  rate_type TEXT DEFAULT 'standard' CHECK (rate_type IN ('standard', 'overtime', 'holiday')),
  role_title TEXT, -- 'Supervisor', 'Senior Technician', etc.
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure no overlapping active rate cards for same worker/rate_type
  CONSTRAINT worker_rate_card_no_overlap EXCLUDE USING gist (
    worker_id WITH =,
    rate_type WITH =,
    daterange(effective_from, effective_to, '[]') WITH &&
  ) WHERE (is_active = TRUE)
);

-- Index for finding current active rate
CREATE INDEX idx_worker_rate_card_lookup ON worker_rate_card(worker_id, rate_type, effective_from DESC) WHERE is_active = TRUE;

-- RLS follows existing pattern
ALTER TABLE worker_rate_card ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage worker_rate_card"
  ON worker_rate_card
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
```

> **Schema Notes**:
> - Uses DATE instead of TIMESTAMPTZ for effective dates (rate changes typically happen on specific dates, not times)
> - Added CHECK constraint ensuring hourly_rate > 0 (zero rates would break proportional calculations)
> - Uses an EXCLUDE constraint to prevent overlapping active rate cards
> - Added `is_active` flag for soft-delete capability

**Worker Payment Allocation Table**:
```sql
CREATE TABLE worker_payment_allocation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  allocation_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage', 'amount', 'hours'
  percentage DECIMAL(5, 2) CHECK (percentage >= 0 AND percentage <= 100),
  fixed_amount DECIMAL(10, 2) CHECK (fixed_amount >= 0),
  hours_worked DECIMAL(5, 2) CHECK (hours_worked >= 0),
  field_config_id UUID REFERENCES field_config(id) ON DELETE CASCADE,
  option_value TEXT, -- For grouped breakdown options
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, worker_id, field_config_id, option_value)
);
```

### Calculation Logic Updates

**Rate-Based Split**:
```typescript
function calculateRateBasedSplit(
  jobTotal: number,
  workers: Worker[],
  rateCards: Map<string, RateCard>
): Map<string, number> {
  const payments = new Map<string, number>();
  
  // Get rates for all workers, using default rate for those without rate cards
  const workerRates = workers.map(worker => ({
    workerId: worker.id,
    rate: rateCards.get(worker.id)?.hourly_rate ?? null
  }));
  
  // Check if all workers have rate cards
  const allHaveRates = workerRates.every(wr => wr.rate !== null);
  
  if (!allHaveRates) {
    // Fallback to equal split if any worker lacks a rate card
    const equalShare = jobTotal / workers.length;
    workers.forEach(worker => payments.set(worker.id, equalShare));
    return payments;
  }
  
  // All workers have rates - calculate proportional split
  const totalRate = workerRates.reduce((sum, wr) => sum + (wr.rate as number), 0);
  
  if (totalRate === 0) {
    throw new Error('Total rate cannot be zero');
  }
  
  workerRates.forEach(wr => {
    payments.set(wr.workerId, (jobTotal * (wr.rate as number)) / totalRate);
  });
  
  return payments;
}
```

> **Implementation Note**: The function falls back to equal split if ANY worker lacks a rate card. This ensures backward compatibility and prevents errors when rate cards are partially configured. The database constraint ensures rates are always > 0.

**Allocation Override**:
- Check for `worker_payment_allocation` records first
- If allocations exist, use them instead of rate cards
- If no allocations, fall back to rate cards
- If no rate cards, use equal split (current behavior)

### UI Components

**Rate Card Management**:
- Location: Worker settings or Worker Payments → Rate Cards
- Form: Worker selector, hourly rate, role, effective dates
- List: All rate cards with active/inactive status

**Job Allocation Configuration**:
- Location: Job detail dialog or Payment calculation preview
- Interface: Worker list with percentage sliders or amount inputs
- Validation: Real-time sum validation (must equal 100% or total)

### Migration Strategy

1. **Phase 1**: Add rate card tables and UI (optional, backward compatible)
2. **Phase 2**: Update calculation logic to use rate cards
3. **Phase 3**: Add job-level allocation support
4. **Phase 4**: Mobile app integration for grouped breakdown fields

## Related Components

- `docs/worker-payment-split-strategies.md` - Detailed strategy document
- `database/supabase/functions/calculate-worker-payment/index.ts` - Calculation logic
- `database/supabase/functions/save-worker-payment/index.ts` - Save logic (needs update)
- Future: `dashboard/components/worker-payments/rate-card-manager.tsx`
- Future: `dashboard/components/worker-payments/job-allocation-dialog.tsx`

## Testing Considerations

1. **Rate Cards**:
   - Test creating rate card for worker
   - Test multiple rate cards (different effective dates)
   - Test active rate card lookup
   - Test fallback when no rate card exists
   - Test rate card deactivation

2. **Payment Allocation**:
   - Test percentage allocation (must sum to 100%)
   - Test fixed amount allocation (must sum to total)
   - Test hours-based allocation
   - Test allocation per grouped breakdown option
   - Test validation errors (sum not equal to 100%)

3. **Calculation**:
   - Test rate-based calculation
   - Test allocation override
   - Test fallback to equal split
   - Test mixed scenarios (some workers have rates, some don't)

4. **UI/UX**:
   - Test rate card form validation
   - Test allocation slider/input interface
   - Test auto-split equally button
   - Test calculation preview with rates

5. **Edge Cases**:
   - Worker with no rate card (fallback)
   - Job with allocation but worker removed
   - Rate card effective date in future
   - Multiple rate cards overlapping dates
   - Zero rate (should error or handle gracefully)

## Priority

**Priority**: Medium-High  
**Complexity**: High  
**Estimated Effort**: 5-7 days

## Notes

- This is a significant enhancement to current equal-split system
- Backward compatibility is critical (existing jobs continue working)
- Rate cards provide immediate value for role-based payments
- Job-level allocation provides flexibility for edge cases
- Mobile app integration is future phase
- Consider adding "rate history" to track rate changes over time
- May want to add "default rate" per worker role for quick setup

## Research References

- Field service businesses commonly use different rates for supervisors vs regular workers
- Hourly rate differences based on experience/role are standard practice
- Percentage-based splits are common for team jobs (e.g., cleaning, construction)
- Users expect flexibility to override default rates for special cases
- Rate cards help with compliance (minimum wage, overtime calculations)
