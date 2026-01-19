# Worker Payment System - Comprehensive Testing Plan

## Overview

This document outlines a comprehensive testing strategy for the worker payment system, covering all user stories and components involved in worker payment calculations, rate cards, payment approval, and payment history. The plan addresses the complete payment lifecycle from calculation through payment processing.

## System Architecture Overview

The worker payment system consists of several interconnected components:

1. **Rate Card Management** (Story 007)
   - `WorkerRateCardService` (service layer)
   - `useWorkerRateCards` (React hook)
   - `RateCardManager` (UI component)

2. **Payment Calculation** (Story 003)
   - `calculate-worker-payment` (Edge function)
   - Core calculation functions (time-based splits, bonuses, multipliers)

3. **Payment Approval & Processing** (Story 006)
   - `update-worker-payment-status` (Edge function)
   - `MarkPaymentPaidDialog` (UI component)
   - Status transition logic

4. **Payment History & Audit** (Story 005)
   - `PaymentHistoryList` (UI component)
   - `useWorkerPaymentHistory` (React hook)
   - Filtering and export functionality

5. **Worker Payment Summary** (Story 004)
   - `WorkerPaymentSummary` (UI component)
   - `useWorkerPaymentSummary` (React hook)
   - Data aggregation and reporting

6. **Integration Points**
   - Job submission data (time tracking)
   - Pricing rules (base payment calculation)
   - Field configurations (for per-unit bonuses)
   - Mobile app time entry integration

---

## 1. Unit Tests

### 1.1 Worker Rate Card Service Tests

**File**: `dashboard/__tests__/lib/services/worker-rate-card.service.test.ts`

#### Test Coverage

**CRUD Operations:**
- ✅ `list()` - Fetch all rate cards for an organization
  - Returns empty array when no rate cards exist
  - Returns rate cards with joined worker data
  - Returns rate cards with field_config_ids for per_unit types
  - Filters by organization_id correctly
  - Orders by created_at DESC
  - Handles database errors gracefully

- ✅ `getForWorker()` - Fetch rate cards for specific worker
  - Returns only rate cards for specified worker
  - Orders by effective_from DESC
  - Includes field mappings for per_unit types
  - Returns empty array when worker has no rate cards

- ✅ `getCurrentRate()` - Get active rate card for worker (by date)
  - Returns active rate card within effective date range
  - Filters by modifier_type if provided
  - Returns null when no active rate card exists
  - Excludes rate cards with effective_from in future
  - Excludes rate cards with effective_to in past
  - Returns most recent rate card when multiple match

- ✅ `create()` - Create new rate card
  - Creates rate card with all required fields
  - Creates field mappings for per_unit type
  - Sets default currency to AUD if not provided
  - Sets default effective_from to today if not provided
  - Validates modifier_value > 0
  - Handles field_config_ids array correctly
  - Throws error on invalid data

- ✅ `update()` - Update existing rate card
  - Updates rate card fields correctly
  - Updates field mappings when field_config_ids provided
  - Removes all field mappings when empty array provided
  - Preserves existing field mappings when field_config_ids undefined
  - Updates updated_at timestamp

- ✅ `deactivate()` - Soft delete rate card
  - Sets is_active to false
  - Sets effective_to to today
  - Updates updated_at timestamp

- ✅ `delete()` - Hard delete rate card
  - Deletes rate card from database
  - Cascades deletion to field mappings (via FK constraint)
  - Throws error if rate card doesn't exist

**Data Transformation:**
- ✅ Transforms field mappings to field_config_ids array correctly
- ✅ Handles null/undefined field mappings gracefully
- ✅ Preserves all rate card properties in response

---

### 1.2 Worker Rate Cards Hook Tests

**File**: `dashboard/__tests__/hooks/use-worker-rate-cards.test.tsx`

#### Test Coverage

**State Management:**
- ✅ Initializes with empty array and loading=true
- ✅ Sets loading=false after fetch completes
- ✅ Stores rate cards in state after successful fetch
- ✅ Sets error state on fetch failure
- ✅ Refetches when organizationId changes

**CRUD Operations:**
- ✅ `createRateCard()` - Calls service and refetches
  - Throws error when organizationId missing
  - Adds organizationId to request automatically
  - Updates state after creation

- ✅ `updateRateCard()` - Calls service and refetches
  - Updates state after successful update
  - Handles errors gracefully

- ✅ `deactivateRateCard()` - Calls service and refetches
  - Removes card from active list after deactivation

- ✅ `deleteRateCard()` - Calls service and refetches
  - Removes card from list after deletion

- ✅ `refetch()` - Manually triggers refetch
  - Updates state with latest data

**Edge Cases:**
- ✅ Handles missing organizationId (returns early, sets loading=false)
- ✅ Handles network errors gracefully
- ✅ Prevents duplicate refetches during loading state

---

### 1.3 Rate Card Manager Component Tests

**File**: `dashboard/__tests__/components/worker-payments/rate-card-manager.test.tsx`

#### Test Coverage

**UI Rendering:**
- ✅ Renders rate cards table with all columns
- ✅ Shows empty state when no rate cards exist
- ✅ Shows loading state during fetch
- ✅ Displays modifier type badges correctly
- ✅ Formats modifier values correctly (currency vs multiplier)
- ✅ Formats dates correctly

**Dialog Management:**
- ✅ Opens create dialog on "Add Rate Card" click
- ✅ Opens edit dialog with pre-filled data on edit click
- ✅ Closes dialog on cancel
- ✅ Closes dialog after successful save

**Form Validation:**
- ✅ Requires worker_id selection
- ✅ Requires modifier_value
- ✅ Validates modifier_value is positive number
- ✅ Requires field_config_ids for per_unit type
- ✅ Shows error toast on validation failure

**Form Interactions:**
- ✅ Updates form state on field changes
- ✅ Shows/hides field selector based on modifier_type
- ✅ Toggles field_config checkboxes correctly
- ✅ Resets form after successful save

**CRUD Operations:**
- ✅ Calls createRateCard on create submit
- ✅ Calls updateRateCard on edit submit
- ✅ Calls deactivateRateCard on deactivate
- ✅ Shows success/error toasts appropriately

---

### 1.4 Payment Calculation Function Tests (Edge Function)

**File**: `database/supabase/functions/__tests__/calculate-worker-payment.test.ts`

#### Test Coverage

**Request Validation:**
- ✅ Requires organization_id
- ✅ Requires job_ids array
- ✅ Validates job_ids is non-empty array
- ✅ Verifies organization membership

**Base Payment Calculation:**
- ✅ Calculates from pricing rules correctly
- ✅ Applies location-based pricing overrides
- ✅ Handles fixed_price locations
- ✅ Handles service-level fixed pricing
- ✅ Processes field-based pricing rules
- ✅ Processes option-based pricing rules
- ✅ Applies base rules and adjustments
- ✅ Applies conditional rules

**Time-Based Split Logic:**
- ✅ Single worker gets full base payment
- ✅ Splits proportionally by hours worked
- ✅ Falls back to equal split when no hours tracked
- ✅ Handles zero hours correctly
- ✅ Calculates hours from start_time/end_time correctly
- ✅ Rounds hours to 2 decimal places

**Multiplier Modifiers:**
- ✅ Applies multiplier to time-share correctly (e.g., 1.2x = 20% increase)
- ✅ Calculates multiplier_adjustment correctly
- ✅ Only affects worker with multiplier rate card
- ✅ Handles multipliers < 1 (reductions)

**Per-Unit Bonuses:**
- ✅ Calculates bonus from field values correctly
- ✅ Handles multiple field_config_ids
- ✅ Extracts numeric values from various field types:
  - Number fields
  - Array counts
  - Object quantities
  - Grouped breakdown quantities
- ✅ Adds bonus ON TOP of time share (additive)
- ✅ Only applies to workers with per_unit rate card

**Flat Bonuses:**
- ✅ Adds flat amount ON TOP of time share (additive)
- ✅ Only applies to workers with flat rate card

**Combined Scenarios:**
- ✅ Worker with multiplier + per_unit bonus
- ✅ Worker with multiplier + flat bonus
- ✅ Multiple workers with different modifiers
- ✅ Worker with no rate card (receives time share only)

**Rate Card Lookup:**
- ✅ Fetches active rate cards correctly
- ✅ Filters by effective date range
- ✅ Maps rate cards by worker_id
- ✅ Includes field mappings for per_unit types
- ✅ Handles missing rate cards gracefully

**Final Payment Calculation:**
- ✅ Sums time_share + bonuses correctly
- ✅ Updates total_worker_payment to include all bonuses
- ✅ Rounds final payments to 2 decimal places

**Edge Cases:**
- ✅ No workers assigned to job (returns empty splits)
- ✅ Job with no submission data
- ✅ Rate card effective_from in future
- ✅ Rate card effective_to in past
- ✅ Rate card not active
- ✅ Invalid modifier_value (negative, zero)
- ✅ Missing field configs for per_unit bonuses

---

### 1.5 Core Calculation Helper Function Tests

**File**: `database/supabase/functions/__tests__/calculate-worker-payment-helpers.test.ts`

#### Test Coverage

**`calculateWorkerSplits()` Function:**
- ✅ Returns empty array when no workers
- ✅ Single worker: gets full base payment
- ✅ Multiple workers: proportional by hours
- ✅ Applies multipliers correctly
- ✅ Calculates per_unit bonuses correctly
- ✅ Calculates flat bonuses correctly
- ✅ Combines all components correctly
- ✅ Handles missing rate cards gracefully

**`getNumericFieldValue()` Function:**
- ✅ Extracts number from number field
- ✅ Counts array length
- ✅ Sums quantities from object array
- ✅ Extracts quantity from object
- ✅ Returns 0 for null/undefined
- ✅ Returns 0 for invalid types

**`evaluateCondition()` Function:**
- ✅ equals operator
- ✅ not_equals operator
- ✅ greater_than operator
- ✅ less_than operator
- ✅ contains operator (arrays)
- ✅ contains operator (strings)
- ✅ Handles type coercion correctly

**Time Calculation Helpers:**
- ✅ Calculates hours from timestamps correctly
- ✅ Handles timezone differences
- ✅ Returns 0 for invalid time ranges
- ✅ Handles null start_time/end_time

---

### 1.6 Worker Payment Service Tests

**File**: `dashboard/__tests__/lib/services/worker-payment.service.test.ts`

#### Test Coverage

**`calculatePayments()`:**
- ✅ Calls edge function with correct parameters
- ✅ Returns calculation result correctly
- ✅ Handles errors from edge function
- ✅ Validates response structure

**Payment Storage:**
- ✅ Saves batch correctly
- ✅ Saves individual payments correctly
- ✅ Links payments to batch
- ✅ Includes calculation_details in payment records

---

### 1.7 Payment Status Update Edge Function Tests

**File**: `database/supabase/functions/__tests__/update-worker-payment-status.test.ts`

#### Test Coverage

**Request Validation:**
- ✅ Requires organization_id
- ✅ Requires either batch_id or payment_id
- ✅ Validates status transitions (calculated → approved → paid)
- ✅ Verifies organization membership
- ✅ Validates payment method enum values

**Status Transitions:**
- ✅ Batch status: calculated → approved
- ✅ Batch status: approved → processing
- ✅ Individual payment: calculated → pending
- ✅ Individual payment: pending → processing
- ✅ Individual payment: processing → paid
- ✅ Invalid transitions throw errors

**Payment Details:**
- ✅ Updates payment_method correctly
- ✅ Stores payment_reference
- ✅ Sets paid_at timestamp
- ✅ Updates paid_by user ID
- ✅ Handles optional notes field

**Batch Completion Logic:**
- ✅ Automatically sets batch status to "completed" when all payments are paid
- ✅ Handles partial payment completion
- ✅ Prevents batch completion when some payments are failed/cancelled

**Audit Trail:**
- ✅ Records who updated payment status
- ✅ Records when payment was updated
- ✅ Preserves status change history

---

### 1.8 Payment History Hook Tests

**File**: `dashboard/__tests__/hooks/use-worker-payment-history.test.tsx`

#### Test Coverage

**Data Fetching:**
- ✅ Fetches payment batches for organization
- ✅ Orders by calculated_at DESC
- ✅ Includes worker count and job count aggregations
- ✅ Joins calculated_by user information
- ✅ Handles empty results gracefully

**Filtering:**
- ✅ Filters by date range (start_date, end_date)
- ✅ Applies filters to calculated_at field
- ✅ Handles missing date filters (shows all)
- ✅ Combines multiple filters correctly

**Real-time Updates:**
- ✅ Refetches when new payments are created
- ✅ Updates when payment statuses change
- ✅ Maintains filter state during updates

**Performance:**
- ✅ Handles large datasets (1000+ batches)
- ✅ Implements pagination if needed
- ✅ Caches data appropriately

---

### 1.9 Payment History List Component Tests

**File**: `dashboard/__tests__/components/worker-payments/payment-history-list.test.tsx`

#### Test Coverage

**UI Rendering:**
- ✅ Displays payment batches in table format
- ✅ Shows batch details (date range, job count, worker count, total)
- ✅ Displays status badges with correct colors
- ✅ Shows calculated_by user name
- ✅ Formats currency amounts correctly

**Filtering UI:**
- ✅ Renders date range inputs
- ✅ Applies filters on change
- ✅ Clears filters correctly
- ✅ Shows filtered results count

**Actions:**
- ✅ "View Details" button opens payment detail dialog
- ✅ "Mark as Paid" button opens mark paid dialog
- ✅ "Export CSV" button downloads file
- ✅ Handles disabled states appropriately

**Empty States:**
- ✅ Shows message when no payments exist
- ✅ Shows message when filters return no results
- ✅ Shows loading state during fetch

**Status Indicators:**
- ✅ Status badges match database status values
- ✅ Color coding for different statuses
- ✅ Status transitions update immediately

---

### 1.10 Worker Payment Summary Hook Tests

**File**: `dashboard/__tests__/hooks/use-worker-payment-summary.test.tsx`

#### Test Coverage

**Data Aggregation:**
- ✅ Groups payments by worker_id
- ✅ Sums total payments per worker
- ✅ Counts unique jobs per worker
- ✅ Calculates average payment per job
- ✅ Excludes cancelled payments

**Worker Information:**
- ✅ Joins worker names from worker table
- ✅ Handles deleted workers gracefully
- ✅ Shows "Unknown Worker" for missing worker data

**Sorting:**
- ✅ Sorts by total payment (high to low)
- ✅ Sorts by worker name (alphabetical)
- ✅ Sorts by job count (high to low)
- ✅ Sorts by average payment (high to low)

**Performance:**
- ✅ Aggregates data efficiently
- ✅ Handles large payment datasets
- ✅ Caches aggregated results

---

### 1.11 Worker Payment Summary Component Tests

**File**: `dashboard/__tests__/components/worker-payments/worker-payment-summary.test.tsx`

#### Test Coverage

**Table Display:**
- ✅ Shows worker name, job count, total payment, average
- ✅ Formats currency amounts correctly
- ✅ Shows sorting indicators
- ✅ Handles empty worker list

**Sorting:**
- ✅ Clicking column headers sorts data
- ✅ Multiple clicks toggle sort direction
- ✅ Maintains sort state visually

**Navigation:**
- ✅ "View Details" links to worker payment history
- ✅ Passes correct worker ID to detail view

**Empty States:**
- ✅ Shows message when no payments exist
- ✅ Shows message when no workers with payments

**Loading States:**
- ✅ Shows skeleton loaders during fetch
- ✅ Handles error states gracefully

---

### 1.12 Mark Payment Paid Dialog Tests

**File**: `dashboard/__tests__/components/worker-payments/mark-payment-paid-dialog.test.tsx`

#### Test Coverage

**Dialog Management:**
- ✅ Opens with correct payment/batch data
- ✅ Pre-fills payment method and date
- ✅ Closes on cancel
- ✅ Closes after successful save

**Form Validation:**
- ✅ Requires payment method selection
- ✅ Validates payment reference format
- ✅ Allows future payment dates
- ✅ Handles optional notes field

**Payment Methods:**
- ✅ Supports all payment method options
- ✅ Updates payment reference field based on method
- ✅ Shows relevant fields for each method

**Status Updates:**
- ✅ Calls update status endpoint correctly
- ✅ Updates batch status when appropriate
- ✅ Refreshes payment history after update

**Error Handling:**
- ✅ Shows error messages for failed updates
- ✅ Handles network errors gracefully
- ✅ Prevents double submission

---

### 1.13 Payment Detail Dialog Tests

**File**: `dashboard/__tests__/components/worker-payments/payment-detail-dialog.test.tsx`

#### Test Coverage

**Payment Breakdown Display:**
- ✅ Shows job-level payment details
- ✅ Shows worker-level splits
- ✅ Displays time shares and bonuses
- ✅ Shows calculation formulas

**Approval Actions:**
- ✅ Shows approve button for calculated batches
- ✅ Shows mark paid button for approved batches
- ✅ Hides actions for completed batches

**Data Formatting:**
- ✅ Formats currency amounts correctly
- ✅ Shows percentages and multipliers
- ✅ Displays date ranges properly

**Navigation:**
- ✅ Links to individual job details
- ✅ Links to worker rate cards

---

## 2. Integration Tests

### 2.1 End-to-End Payment Calculation Flow

**File**: `dashboard/__tests__/integration/worker-payment-calculation.test.ts`

#### Test Scenarios

**Scenario 1: Single Worker, No Rate Card**
```typescript
Given: Job with 1 worker, 8 hours worked, $500 base payment
When: Calculate worker payment
Then: Worker receives $500 (full base payment)
```

**Scenario 2: Multiple Workers, Equal Hours, No Rate Cards**
```typescript
Given: Job with 3 workers, each 8 hours, $600 base payment
When: Calculate worker payment
Then: Each worker receives $200 (equal split)
```

**Scenario 3: Multiple Workers, Unequal Hours, No Rate Cards**
```typescript
Given: Job with 3 workers (8h, 6h, 2h), $480 base payment
When: Calculate worker payment
Then: Workers receive proportional shares ($240, $180, $60)
```

**Scenario 4: Supervisor with Per-Unit Bonus**
```typescript
Given: 
  - Job: 100 cars cleaned, $500 base payment (from pricing rules)
  - Workers: Alice (Supervisor, 8h, $0.50/car bonus), Bob (8h)
When: Calculate worker payment
Then:
  - Alice: $250 (time share) + $50 (bonus) = $300
  - Bob: $250 (time share)
  - Total: $550 (base + bonus)
```

**Scenario 5: Worker with Multiplier**
```typescript
Given:
  - Job: $600 base payment
  - Workers: Senior (8h, 1.2x multiplier), Junior (8h)
When: Calculate worker payment
Then:
  - Senior: $360 (60% * 1.2)
  - Junior: $240 (40% of original pool)
  - Total: $600 (multiplier redistributes, doesn't add)
```

**Scenario 6: Combined Modifiers**
```typescript
Given:
  - Job: 100 cars, $500 base payment
  - Workers:
    - Supervisor: 8h, multiplier 1.2x, per-unit $0.50/car
    - Worker: 8h
When: Calculate worker payment
Then:
  - Supervisor: $300 (time share with multiplier) + $50 (bonus) = $350
  - Worker: $200 (remaining time share)
  - Total: $550
```

**Scenario 7: No Time Tracking Data**
```typescript
Given: Job with 3 workers, no start_time/end_time, $600 base
When: Calculate worker payment
Then: Each worker receives $200 (equal split fallback)
```

**Scenario 8: Rate Card Effective Date Filtering**
```typescript
Given:
  - Current date: 2024-06-15
  - Worker has rate card: effective_from 2024-07-01 (future)
When: Calculate worker payment for job on 2024-06-15
Then: Rate card is NOT applied (worker gets time share only)
```

**Scenario 9: Multiple Rate Cards, Different Modifier Types**
```typescript
Given: Worker has both multiplier (1.1x) and flat ($20) rate cards
When: Calculate worker payment
Then: Both modifiers apply correctly (time share * 1.1 + $20)
```

**Scenario 10: Per-Unit Bonus with Multiple Fields**
```typescript
Given:
  - Worker has per_unit rate card for fields: "cars_cleaned", "trucks_cleaned"
  - Job data: cars_cleaned=50, trucks_cleaned=20
  - Rate: $0.50/unit
When: Calculate worker payment
Then: Bonus = (50 + 20) * $0.50 = $35
```

---

### 2.2 Rate Card Management Integration Tests

**File**: `dashboard/__tests__/integration/rate-card-management.test.tsx`

#### Test Scenarios

**Full CRUD Flow:**
1. Create rate card via UI
   - Fill form
   - Submit
   - Verify card appears in list
   - Verify card data is correct

2. Edit rate card via UI
   - Click edit
   - Modify fields
   - Submit
   - Verify changes reflected in list

3. Deactivate rate card
   - Click deactivate
   - Confirm action
   - Verify card disappears from active list

**Field Mapping for Per-Unit Type:**
- Select per_unit modifier type
- Verify field selector appears
- Select multiple fields
- Create rate card
- Verify field mappings saved correctly

**Form Validation Flow:**
- Attempt submit with empty required fields
- Verify error messages appear
- Attempt submit with invalid modifier_value
- Verify validation errors

---

### 2.3 Payment Calculation with Real Database

**File**: `database/supabase/functions/__tests__/calculate-worker-payment-integration.test.ts`

#### Test Setup Requirements

- Test database with seed data:
  - Organizations
  - Workers
  - Jobs with submission_data
  - Job workers with time tracking
  - Pricing rules
  - Rate cards
  - Field configurations

#### Test Scenarios

**End-to-End with Database:**
1. **Create Test Data**
   - Create organization
   - Create workers
   - Create jobs with submission data
   - Create pricing rules
   - Create rate cards
   - Link workers to jobs with time tracking

2. **Calculate Payments**
   - Call calculate-worker-payment edge function
   - Verify response structure
   - Verify calculations match expected values

3. **Save Payments**
   - Call save-worker-payment edge function
   - Verify batch created
   - Verify individual payments created
   - Verify calculation_details stored correctly

4. **Verify Database State**
   - Query worker_payment_batch table
   - Query worker_payment table
   - Verify amounts match calculations
   - Verify relationships (batch_id, job_id, worker_id)

**Database Constraint Tests:**
- Verify rate card EXCLUDE constraint prevents overlaps
- Verify foreign key constraints enforce referential integrity
- Verify unique constraints on allocations

**Scenario 11: Payment Approval Workflow**
```typescript
Given: Payment batch in "calculated" status
When: Admin clicks "Approve"
Then: Batch status changes to "approved"
And: Individual payments change to "pending"
```

**Scenario 12: Mark Payment as Paid**
```typescript
Given: Approved payment batch with payment method "bank_transfer"
When: Admin marks as paid with reference "TXN-123"
Then: All payments change to "paid" status
And: Batch status changes to "completed"
And: Payment details are recorded correctly
```

**Scenario 13: Partial Payment Completion**
```typescript
Given: Batch with 3 payments, 2 marked as paid
When: Third payment is marked as paid
Then: Batch automatically completes
And: All payment statuses are "paid"
```

**Scenario 14: Payment History Filtering**
```typescript
Given: Payments from Jan 1 - Dec 31, 2024
When: Filter by date range Jan 15 - Feb 15
Then: Shows only payments calculated in that date range
And: Displays correct count of filtered results
```

**Scenario 15: Worker Payment Summary Aggregation**
```typescript
Given: Worker with 3 payments across 2 jobs ($100, $200, $150)
When: View worker summary
Then: Shows total payment = $450
And: Shows job count = 2 (unique jobs)
And: Shows average payment = $225
```

---

### 2.4 Payment Approval & Processing Integration Tests

**File**: `dashboard/__tests__/integration/payment-approval-workflow.test.tsx`

#### Test Scenarios

**Full Approval Workflow:**
1. **Calculate Payments**
   - Create payment batch (status: calculated)
   - Verify all payments have status: calculated

2. **Approve Batch**
   - Admin approves batch
   - Batch status: approved
   - Individual payments: pending

3. **Mark as Paid**
   - Admin selects payment method and details
   - Marks batch as paid
   - All payments: paid
   - Batch: completed

4. **Audit Trail Verification**
   - Verify paid_by, paid_at fields set
   - Verify payment_method and reference stored
   - Verify status change timestamps

**Edge Cases:**
- Approve cancelled batch (should error)
- Mark paid without approval (should error)
- Partial payment completion
- Batch with mixed payment statuses

---

### 2.5 Payment History & Filtering Integration Tests

**File**: `dashboard/__tests__/integration/payment-history-filtering.test.tsx`

#### Test Scenarios

**Date Range Filtering:**
- Filter by start date only
- Filter by end date only
- Filter by date range
- Clear all filters
- Filter with no results

**Status-Based Display:**
- Show all status types
- Status badge colors correct
- Status transitions update UI

**Export Functionality:**
- Export single batch to CSV
- Export filtered results
- CSV contains correct columns
- File downloads with timestamp

**Bulk Operations:**
- Select multiple batches (if implemented)
- Bulk status updates (if implemented)

---

### 2.6 Worker Summary Aggregation Integration Tests

**File**: `dashboard/__tests__/integration/worker-payment-summary.test.tsx`

#### Test Scenarios

**Data Aggregation Accuracy:**
```typescript
Given: Worker with payments across multiple batches:
  - Batch 1: $500 (2 jobs: $300, $200)
  - Batch 2: $300 (1 job: $300)
  - Batch 3: $200 (cancelled - should be excluded)
Expected: Total $800, Jobs 3, Average $266.67
```

**Sorting Functionality:**
- Sort by total payment (descending)
- Sort by worker name (ascending)
- Sort by job count (descending)
- Maintain sort state across data updates

**Real-time Updates:**
- Add new payment → summary updates
- Cancel payment → summary updates
- Status changes → summary updates

**Performance with Scale:**
- 100 workers with payments
- 1000+ payment records
- Aggregation completes within 2 seconds

---

### 2.7 Mobile App Time Tracking Integration Tests

**File**: `mobile-app/__tests__/integration/time-tracking-submission.test.ts`

#### Test Scenarios

**Time Entry Submission:**
```typescript
Given: Job with multiple workers
When: Workers submit time entries via mobile app
Then: Time data stored in job.submission_data.worker_times
And: Format matches expected structure for payment calculation
```

**Time Validation:**
- End time after start time
- Reasonable hour ranges (not 24+ hours)
- Multiple workers on same job
- Overlapping time entries allowed

**Payment Calculation Integration:**
- Time data correctly parsed by calculate-worker-payment
- Hours calculated accurately
- Proportional splits based on actual time

---

### 2.8 Export & Reporting Integration Tests

**File**: `dashboard/__tests__/integration/payment-export.test.tsx`

#### Test Scenarios

**CSV Export Structure:**
```csv
Worker Name,Job ID,Payment Amount,Status,Payment Date,Payment Method
Alice Johnson,JOB-001,$250.00,paid,2024-01-15,bank_transfer
Bob Smith,JOB-001,$250.00,paid,2024-01-15,bank_transfer
```

**Export Filtering:**
- Export matches current filters
- Export includes all visible records
- Export excludes hidden/filtered records

**File Generation:**
- Correct filename with timestamp
- UTF-8 encoding for special characters
- Proper CSV formatting with quotes

**Large Dataset Export:**
- Export 1000+ records without timeout
- Memory usage remains reasonable
- File size appropriate for data volume

---

## 3. Edge Cases & Error Scenarios

### 3.1 Calculation Edge Cases

**Zero/Null Values:**
- ✅ Base payment = 0
- ✅ Hours worked = 0 (all workers)
- ✅ Hours worked = null/undefined
- ✅ Modifier value = 0 (should be prevented by validation)
- ✅ Submission data missing fields

**Extreme Values:**
- ✅ Very large base payment (10,000+)
- ✅ Very small modifier values (0.0001)
- ✅ Very large hours (24+ hours)
- ✅ Many workers (10+)

**Date Edge Cases:**
- ✅ Rate card effective_from = today
- ✅ Rate card effective_to = today
- ✅ Job date outside rate card effective range
- ✅ Multiple rate cards with overlapping dates (should be prevented by constraint)

**Data Type Edge Cases:**
- ✅ Submission data with unexpected field types
- ✅ Numeric strings vs actual numbers
- ✅ Nested objects in submission data
- ✅ Array fields with mixed types

### 3.2 Payment Approval & Status Edge Cases

**Status Transition Edge Cases:**
- ✅ Attempt to approve cancelled batch (should fail)
- ✅ Attempt to pay unapproved batch (should fail)
- ✅ Mark individual payment as paid in approved batch
- ✅ Cancel approved batch (should move payments back to calculated)
- ✅ Status transitions with concurrent users

**Payment Method Edge Cases:**
- ✅ Payment method "other" with custom reference
- ✅ Very long payment references
- ✅ Special characters in payment references
- ✅ Payment dates in distant future/past

**Batch Completion Edge Cases:**
- ✅ Batch with failed payments (should not auto-complete)
- ✅ Batch with cancelled payments (should not auto-complete)
- ✅ Manual batch completion override
- ✅ Batch completion with mixed currencies (should error)

### 3.3 Payment History & Filtering Edge Cases

**Date Filtering Edge Cases:**
- ✅ Filter with start date after end date (should handle gracefully)
- ✅ Filter with dates far in past/future
- ✅ Filter with same start/end date
- ✅ Clear filters when no results found

**Data Edge Cases:**
- ✅ Payments with missing calculated_by user
- ✅ Payments with deleted workers
- ✅ Very old payment batches (date formatting)
- ✅ Payments with zero amounts

### 3.4 Worker Summary Edge Cases

**Aggregation Edge Cases:**
- ✅ Worker with payments but deleted from system
- ✅ Worker with only cancelled payments (should not appear)
- ✅ Worker with payments across many batches (100+)
- ✅ Rounding precision in averages

**Sorting Edge Cases:**
- ✅ Sort with equal values (stable sort)
- ✅ Sort with very large numbers
- ✅ Sort with special characters in names

### 3.5 Export & CSV Edge Cases

**Data Formatting Edge Cases:**
- ✅ Worker names with commas, quotes, special characters
- ✅ Very large amounts (thousands separators)
- ✅ Dates in different formats
- ✅ Empty/null fields in export

**Performance Edge Cases:**
- ✅ Export with 10,000+ records
- ✅ Export during high system load
- ✅ Multiple concurrent exports

### 3.6 Mobile App Integration Edge Cases

**Time Tracking Edge Cases:**
- ✅ Negative time durations (end before start)
- ✅ Time entries spanning midnight
- ✅ Time zones and daylight saving transitions
- ✅ Multiple time entries for same worker/job

**Data Synchronization Edge Cases:**
- ✅ Offline time entry submission
- ✅ Conflicting time entries from multiple devices
- ✅ Time entry updates after payment calculation

---

### 3.2 Error Handling Tests

**Service Layer Errors:**
- ✅ Database connection failures
- ✅ Foreign key constraint violations
- ✅ Unique constraint violations
- ✅ Invalid data type errors

**Edge Function Errors:**
- ✅ Invalid request body
- ✅ Missing required fields
- ✅ Invalid organization_id
- ✅ Jobs not found
- ✅ Authorization failures

**UI Error Handling:**
- ✅ Network errors during fetch
- ✅ Validation errors in forms
- ✅ Concurrent modification errors
- ✅ Server errors (500)

---

## 4. Performance Tests

### 4.1 Calculation Performance

- ✅ Calculate payments for 100 jobs simultaneously
- ✅ Calculate payments for jobs with 20+ workers
- ✅ Calculate with complex rate card queries
- ✅ Measure query execution time

### 4.2 UI Performance

- ✅ Render rate card list with 100+ cards
- ✅ Form interactions remain responsive
- ✅ Dialog opens/closes smoothly

---

## 5. Data Integrity Tests

### 5.1 Referential Integrity

- ✅ Cannot create rate card for non-existent worker
- ✅ Cannot create rate card for non-existent organization
- ✅ Deleting worker cascades to rate cards
- ✅ Deleting organization cascades to rate cards

### 5.2 Constraint Validation

- ✅ EXCLUDE constraint prevents overlapping active rate cards
- ✅ CHECK constraint prevents negative modifier_value
- ✅ CHECK constraint enforces valid modifier_type
- ✅ UNIQUE constraint on worker_payment_allocation

---

## 6. Test Data Fixtures

### 6.1 Test Organization Setup

```typescript
const testOrganization = {
  id: "test-org-1",
  name: "Test Organization",
};
```

### 6.2 Test Workers

```typescript
const testWorkers = [
  { id: "worker-1", first_name: "Alice", last_name: "Supervisor" },
  { id: "worker-2", first_name: "Bob", last_name: "Worker" },
  { id: "worker-3", first_name: "Charlie", last_name: "Worker" },
];
```

### 6.3 Test Rate Cards

```typescript
const testRateCards = [
  {
    worker_id: "worker-1",
    modifier_type: "per_unit",
    modifier_value: 0.5,
    field_config_ids: ["field-cars"],
  },
  {
    worker_id: "worker-1",
    modifier_type: "multiplier",
    modifier_value: 1.2,
  },
];
```

### 6.4 Test Jobs

```typescript
const testJobs = [
  {
    id: "job-1",
    submission_data: { cars_cleaned: 100 },
    workers: [
      { worker_id: "worker-1", start_time: "09:00", end_time: "17:00" },
      { worker_id: "worker-2", start_time: "09:00", end_time: "17:00" },
    ],
  },
];
```

---

## 7. Test Execution Strategy

### 7.1 Unit Tests

- **Run Frequency**: Before every commit
- **Tools**: Vitest (dashboard), Deno test (edge functions)
- **Coverage Target**: 80%+ for services, 70%+ for components

### 7.2 Integration Tests

- **Run Frequency**: Before merge to main branch
- **Tools**: Vitest with test database
- **Coverage Target**: All critical user flows

### 7.3 Manual Testing Checklist

Before deploying to production, manually verify:

**Rate Card Management (Story 007):**
- [ ] Create rate card via UI
- [ ] Edit rate card via UI
- [ ] Deactivate rate card
- [ ] Per-unit field mapping works correctly

**Payment Calculation (Story 003):**
- [ ] Calculate payments for multiple jobs
- [ ] Preview shows correct breakdowns
- [ ] Time-based splits work correctly
- [ ] Bonuses apply additively

**Payment Approval (Story 006):**
- [ ] Approve calculated batch
- [ ] Mark approved batch as paid
- [ ] Payment methods and references save correctly

**Payment History (Story 005):**
- [ ] View payment history with filtering
- [ ] Export to CSV works correctly
- [ ] Status badges update correctly

**Worker Summary (Story 004):**
- [ ] Worker summary shows correct aggregations
- [ ] Sorting works in all columns
- [ ] Links to worker details work

**Mobile Integration:**
- [ ] Time tracking data flows to payment calculation
- [ ] Mobile app time entries appear in calculations

---

## 8. Test File Structure

```
dashboard/__tests__/
├── hooks/
│   ├── use-worker-rate-cards.test.tsx
│   ├── use-worker-payment-history.test.tsx
│   └── use-worker-payment-summary.test.tsx
├── components/
│   └── worker-payments/
│       ├── rate-card-manager.test.tsx
│       ├── payment-history-list.test.tsx
│       ├── worker-payment-summary.test.tsx
│       ├── mark-payment-paid-dialog.test.tsx
│       └── payment-detail-dialog.test.tsx
├── lib/
│   └── services/
│       ├── worker-rate-card.service.test.ts
│       └── worker-payment.service.test.ts
└── integration/
    ├── worker-payment-calculation.test.ts
    ├── rate-card-management.test.tsx
    ├── payment-approval-workflow.test.tsx
    ├── payment-history-filtering.test.tsx
    ├── worker-payment-summary.test.tsx
    └── payment-export.test.tsx

database/supabase/functions/__tests__/
├── calculate-worker-payment.test.ts
├── calculate-worker-payment-helpers.test.ts
├── calculate-worker-payment-integration.test.ts
└── update-worker-payment-status.test.ts

mobile-app/__tests__/
└── integration/
    └── time-tracking-submission.test.ts
```

---

## 9. Priority & Implementation Order

### Phase 1: Core Calculation Logic (Critical - Story 003, 007)
1. ✅ Unit tests for `calculateWorkerSplits()` and `getNumericFieldValue()`
2. ✅ Unit tests for `WorkerRateCardService`
3. ✅ Integration tests for payment calculation with rate cards
4. ✅ Unit tests for `calculate-worker-payment` edge function

### Phase 2: Rate Card Management UI (High - Story 007)
1. ✅ Unit tests for `useWorkerRateCards` hook
2. ✅ Component tests for `RateCardManager`
3. ✅ Integration tests for rate card CRUD operations

### Phase 3: Payment Approval & Processing (High - Story 006)
1. ✅ Unit tests for `update-worker-payment-status` edge function
2. ✅ Component tests for `MarkPaymentPaidDialog`
3. ✅ Integration tests for payment approval workflow
4. ✅ Status transition and audit trail tests

### Phase 4: Payment History & Audit (High - Story 005)
1. ✅ Unit tests for `useWorkerPaymentHistory` hook
2. ✅ Component tests for `PaymentHistoryList`
3. ✅ Integration tests for filtering and export
4. ✅ CSV export functionality tests

### Phase 5: Worker Summary Dashboard (Medium - Story 004)
1. ✅ Unit tests for `useWorkerPaymentSummary` hook
2. ✅ Component tests for `WorkerPaymentSummary`
3. ✅ Integration tests for data aggregation
4. ✅ Sorting and performance tests

### Phase 6: Mobile Integration & Edge Cases (Medium)
1. ✅ Mobile app time tracking integration tests
2. ✅ Comprehensive edge case testing
3. ✅ Error handling and validation tests
4. ✅ Performance and load testing

### Phase 7: Advanced Features & Polish (Lower)
1. ✅ Full end-to-end integration tests
2. ✅ Cross-browser and device testing
3. ✅ Accessibility testing
4. ✅ Internationalization testing

---

## 10. Success Criteria

Tests are considered successful when all user stories are fully tested:

### Story 003: Payment Calculation Flow
- ✅ Payment calculation works for all job types and pricing rules
- ✅ Preview shows accurate breakdowns before saving
- ✅ Error handling provides clear feedback
- ✅ Loading states work correctly during calculation

### Story 004: Worker Payment Summary
- ✅ Aggregates payment data correctly by worker
- ✅ Sorting works in all columns
- ✅ Handles large datasets efficiently
- ✅ Empty states and error states work properly

### Story 005: Payment History
- ✅ All payment batches display with correct filtering
- ✅ Status transitions update UI immediately
- ✅ Export functionality generates correct CSV files
- ✅ Performance acceptable with 1000+ payment records

### Story 006: Payment Approval & Processing
- ✅ Status transitions work correctly (calculated → approved → paid)
- ✅ Payment details (method, reference, date) save correctly
- ✅ Batch completion logic works automatically
- ✅ Audit trail captures all changes

### Story 007: Worker Rates & Custom Splits
- ✅ Rate card CRUD operations work correctly
- ✅ Time-based splits calculate accurately
- ✅ Additive bonuses work for all modifier types
- ✅ Field mappings work for per-unit bonuses

### Technical Criteria
- ✅ All unit tests pass with 80%+ coverage for services, 70%+ for components
- ✅ All integration tests pass across all user stories
- ✅ Edge cases handled gracefully with appropriate error messages
- ✅ Performance acceptable (< 2s for 100 job calculations, < 5s for 1000 payment aggregations)
- ✅ No database constraint violations in any scenario
- ✅ UI remains responsive during all operations
- ✅ Mobile app time tracking integrates correctly with payment calculations

---

## 11. Testing Plan Improvements Made

### Issues Fixed from Original Plan:

1. **Missing User Story Coverage**: Original plan only covered Story 007. Added comprehensive coverage for all worker payment user stories (003, 004, 005, 006, 007).

2. **Incomplete Component Testing**: Added tests for payment approval UI, payment history UI, worker summary dashboard, and payment detail dialogs.

3. **Missing Integration Scenarios**: Added payment approval workflow tests, payment history filtering tests, worker summary aggregation tests, and mobile app integration tests.

4. **Payment Status Management**: Added comprehensive testing for the payment lifecycle from calculated → approved → paid, including status transitions and audit trails.

5. **Export & Reporting**: Added CSV export testing with various data scenarios and edge cases.

6. **Mobile Integration**: Added time tracking integration tests to ensure mobile app data flows correctly to payment calculations.

7. **UI/UX Testing Gaps**: Added specific UI interaction tests, form validation, dialog management, and user feedback testing.

8. **Edge Cases**: Expanded edge case coverage to include payment-specific scenarios like status transitions, batch completion logic, and data aggregation edge cases.

### Key Additions:

- **Payment Status Edge Function Tests**: Complete coverage of payment approval and status update logic
- **Payment History Testing**: Filtering, export, and status display testing
- **Worker Summary Testing**: Data aggregation, sorting, and performance testing
- **Mobile App Integration**: Time tracking data flow and validation
- **Export Functionality**: CSV generation with various data types and edge cases
- **UI Component Integration**: Dialog management, form validation, real-time updates

---

## Notes

- Mock external dependencies (Supabase client, network requests) in unit tests
- Use test database for integration tests (isolated from development/production)
- Clean up test data after each test run
- Use factories/builders for creating test data
- Document complex test scenarios with comments
- Keep test descriptions clear and descriptive
- Test all user story acceptance criteria explicitly
- Include performance benchmarks for data-heavy operations
- Verify mobile app integration points regularly
- Test status transitions with concurrent users to catch race conditions
