# User Story 007: Worker Payment Rates and Custom Splits

## Overview

Admins need to configure different payment modifiers for workers (e.g., supervisor bonuses, role-based multipliers) and enable fair payment distribution when multiple workers are assigned to the same job. The system supports **time-based revenue distribution** where workers log their hours, and the job's total payment (calculated from output-based pricing like "per car cleaned") is distributed proportionally based on actual time worked, with optional role-based bonuses applied.

## User Story

**As an** admin user  
**I want to** configure payment modifiers for workers and enable time-based payment splits for multi-worker jobs  
**So that** I can fairly compensate workers based on their actual time worked and role, even when pricing is output-based (per unit)

## Key Concepts

### Output-Based Pricing + Time-Based Distribution + Additive Bonuses

The system handles a common real-world scenario where:
- **Job pricing is output-based**: e.g., $5 per car cleaned × 100 cars = $500 total worker payment (defined by pricing rules)
- **Payment distribution is time-based**: The total worker payment is split among workers proportionally based on actual time worked
- **Role bonuses are additive**: Supervisors/seniors may receive additional bonuses **on top of** their share (not deducted from the pool)

**Important**: Pricing rules define the total worker payment for the job. This amount is distributed among workers. Bonuses are **additional** amounts paid to specific workers based on their role - they do not reduce what other workers receive.

**Example Scenario**:
```
Job: 100 cars cleaned × $5/car = $500 total worker payment (from pricing rules)
Workers:
- Alice (Supervisor): 8 hours, per-unit bonus $0.50/car
- Bob (Standard): 8 hours
- Charlie (Standard): 6 hours (arrived late)

Step 1: Time-based split of worker payment pool (22 total hours)
  Alice: 8/22 = 36.4% × $500 = $181.82
  Bob: 8/22 = 36.4% × $500 = $181.82
  Charlie: 6/22 = 27.3% × $500 = $136.36

Step 2: Calculate additive bonuses (on top of share)
  Alice bonus = 100 cars × $0.50 = $50

Final Payments:
  Alice: $181.82 + $50 = $231.82 (time share + supervisor bonus)
  Bob: $181.82
  Charlie: $136.36

Total Payout: $550 ($500 base + $50 bonus)
```

**Note**: The total payout ($550) exceeds the base worker payment ($500) because bonuses are additive. This is intentional - the organization pays extra for supervisory roles.

## Acceptance Criteria

### Time Tracking at Job Submission (Mobile App)

1. When submitting a job with multiple workers, the submitting worker enters start/end times for each worker
2. Time entries are stored with the job submission data
3. System calculates total hours and proportional percentages automatically
4. Workers can see the time breakdown in the job summary
5. Time tracking is optional - if not provided, system falls back to equal split

### Worker Rate Cards (Role-Based Modifiers)

6. Admin can create and manage rate cards for each worker
7. Rate card includes:
   - Worker selection
   - **Modifier type**: One of:
     - `per_unit` - Bonus per unit of output (e.g., $0.50/car)
     - `flat` - Fixed bonus per job (e.g., $20/job)
     - `multiplier` - Percentage boost to time-share (e.g., 1.2x = 20% more)
   - **Modifier value**: The amount/rate/multiplier
   - **Applies to fields** (for per_unit): Which mobile config fields the bonus applies to (e.g., "cars_cleaned", "rooms_serviced")
   - Role/title (e.g., "Supervisor", "Senior Technician")
   - Effective date range (from/to)
   - Notes (optional)
8. Admin can view all rate cards for a worker
9. Admin can edit existing rate cards
10. Admin can deactivate rate cards (soft delete)
11. System uses active rate card when calculating payments
12. If no rate card exists, worker receives their time-based share only (no bonus)

### Payment Calculation Flow

13. Calculation steps:
    1. **Time-based split**: Total worker payment (from pricing rules) is split by hours worked
    2. **Multipliers**: Applied to each worker's time-share (multiplies their portion)
    3. **Per-unit bonuses**: Added on top of worker's share (not deducted from pool)
    4. **Flat bonuses**: Added on top of worker's share (not deducted from pool)
14. If no time tracking data, fall back to equal split of total worker payment
15. Bonuses are **additive** - they increase total payout, not redistribute existing pool
16. Calculation preview shows full breakdown:
    - Total worker payment (from pricing rules)
    - Time-share amounts per worker
    - Multiplier adjustments (if applicable)
    - Per-unit bonuses by worker
    - Flat bonuses by worker
    - Final payment per worker
    - Total payout (base + all bonuses)

### Dashboard Rate Card Management

16. Rate Card Manager accessible from Worker Payments section
17. Create/edit form with:
    - Worker selector
    - Modifier type dropdown
    - Modifier value input
    - Field selector (for per_unit type) - multi-select from mobile config fields
    - Role/title input
    - Effective date range
    - Notes
18. List view showing all active rate cards with filter by worker
19. Ability to deactivate rate cards

### Backward Compatibility

20. Existing jobs without time tracking continue to use equal split
21. Workers without rate cards receive their time-share only (no bonus penalty)
22. System gracefully handles partial data (some workers have rate cards, some don't)

## Technical Details

### Database Schema

**Worker Rate Card Table** (Updated):
```sql
CREATE TABLE worker_rate_card (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
  
  -- Modifier Configuration
  modifier_type TEXT NOT NULL DEFAULT 'flat' CHECK (
    modifier_type IN ('per_unit', 'flat', 'multiplier')
  ),
  modifier_value DECIMAL(10, 4) NOT NULL CHECK (modifier_value > 0),
  currency TEXT NOT NULL DEFAULT 'AUD',
  
  -- Role Information
  role_title TEXT, -- 'Supervisor', 'Senior Technician', etc.
  
  -- Effective Period
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Notes
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure no overlapping active rate cards for same worker
  CONSTRAINT worker_rate_card_no_overlap EXCLUDE USING gist (
    worker_id WITH =,
    daterange(effective_from, effective_to, '[]') WITH &&
  ) WHERE (is_active = TRUE)
);

-- Index for finding current active rate
CREATE INDEX idx_worker_rate_card_lookup 
  ON worker_rate_card(worker_id, effective_from DESC) 
  WHERE is_active = TRUE;
```

**Rate Card Field Mapping Table** (New - for per_unit bonuses):
```sql
CREATE TABLE worker_rate_card_field (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL REFERENCES worker_rate_card(id) ON DELETE CASCADE,
  field_config_id UUID NOT NULL REFERENCES organization_field_configs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(rate_card_id, field_config_id)
);

COMMENT ON TABLE worker_rate_card_field IS 'Maps rate cards to fields for per-unit bonuses';
```

**Job Worker Time Tracking** (Update existing job_worker table or submission_data):
```sql
-- Option A: Add columns to job_worker table
ALTER TABLE job_worker 
  ADD COLUMN start_time TIMESTAMPTZ,
  ADD COLUMN end_time TIMESTAMPTZ;

-- Option B: Store in job.submission_data as JSON
-- submission_data.worker_times = [
--   { worker_id: "...", start_time: "09:00", end_time: "17:00" },
--   { worker_id: "...", start_time: "10:30", end_time: "17:00" }
-- ]
```

### Calculation Logic

```typescript
interface WorkerTimeEntry {
  worker_id: string;
  start_time: string;
  end_time: string;
  hours: number;
}

interface RateCard {
  worker_id: string;
  modifier_type: 'per_unit' | 'flat' | 'multiplier';
  modifier_value: number;
  field_config_ids: string[]; // For per_unit type
}

interface WorkerPaymentBreakdown {
  worker_id: string;
  worker_name: string;
  hours_worked: number;
  time_share: number;           // Share of base worker payment
  multiplier_adjustment: number; // Additional from multiplier (if any)
  per_unit_bonus: number;       // Additive bonus
  flat_bonus: number;           // Additive bonus
  final_payment: number;        // Total for this worker
}

interface PaymentCalculationResult {
  base_worker_payment: number;  // From pricing rules
  total_bonuses: number;        // Sum of all additive bonuses
  total_payout: number;         // base + bonuses
  breakdowns: WorkerPaymentBreakdown[];
}

function calculateWorkerPayments(
  baseWorkerPayment: number,    // Total from pricing rules (e.g., $500)
  workers: Worker[],
  timeEntries: WorkerTimeEntry[],
  rateCards: Map<string, RateCard>,
  unitCounts: Map<string, number> // field_config_id -> count (for per_unit bonuses)
): PaymentCalculationResult {
  
  const breakdowns: WorkerPaymentBreakdown[] = [];
  
  // Initialize breakdown for each worker
  workers.forEach(worker => {
    const timeEntry = timeEntries.find(t => t.worker_id === worker.id);
    breakdowns.push({
      worker_id: worker.id,
      worker_name: `${worker.first_name} ${worker.last_name}`,
      hours_worked: timeEntry?.hours || 0,
      time_share: 0,
      multiplier_adjustment: 0,
      per_unit_bonus: 0,
      flat_bonus: 0,
      final_payment: 0
    });
  });
  
  // Step 1: Time-based split of the FULL base worker payment
  const totalHours = breakdowns.reduce((sum, b) => sum + b.hours_worked, 0);
  
  if (totalHours > 0) {
    // Proportional split by hours worked
    breakdowns.forEach(breakdown => {
      breakdown.time_share = (breakdown.hours_worked / totalHours) * baseWorkerPayment;
    });
  } else {
    // Fallback: equal split if no time tracking data
    const equalShare = baseWorkerPayment / breakdowns.length;
    breakdowns.forEach(breakdown => {
      breakdown.time_share = equalShare;
    });
  }
  
  // Step 2: Apply multipliers to time-share (increases their portion)
  breakdowns.forEach(breakdown => {
    const rateCard = rateCards.get(breakdown.worker_id);
    if (rateCard?.modifier_type === 'multiplier') {
      const originalShare = breakdown.time_share;
      breakdown.time_share = originalShare * rateCard.modifier_value;
      breakdown.multiplier_adjustment = breakdown.time_share - originalShare;
    }
  });
  
  // Step 3: Calculate ADDITIVE per-unit bonuses (on top of share, not deducted)
  breakdowns.forEach(breakdown => {
    const rateCard = rateCards.get(breakdown.worker_id);
    if (rateCard?.modifier_type === 'per_unit') {
      let bonus = 0;
      rateCard.field_config_ids.forEach(fieldId => {
        const count = unitCounts.get(fieldId) || 0;
        bonus += count * rateCard.modifier_value;
      });
      breakdown.per_unit_bonus = bonus;
    }
  });
  
  // Step 4: Calculate ADDITIVE flat bonuses (on top of share, not deducted)
  breakdowns.forEach(breakdown => {
    const rateCard = rateCards.get(breakdown.worker_id);
    if (rateCard?.modifier_type === 'flat') {
      breakdown.flat_bonus = rateCard.modifier_value;
    }
  });
  
  // Step 5: Calculate final payments (share + bonuses)
  breakdowns.forEach(breakdown => {
    breakdown.final_payment = 
      breakdown.time_share +        // Their share of base payment
      breakdown.per_unit_bonus +    // Additive bonus
      breakdown.flat_bonus;         // Additive bonus
  });
  
  // Calculate totals
  const totalBonuses = breakdowns.reduce(
    (sum, b) => sum + b.per_unit_bonus + b.flat_bonus + b.multiplier_adjustment, 
    0
  );
  const totalPayout = baseWorkerPayment + totalBonuses;
  
  return {
    base_worker_payment: baseWorkerPayment,
    total_bonuses: totalBonuses,
    total_payout: totalPayout,
    breakdowns
  };
}
```

### Mobile App Changes

**Job Submission - Worker Time Entry**:
```typescript
// In job submission form, after selecting workers
interface WorkerTimeInput {
  worker_id: string;
  worker_name: string;
  start_time: string; // "HH:MM" format
  end_time: string;   // "HH:MM" format
}

// UI: List of workers with time pickers
// - Default start time: Current time - 8 hours
// - Default end time: Current time
// - Validation: end_time > start_time

// Stored in submission_data:
{
  ...existingFields,
  worker_times: [
    { worker_id: "uuid-1", start_time: "09:00", end_time: "17:00" },
    { worker_id: "uuid-2", start_time: "10:30", end_time: "17:00" }
  ]
}
```

### UI Components

**Rate Card Manager** (Dashboard):
- Location: Worker Payments → Rate Cards tab
- Features:
  - List all rate cards with worker name, modifier type, value, role
  - Create new rate card with modifier type selection
  - Field selector (multi-select) appears when modifier_type = 'per_unit'
  - Edit/deactivate existing cards

**Payment Preview** (Dashboard):
- Enhanced to show full breakdown:
  - Per-unit bonuses
  - Flat bonuses
  - Time-based shares
  - Multiplier adjustments
  - Final amounts

## Migration Strategy

1. **Phase 1**: Update rate card schema (modifier_type instead of hourly_rate)
2. **Phase 2**: Add rate_card_field mapping table
3. **Phase 3**: Update calculation logic for new modifier types
4. **Phase 4**: Update dashboard Rate Card Manager UI
5. **Phase 5**: Add time tracking to mobile app job submission
6. **Phase 6**: Update payment preview to show full breakdown

## Testing Considerations

1. **Time-Based Distribution**:
   - Equal hours = equal share of base payment
   - Different hours = proportional share of base payment
   - One worker missing time = fallback to equal split
   - All workers missing time = equal split

2. **Per-Unit Bonuses (Additive)**:
   - Bonus correctly calculated from unit count × rate
   - Multiple fields summed correctly
   - Bonus added ON TOP of time share (not deducted from pool)
   - Total payout increases by bonus amount

3. **Flat Bonuses (Additive)**:
   - Fixed amount added ON TOP of time share
   - Multiple workers with flat bonuses all receive their bonus
   - Total payout increases by sum of all flat bonuses

4. **Multipliers**:
   - Applied to time-share portion
   - Correctly increases time-share (e.g., 1.2x = 20% more)
   - Only affects the worker with the multiplier

5. **Combined Scenarios**:
   - Supervisor (per-unit) + standard workers (no modifier)
   - Senior (multiplier) + junior (no modifier) + supervisor (flat)
   - Worker arrives late (less hours) + supervisor bonus
   - Verify total payout = base payment + all bonuses

6. **Edge Cases**:
   - Zero hours worked (fallback to equal split)
   - Rate card effective date in future (should not apply)
   - Worker with no rate card (receives time share only, no penalty)
   - Very large bonuses (should still be additive, warn admin in UI)

## Priority

**Priority**: Medium-High  
**Complexity**: High  
**Estimated Effort**: 7-10 days

## Notes

- This represents a significant evolution from simple equal-split or hourly-rate systems
- Time tracking at submission enables fair distribution for output-based pricing
- **Bonuses are additive**: They increase total payout rather than redistributing the existing pool
  - This honors the pricing rules (workers receive what's defined per unit)
  - Organization pays extra for supervisory/senior roles
  - Future versions may add option to deduct bonuses from pool if needed
- Modifier types (per_unit, flat, multiplier) cover common real-world scenarios
- Per-unit field mapping allows flexibility (bonus on cars, rooms, etc.)
- System remains backward compatible (no time data = equal split)
- Future enhancement: Admin approval step for unusual splits
- Future enhancement: Worker self-reporting time via mobile app check-in/out
- Future enhancement: Option to configure bonuses as deductive vs additive

## Related Documents

- `docs/user_stories/workers/003-worker-payment-calculation-flow.md` - Base calculation flow
- `docs/user_stories/workers/004-worker-payment-summary-dashboard.md` - Payment summary display
- `docs/user_stories/workers/005-worker-payment-history.md` - Payment history tracking
