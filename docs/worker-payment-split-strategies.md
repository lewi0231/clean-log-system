# Worker Payment Split Strategies

## Overview

This document outlines proposed solutions for handling worker payment allocation when multiple workers are assigned to the same job, supporting different payment scenarios based on worker roles, experience levels, and work allocation.

## Current State

Currently, when multiple workers are assigned to a job, the total worker payment is **split equally** among all workers. This is documented in `save-worker-payment/index.ts` with a note that this may not be appropriate for all business scenarios.

## Use Cases

### 1. Hourly Rate Differences (Role-Based)

**Scenario**: Different workers have different hourly rates based on their role/experience.

**Example**:

- Supervisor: $50/hour
- Regular Worker: $30/hour
- Apprentice: $20/hour

**Challenge**: Calculate payments based on each worker's individual rate and time worked.

### 2. Per-Item Percentage Allocation (Work-Based Split)

**Scenario**: Workers complete different quantities of items, and payment should reflect their contribution.

**Example**:

- Job involves cleaning 10 rooms
- Worker A cleans 7 rooms (70%)
- Worker B cleans 3 rooms (30%)
- Payment: $500 total
  - Worker A: $350 (70%)
  - Worker B: $150 (30%)

**Challenge**: Allow configuration of percentage splits per job, especially for grouped breakdown fields.

## Proposed Solutions

### Solution 1: Worker Rate Cards

Store base hourly rates per worker at the organization level.

#### Database Schema

```sql
-- New table: worker_rate_card
CREATE TABLE worker_rate_card (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES worker(id) ON DELETE CASCADE,

  -- Rate configuration
  hourly_rate DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',

  -- Effective date range
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,

  -- Metadata
  rate_type TEXT DEFAULT 'standard', -- 'standard', 'overtime', 'holiday', etc.
  role_title TEXT, -- e.g., 'Supervisor', 'Senior Technician'
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, worker_id, rate_type, effective_from)
);

-- Indexes
CREATE INDEX idx_worker_rate_card_org_worker ON worker_rate_card(organization_id, worker_id);
CREATE INDEX idx_worker_rate_card_effective ON worker_rate_card(effective_from, effective_to);

-- RLS policies (similar to other tables)
ALTER TABLE worker_rate_card ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage worker rate cards"
  ON worker_rate_card
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
```

#### Usage Pattern

When calculating worker payments:

1. Look up each worker's hourly rate from `worker_rate_card`
2. If no rate card exists, fall back to equal split (backward compatible)
3. For hourly-based payments, use: `payment = (job_total / sum_of_all_rates) * worker_rate`

**Alternative**: For percentage-based allocation, store percentages directly in job data (see Solution 2).

### Solution 2: Job-Level Payment Allocation

Store payment allocation percentages at the job level, allowing per-job customization.

#### Database Schema

```sql
-- New table: worker_payment_allocation
CREATE TABLE worker_payment_allocation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,

  -- Allocation configuration
  allocation_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage', 'amount', 'hours'
  percentage DECIMAL(5, 2) CHECK (percentage >= 0 AND percentage <= 100), -- 0-100%
  fixed_amount DECIMAL(10, 2) CHECK (fixed_amount >= 0),
  hours_worked DECIMAL(5, 2) CHECK (hours_worked >= 0),

  -- Context (for grouped breakdown fields)
  field_config_id UUID REFERENCES field_config(id) ON DELETE CASCADE,
  option_value TEXT, -- For grouped breakdown options

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(job_id, worker_id, field_config_id, option_value)
);

-- Indexes
CREATE INDEX idx_worker_payment_allocation_job ON worker_payment_allocation(job_id);
CREATE INDEX idx_worker_payment_allocation_worker ON worker_payment_allocation(worker_id);
CREATE INDEX idx_worker_payment_allocation_field ON worker_payment_allocation(field_config_id);

-- RLS policies
ALTER TABLE worker_payment_allocation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage worker payment allocations"
  ON worker_payment_allocation
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
```

#### Usage Pattern

When calculating payments:

1. Check for `worker_payment_allocation` records for the job
2. If allocations exist, use them instead of equal split
3. If allocations exist for specific `field_config_id` + `option_value`, apply them per item
4. Sum allocations to ensure they total 100% (or validate during save)

### Solution 3: Grouped Breakdown Field Worker Percentages

For grouped breakdown fields, allow configuration of worker percentages per option, visible only when workers are selected.

#### UX Flow

**Scenario**: Cleaning job with grouped breakdown (rooms cleaned)

1. **Mobile App**: Worker selects colleagues when starting job
2. **Mobile App**: When filling grouped breakdown (e.g., "Room 101", "Room 102"), show worker percentage allocation UI
3. **UI Pattern**:
   - Display selected workers with percentage sliders
   - Auto-sum percentages (must equal 100%)
   - Allow "Auto-split" button for equal distribution
   - Save percentages to `submission_data` or `worker_payment_allocation` table

#### Data Storage Options

**Option A**: Store in `job.submission_data`

```json
{
  "room_cleaning": [
    {
      "option": "Room 101",
      "quantity": 1,
      "worker_allocation": {
        "worker-id-1": 60,
        "worker-id-2": 40
      }
    }
  ]
}
```

**Option B**: Store in `worker_payment_allocation` table (more normalized)

**Recommendation**: Use Option B (separate table) for better querying and reporting, but also store in `submission_data` for audit trail.

## Implementation Strategy

### Phase 1: Worker Rate Cards (MVP)

- Add `worker_rate_card` table
- Update `calculate-worker-payment` to use rate cards
- Fall back to equal split if no rate cards exist
- UI: Add rate card management in worker settings

### Phase 2: Job-Level Percentage Allocation

- Add `worker_payment_allocation` table
- Update payment calculation to check allocations first
- UI: Add allocation configuration in job detail/edit dialog
- Validation: Ensure percentages sum to 100%

### Phase 3: Grouped Breakdown Field Integration

- Extend mobile app to allow percentage allocation per grouped breakdown option
- Update calculation logic to apply allocations per item
- UI: Percentage slider interface in mobile app

## UX Design Patterns

### Pattern 1: Worker Rate Card Management

**Location**: Settings → Workers → [Worker Name] → Payment Rates

**Interface**:

```
┌─────────────────────────────────────┐
│ Worker Rate: John Doe              │
├─────────────────────────────────────┤
│ Hourly Rate: $[50.00] AUD           │
│ Role: [Supervisor ▼]                │
│ Effective From: [2024-01-01]        │
│ Effective To: [2024-12-31]          │
│                                     │
│ [Save Rate] [Cancel]                │
└─────────────────────────────────────┘
```

### Pattern 2: Job-Level Allocation Configuration

**Location**: Job Detail Dialog → Payment Allocation

**Interface**:

```
┌─────────────────────────────────────┐
│ Payment Allocation                  │
├─────────────────────────────────────┤
│ Allocation Type: [Percentage ▼]     │
│                                     │
│ Workers:                            │
│ ┌─────────────────────────────────┐ │
│ │ John Doe        [60] %          │ │
│ │ Jane Smith      [40] %          │ │
│ └─────────────────────────────────┘ │
│ Total: 100% ✓                       │
│                                     │
│ [Auto-Split Equally]                │
│ [Save Allocation]                   │
└─────────────────────────────────────┘
```

### Pattern 3: Grouped Breakdown Field Allocation (Mobile)

**Location**: Mobile App → Job Form → Grouped Breakdown Field

**Interface**:

```
┌─────────────────────────────────────┐
│ Rooms Cleaned                       │
├─────────────────────────────────────┤
│ Option: Room 101                    │
│ Quantity: [1]                       │
│                                     │
│ Worker Allocation:                  │
│ ┌─────────────────────────────────┐ │
│ │ John Doe        ━━━━━━━━━━━ 60% │ │
│ │ Jane Smith      ━━━━━━━━━ 40%   │ │
│ └─────────────────────────────────┘ │
│ [Auto-Split]                        │
│                                     │
│ [+ Add Option]                      │
└─────────────────────────────────────┘
```

### Pattern 4: Payment Calculation Preview

**Location**: Calculate Payments Dialog → Preview

**Interface**:

```
┌─────────────────────────────────────┐
│ Payment Calculation Preview         │
├─────────────────────────────────────┤
│ Job: Site Cleanup                   │
│ Total Payment: $500.00              │
│                                     │
│ Worker Breakdown:                   │
│ ┌─────────────────────────────────┐ │
│ │ John Doe (60%)    $300.00       │ │
│ │ Jane Smith (40%)  $200.00       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Split Method: Manual Allocation     │
│ [Save Payment]                      │
└─────────────────────────────────────┘
```

## Calculation Logic Updates

### Updated Payment Split Algorithm

```typescript
interface PaymentSplitStrategy {
  type: "equal" | "rate_based" | "percentage" | "hours_based";
  allocations?: Map<string, number>; // worker_id -> percentage or amount
  rates?: Map<string, number>; // worker_id -> hourly_rate
  hours?: Map<string, number>; // worker_id -> hours_worked
}

function calculateWorkerPaymentSplit(
  jobTotal: number,
  workerIds: string[],
  strategy: PaymentSplitStrategy
): Map<string, number> {
  const payments = new Map<string, number>();

  switch (strategy.type) {
    case "percentage":
      // Use explicit percentages from allocations
      strategy.allocations?.forEach((percentage, workerId) => {
        payments.set(workerId, (jobTotal * percentage) / 100);
      });
      break;

    case "rate_based":
      // Split based on hourly rates (proportional)
      const totalRate = Array.from(strategy.rates?.values() || []).reduce(
        (a, b) => a + b,
        0
      );
      strategy.rates?.forEach((rate, workerId) => {
        payments.set(workerId, (jobTotal * rate) / totalRate);
      });
      break;

    case "hours_based":
      // Split based on hours worked
      const totalHours = Array.from(strategy.hours?.values() || []).reduce(
        (a, b) => a + b,
        0
      );
      strategy.hours?.forEach((hours, workerId) => {
        payments.set(workerId, (jobTotal * hours) / totalHours);
      });
      break;

    case "equal":
    default:
      // Equal split (current behavior)
      const perWorker = jobTotal / workerIds.length;
      workerIds.forEach((workerId) => {
        payments.set(workerId, perWorker);
      });
      break;
  }

  return payments;
}
```

## Validation Rules

1. **Percentage Allocations**: Must sum to 100% (within tolerance, e.g., 99.9% - 100.1%)
2. **Fixed Amount Allocations**: Must sum to total payment (within tolerance)
3. **Rate-Based**: At least one rate must be defined
4. **Hours-Based**: At least one hour entry must be > 0
5. **Allocation Override**: Job-level allocations override worker rate cards

## Migration Strategy

1. **Backward Compatibility**: Default to equal split if no allocation data exists
2. **Gradual Rollout**:
   - Phase 1: Rate cards (optional, defaults to equal split)
   - Phase 2: Job-level allocations (optional, overrides rate cards)
   - Phase 3: Mobile app integration (optional, stores in allocations table)
3. **Data Migration**: Existing jobs continue using equal split until explicitly reconfigured

## Testing Considerations

1. **Edge Cases**:

   - Single worker (should get 100%)
   - Zero allocation (should be prevented)
   - Negative percentages (should be prevented)
   - Percentages > 100% (should be prevented)

2. **Integration Tests**:

   - Payment calculation with rate cards
   - Payment calculation with percentage allocations
   - Payment calculation with mixed strategies
   - Fallback to equal split when no data exists

3. **UX Tests**:
   - Percentage slider interaction
   - Auto-split functionality
   - Validation error messages
   - Mobile app percentage input

## Open Questions

1. **Time Tracking**: Should we add time tracking (hours worked) to jobs, or keep it separate?
2. **Multi-Currency**: How do rate cards handle different currencies for the same worker?
3. **Historical Rates**: Should we store historical rate changes, or just current rates?
4. **Audit Trail**: Should allocation changes be logged separately, or rely on job update timestamps?

## Recommendations

1. **Start with Solution 1 (Rate Cards)**: Provides immediate value with minimal complexity
2. **Add Solution 2 (Job-Level Allocations)**: Gives flexibility for edge cases
3. **Integrate Solution 3 (Grouped Breakdown)**: Provides granular control for item-based work
4. **UX Priority**: Focus on percentage sliders and auto-split functionality for best user experience
5. **Mobile-First**: Design the mobile app allocation UI first, then mirror in dashboard
