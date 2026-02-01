# Worker Payments, Terminology, and Data Structure Issues

**Date:** January 2025

## Summary

This document addresses four questions/issues raised:

1. Stripe OAuth Connection - Implementation Timing
2. Completed At vs Finish Time Redundancy
3. "Brand" Terminology Should Be "Option"
4. Worker Payment System Status

---

## 1. Stripe OAuth Connection - Now or Later?

### Recommendation: **Later**

**Current State:**

- Database schema supports Stripe (`stripe_account_id`, `payment_provider` fields)
- Settings UI has placeholder for connection (disabled)
- Invoice payment processing doesn't require connected accounts (can use platform account)

**Why Wait:**

- Invoice payment functionality works without OAuth (using platform Stripe account)
- OAuth is only needed if you want each organization to receive payments to their own Stripe account
- More complex implementation requiring:
  - OAuth flow (authorization URL, callback handling)
  - State management for OAuth security
  - Webhook handling for account updates
  - Error handling for connection failures

**When to Implement:**

- When you need multi-tenant payment routing (each org gets paid to their own account)
- When you're ready to support Stripe Connect (marketplace model)
- Can be added incrementally without affecting existing functionality

**Bottom Line:** Invoice payments work fine without it. Implement when you need per-organization payment routing.

---

## 2. Completed At vs Finish Time Redundancy

### Current Situation

**Database Field:** `job.completed_at` (TIMESTAMPTZ)
**Submission Data Field:** `submission_data.finish_time` (ISO datetime string)

**Observation:** They are currently always the same value - `completed_at` is set from `finish_time` during job creation/update. Even when creating a job in the dashboard that occurred in the past, `completed_at` is still set to the same value as `finish_time`.

**Current Behavior:**

- In `create-job-dialog.tsx`: `completed_at` is set to `finish_time` value (or current time if not provided)
- In `edit-job-dialog.tsx`: `completed_at` is set to `finish_time` value (or existing `completed_at` if not changed)
- This means `completed_at` is effectively a duplicate of `finish_time` stored in the database

### Analysis

**Issue:** `completed_at` appears redundant because:

- It's always derived from `finish_time`
- No independent audit trail value
- Duplicate data storage

**Considerations:**

- Database querying: `completed_at` as a database column is easier to query/filter/index than JSONB field
- Data integrity: `completed_at` ensures there's always a timestamp even if `finish_time` is missing
- But currently: System doesn't leverage these benefits since they're always the same

### Recommendation

**Option 1: Remove Redundancy (Recommended)**

- Use `completed_at` as the authoritative timestamp
- Remove `finish_time` from `submission_data` (it's redundant)
- Update UI to only show `completed_at`
- Simplifies data model, removes duplication

**Option 2: Make Them Actually Different**

- Keep `completed_at` as system timestamp (when job record was created/saved)
- Keep `finish_time` as user-provided data (when worker actually finished)
- In dashboard: Set `completed_at` to current time, `finish_time` to user-entered time
- Allows true audit trail: "Job finished on X, but wasn't recorded until Y"

**Option 3: Keep Status Quo**

- Acknowledge redundancy but keep both
- Use `completed_at` for all queries/filtering
- `finish_time` remains in submission_data but is informational only

**Current Status:** This is a known redundancy issue. No immediate action required, but should be addressed when refactoring job data model.

---

## 3. "Brand" Terminology → "Option"

### Issue

Grouped breakdown fields currently use "Brand" terminology throughout:

- Data structure: `{ brand: string; quantity: number }`
- UI labels: "Select a brand", "By Brand", etc.
- Variable names: `selectedBrand`, `availableBrands`, etc.

This is too specific for a generic system that could track any type of option.

### Required Changes

**Data Structure Change (Breaking):**

```typescript
// Current
interface GroupedBreakdownItem {
  brand: string; // ← Change this
  quantity: number;
}

// Proposed
interface GroupedBreakdownItem {
  option: string; // ← To this
  quantity: number;
}
```

**Files Affected:**

1. Type definitions (multiple files)
2. All code accessing `.brand` property (~110+ occurrences)
3. UI labels and text
4. Database migration for existing `submission_data` records

**Migration Strategy:**

**Phase 1: UI Text Only (Safe, Non-Breaking)**

- Change all user-facing text from "Brand" to "Option"
- Keep data structure as-is for now
- Can be done immediately

**Phase 2: Data Structure (Breaking Change)**

- Create migration script to update existing `submission_data` JSONB
- Update all TypeScript interfaces
- Update all code references
- Requires careful testing

**Recommendation:** Start with Phase 1 (UI text changes) now. Plan Phase 2 (data structure) as a separate migration when ready to handle existing data.

---

## 4. Worker Payment System Status

### Current Functionality

**What Works:**

1. ✅ Payment calculation based on pricing rules
2. ✅ Preview of worker payments before confirming
3. ✅ Payment history stored in localStorage
4. ✅ Export to CSV functionality
5. ✅ Aggregation by worker

**What's Missing:**

1. ❌ Database persistence (currently localStorage only)
2. ❌ Actual payment processing (no bank transfers, payroll integration)
3. ❌ Payment status tracking (pending, paid, failed)
4. ❌ Marking jobs as "paid to worker"
5. ❌ Payment reconciliation

### How "Calculate Payments" Works

1. **User selects jobs** from completed jobs list
2. **Clicks "Calculate Payments"** button
3. **System calculates** worker payments using pricing rules:
   - Applies worker payment rules from pricing_rule table
   - Calculates per-job payments
   - Aggregates totals by worker
4. **Shows preview** of calculations
5. **User confirms** → Payment record saved to localStorage
6. **Payment history** shows past calculations

### What's Needed for Full Functionality

**Minimum Requirements:**

1. **Database Table for Worker Payments:**

```sql
CREATE TABLE worker_payment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE,
  payment_batch_id UUID, -- Group related payments
  job_id UUID REFERENCES job(id),
  worker_id UUID REFERENCES worker(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'AUD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  payment_method TEXT, -- 'bank_transfer', 'cash', 'other'
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

2. **Payment Processing Options:**

   - **Manual:** Mark as paid after external payment (bank transfer, cash, etc.)
   - **Bank Transfer API:** Integrate with banking API (Stripe Connect, Plaid, etc.)
   - **Payroll Integration:** Export to payroll system (Xero, QuickBooks, etc.)

3. **Status Tracking:**

   - Mark payments as "pending" when calculated
   - Update to "paid" when payment processed
   - Track payment dates and references

4. **UI Enhancements:**
   - "Mark as Paid" button for each payment
   - Payment status badges
   - Filter by payment status
   - Payment reconciliation view

### Recommended Implementation Path

**Phase 1: Database Persistence (Now)**

- Create `worker_payment` table
- Move payment records from localStorage to database
- Add payment status tracking

**Phase 2: Manual Payment Marking (Next)**

- Add "Mark as Paid" functionality
- Track payment date and reference
- Update job/payment status

**Phase 3: Integration (Future)**

- Bank transfer API integration (if needed)
- Payroll system export
- Automated payment processing

**Current Status:** System calculates payments correctly but doesn't actually process them. It's a calculation/preview tool, not a payment processor.

---

## Action Items

### Immediate (Safe Changes)

1. ✅ Change UI text from "Brand" to "Option" (Phase 1)
2. Document completed_at vs finish_time distinction in code comments
3. Add TODO comments for worker payment database migration

### Planned (Breaking Changes)

1. Migrate worker payments from localStorage to database
2. Change GroupedBreakdownItem data structure (brand → option)
3. Create worker_payment database table

### Future

1. Implement Stripe OAuth connection (when multi-tenant payments needed)
2. Add actual worker payment processing
3. Payment status tracking and reconciliation
