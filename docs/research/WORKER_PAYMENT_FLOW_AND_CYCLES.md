# Worker Payment Flow and Payment Cycles

## Current State: What Happens After Payment is Saved

When a user clicks "Save Payment" after reviewing calculations:

1. **Calculation Saved to Database**

   - Payment batch created in `worker_payment_batch` table (status: `calculated`)
   - Individual payment records created in `worker_payment` table (status: `calculated`)
   - Each record stores:
     - Worker ID, Job ID, Amount
     - Calculation breakdown (line items, applied rules)
     - Batch ID linking related payments

2. **Current Limitations**

   - ❌ No UI to mark payments as "paid"
   - ❌ No payment cycle management
   - ❌ No bulk review/approval workflow
   - ❌ No automated payment cycle calculations
   - ✅ Database schema supports full payment tracking

3. **In Production (How Users Would Pay Workers)**

   **Manual Process (Current State):**

   - Admin reviews payment calculations in dashboard
   - Makes payments externally (bank transfer, cash, check)
   - Manually marks payments as "paid" in system (UI needed)
   - Records payment reference/date for audit trail

   **Future: Automated Processing:**

   - Export payment batch to payroll system (Xero, QuickBooks, etc.)
   - Integrate with banking API (Stripe Connect, Plaid) for direct transfers
   - Mark entire batch as "paid" after external processing

---

## Proposed Payment Cycle System

Based on best practices research, here's the recommended approach:

### Payment Cycle Configuration

**Settings to Add:**

- **Payment Frequency:** Weekly, Fortnightly (Bi-weekly), Monthly
- **Cycle Start Day:** Always Monday (standard practice)
- **Payment Day:** Day of week/month when payments are processed (e.g., "Friday of cycle end")
- **Cut-off Time:** Jobs completed before this time included in cycle

**Database Schema Addition:**

```sql
-- Add to organization_settings or create worker_payment_settings table
CREATE TABLE worker_payment_settings (
  organization_id UUID PRIMARY KEY REFERENCES organization(id) ON DELETE CASCADE,
  payment_frequency TEXT NOT NULL CHECK (payment_frequency IN ('weekly', 'fortnightly', 'monthly')),
  cycle_start_day TEXT DEFAULT 'monday', -- Always monday, but for clarity
  payment_day_of_week INTEGER, -- 0-6 for weekly/fortnightly (0=Monday)
  payment_day_of_month INTEGER, -- 1-31 for monthly
  cut_off_time TIME DEFAULT '17:00:00', -- Jobs after this time go to next cycle
  require_approval BOOLEAN DEFAULT true, -- Require review before processing
  auto_calculate BOOLEAN DEFAULT false, -- Auto-calculate at cycle end
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Payment Cycle Workflow

#### 1. **Automatic Cycle Calculation**

At cycle end (e.g., end of week/month):

- System identifies all jobs completed during the cycle period
- Calculates payments for those jobs (using existing calculation logic)
- Creates payment batch with status `calculated`
- Notifies admin that cycle is ready for review

#### 2. **Review and Approval Workflow** (Best Practice)

Based on research, the standard workflow is:

**Step 1: Calculation Review**

- Admin views cycle summary:
  - Total jobs in period
  - Total workers
  - Total payment amount
  - Breakdown by worker
  - Breakdown by job

**Step 2: Individual Review**

- Review each worker's payments
- Verify calculations are correct
- Check for any discrepancies
- Add notes/adjustments if needed

**Step 3: Approval**

- Approve entire cycle batch (or individual payments)
- Once approved, batch status changes to `approved` (or `pending_payment`)
- Payments move to "ready for processing" state

**Step 4: Payment Processing**

- Export to payroll/banking system, OR
- Mark as paid manually after external payment
- Record payment method and reference
- Batch status changes to `processing` → `completed`

#### 3. **Cycle Periods**

**Weekly Cycle (Monday to Sunday):**

- Period: Monday 00:00 to Sunday 23:59
- Example: Jobs completed Jan 6 (Mon) - Jan 12 (Sun) = Week 1 cycle
- Payment typically on Friday of following week

**Fortnightly Cycle (Every 2 weeks, Monday start):**

- Period: Monday 00:00 to Sunday 23:59 (2 weeks later)
- Example: Jobs completed Jan 6 (Mon) - Jan 19 (Sun) = Period 1
- Next cycle: Jan 20 (Mon) - Feb 2 (Sun)
- Payment typically on Friday of following week

**Monthly Cycle (First Monday to Last Sunday):**

- Period: First Monday of month to last Sunday of month
- Example: Jan 6 (first Mon) - Feb 2 (last Sun) = January cycle
- Payment typically on last business day of month or first Friday of next month

### UI Flow

1. **Worker Payments Dashboard**
   - Overview card showing:
     - Current cycle period (dates)
     - Jobs pending calculation
     - Total calculated for current cycle
     - Upcoming payment date
2. **Payment Cycles Page**

   - List of all cycles (past and current)
   - Status badges: `pending`, `calculated`, `approved`, `processing`, `completed`
   - Actions:
     - "Calculate Payments" (for current cycle)
     - "Review Cycle" (opens review modal)
     - "Approve Cycle" (after review)
     - "Mark as Paid" (after external payment)

3. **Cycle Review Modal**
   - Summary totals
   - Worker breakdown table
   - Job breakdown table
   - Ability to:
     - Adjust individual payments (with notes)
     - Exclude jobs from payment
     - Approve all or selective
4. **Payment Processing**
   - After approval, show:
     - Export options (CSV, JSON for payroll systems)
     - "Mark as Paid" button (manual process)
     - Payment method selection
     - Payment reference input

### Database Status Flow

```
calculated → (review) → approved → (processing) → paid
                ↓                        ↓
            cancelled              failed
```

**Status Definitions:**

- `calculated`: Payments calculated, awaiting review
- `approved`: Reviewed and approved, ready for payment
- `processing`: Payment being processed (in progress)
- `paid`: Payment completed
- `failed`: Payment processing failed
- `cancelled`: Cycle cancelled before payment

### Implementation Priority

**Phase 1: Manual Cycle Management (MVP)**

1. Add payment cycle settings to organization settings
2. Add "Payment Cycles" page showing current/past cycles
3. Allow admin to manually create cycle calculations
4. Basic review interface (view calculations)
5. Manual "Mark as Paid" functionality

**Phase 2: Automated Cycles**

1. Background job to detect cycle end dates
2. Auto-calculate payments at cycle end
3. Email notifications for cycle ready for review
4. Approval workflow

**Phase 3: Advanced Features**

1. Payment adjustments/corrections
2. Export to payroll systems (Xero, QuickBooks)
3. Banking API integration (Stripe Connect)
4. Payment reconciliation
5. Reporting and analytics

---

## Best Practices (From Research)

1. **Always Require Review Before Payment**

   - Prevents errors and fraud
   - Gives admin control over payments
   - Creates audit trail

2. **Clear Separation of Calculation and Payment**

   - Calculate first
   - Review separately
   - Process payment last
   - Each step should be explicit and logged

3. **Monday Start Dates**

   - Industry standard for pay cycles
   - Easier to align with business weeks
   - Clear period boundaries

4. **Batch Processing**

   - Group payments by cycle for efficiency
   - Single approval for entire cycle
   - Easier reconciliation

5. **Audit Trail**

   - Track who calculated, reviewed, and approved
   - Record payment dates and references
   - Maintain full history of changes

6. **Flexibility for Adjustments**
   - Allow corrections before payment
   - Support partial payments if needed
   - Notes field for explanations

---

## Next Steps

1. **Immediate: Manual Payment Marking**

   - Add UI to mark individual payments as paid
   - Add payment method and reference fields
   - Update payment status

2. **Short-term: Payment Cycles**

   - Add cycle settings to organization settings
   - Create payment cycles page
   - Manual cycle calculation and review

3. **Medium-term: Automation**

   - Auto-detect cycle periods
   - Auto-calculate at cycle end
   - Approval workflow

4. **Long-term: Integration**
   - Payroll system exports
   - Banking API integration
   - Automated reconciliation
