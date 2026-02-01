# Testing Plan: Auto-Generate Invoices Feature

## Overview

This document outlines comprehensive testing for the auto-generate invoices feature, including edge cases and integration scenarios.

## Linting Issues Fixed

✅ Fixed React Hook rule violation (useSearchParams called conditionally)
✅ Added statusFilter prop to InvoiceListProps interface
✅ Removed unused variable warnings
⚠️ JSR package warning (non-critical, cache issue)

---

## Test Categories

### 1. Unit Tests - Edge Function Logic

#### 1.1 Auto-Generate Configuration Parsing

**File**: `database/supabase/functions/__tests__/auto-generate-invoices.test.ts`

```typescript
// Test cases:
- ✅ Valid config with all fields
- ✅ Config with missing optional fields (should use defaults)
- ✅ Config with invalid period (should return null)
- ✅ Config with enabled: false (should return null)
- ✅ Config with invalid metadata structure
- ✅ Default values: period="weekly", time="09:00", grouping="location", require_review=true
```

#### 1.2 Schedule Validation (`shouldRunAutoGenerate`)

```typescript
// Daily schedule:
- ✅ Should run at configured time
- ✅ Should not run at different time
- ✅ Should run daily regardless of day

// Weekly schedule:
- ✅ Should run on configured day of week at configured time
- ✅ Should not run on different day
- ✅ Should not run on correct day but wrong time
- ✅ Edge case: Sunday (day 0) vs Monday (day 1)

- ⚠️ TODO: Add tracking for 14-day intervals

// Monthly schedule:
- ✅ Should run on configured day of month at configured time
- ✅ Should not run on different day of month
- ✅ Edge case: Day 31 when month has 30 days (should handle gracefully)
- ✅ Edge case: February 29/30/31 (should handle gracefully)
```

#### 1.3 Invoice Number Generation

```typescript
- ✅ Should generate sequential numbers (ORG-YYYY-0001, ORG-YYYY-0002)
- ✅ Should handle year rollover correctly
- ✅ Should handle concurrent generation (race conditions)
- ✅ Should handle missing organization (error case)
```

#### 1.4 Job Grouping Logic

```typescript
// Location grouping:
- ✅ Should group jobs by location_id
- ✅ Should handle jobs with null location_id (group as "no_location")
- ✅ Should create separate invoices for each location

// Customer grouping (future - not a priority):
- ⚠️ Not yet implemented - location grouping is sufficient for now
- **What it means**: Instead of creating one invoice per location, group jobs by customer/recipient email
- **How it works**: Extract customer email from each job (using invoice email recipient config), then group jobs with the same customer email together
- **Example**: If 3 jobs at different locations all have the same customer email, create one invoice for all 3 jobs instead of 3 separate invoices
- **Use case**: When a customer has multiple service locations but wants a single consolidated invoice
- **Status**: Will evaluate based on user feedback - location grouping is fine for now

// All together grouping (future - not a priority):
- ⚠️ Not yet implemented - location grouping is sufficient for now
- **What it means**: Create a single invoice for ALL completed jobs, regardless of location or customer
- **Example**: If there are 10 completed jobs across 5 locations, create one invoice with all 10 jobs
- **Use case**: Small organizations that want a single monthly invoice for all work
- **Status**: Will evaluate based on user feedback
```

---

### 2. Integration Tests - End-to-End Workflow

#### 2.1 Complete Auto-Generate Flow

**Setup**:

1. Create organization with hierarchy node
2. Configure auto-generate (weekly, Monday, 09:00, require_review=true)
3. Create locations under hierarchy
4. Create and complete jobs

**Test Steps**:

```typescript
// Test 1: Happy Path
1. ✅ Set system time to Monday 09:00
2. ✅ Invoke auto-generate-invoices function
3. ✅ Verify invoices created with pending_review status
4. ✅ Verify invoice_job records created
5. ✅ Verify pricing_snapshot records created
6. ✅ Verify admin notification email sent
7. ✅ Verify invoice numbers are sequential

// Test 2: No Jobs to Invoice
1. ✅ Set up hierarchy with no completed jobs
2. ✅ Invoke function
3. ✅ Verify no invoices created
4. ✅ Verify no errors logged

// Test 3: All Jobs Already Invoiced
1. ✅ Create completed jobs
2. ✅ Manually create invoices for all jobs
3. ✅ Invoke auto-generate function
4. ✅ Verify no duplicate invoices created
5. ✅ Verify no errors

// Test 4: Partial Jobs Already Invoiced
1. ✅ Create 5 completed jobs
2. ✅ Manually invoice 2 jobs
3. ✅ Invoke auto-generate function
4. ✅ Verify invoice created for remaining 3 jobs only
```

#### 2.2 Review Workflow

```typescript
// Test 1: Approve Invoice
1. ✅ Create pending_review invoice
2. ✅ Call approve action (status → draft)
3. ✅ Verify invoice can now be sent
4. ✅ Verify UI updates correctly

// Test 2: Reject Invoice
1. ✅ Create pending_review invoice
2. ✅ Call reject action (status → cancelled)
3. ✅ Verify invoice cannot be sent
4. ✅ Verify jobs are still marked as invoiced

// Test 3: Send Approved Invoice
1. ✅ Create pending_review invoice
2. ✅ Approve (→ draft)
3. ✅ Send invoice
4. ✅ Verify email sent to customer
5. ✅ Verify status → sent

// Test 4: Auto-Send Approved Invoices
1. ✅ Create pending_review invoices
2. ✅ Approve all (→ draft)
3. ✅ Trigger auto-send-invoices function
4. ✅ Verify only draft invoices sent (not pending_review)
```

---

### 3. Edge Cases & Error Handling

#### 3.1 Data Integrity

```typescript
// Concurrent Invoice Generation:
- ✅ Two functions running simultaneously
- ✅ Verify no duplicate invoice numbers
- ✅ Verify no duplicate invoice_job records

// Missing Data:
- ✅ Organization without org_code (should error gracefully)
- ✅ Location without hierarchy_parent_id
- ✅ Job without location_id
- ✅ Job with invalid submission_data

// Database Constraints:
- ✅ Invoice with invalid organization_id
- ✅ Invoice_job with non-existent invoice_id
- ✅ Pricing_snapshot with invalid pricing_rule_id
```

#### 3.2 Calculation Errors

```typescript
// Invoice Calculation Failures:
- ✅ calculate-invoice function returns error
- ✅ Missing pricing rules (should use defaults)
- ✅ Invalid pricing rule configuration
- ✅ Currency mismatch between jobs

// Pricing Snapshot Errors:
- ✅ Non-critical: Should log warning but continue
- ✅ Verify invoice still created even if snapshots fail
```

#### 3.3 Email Notification Errors

```typescript
// Email Failures:
- ✅ Resend API error (should log but not fail invoice creation)
- ✅ Invalid admin email addresses
- ✅ No admin users in organization
- ✅ Test mode enabled (should redirect to test addresses)
- ✅ SKIP_EMAIL_SENDING=true (should skip but succeed)
```

#### 3.4 Configuration Edge Cases

```typescript
// Invalid Configurations:
- ✅ Hierarchy node with invalid metadata structure
- ✅ Auto-generate enabled but period not set
- ✅ Weekly period without day_of_week
- ✅ Monthly period without day_of_month
- ✅ Invalid time format (should use default)

// Multiple Hierarchy Nodes:
- ✅ Same location under multiple nodes (should use first match)
- ✅ Conflicting auto-generate configs
- ✅ Auto-generate + auto-send both enabled
```

#### 3.5 Time Zone & Scheduling

```typescript
// Time Zone Issues (TODO - see GitHub issue #12):
- ⚠️ **Current behavior**: Function runs in UTC timezone, but users configure times (e.g., "09:00") thinking it's their local time
- ⚠️ **Problem**: If a user in Australia (UTC+10) sets "09:00", the function checks against 09:00 UTC, which is 19:00 (7pm) local time
- ⚠️ **Future solution**: Store timezone with organization or hierarchy config, then convert configured time to UTC before checking
- ⚠️ **Edge cases**: Daylight saving time transitions, different time zones for different organizations
- **Example**: Organization in Sydney (AEST, UTC+10) sets "09:00" → should run at 09:00 AEST = 23:00 UTC previous day
- **Status**: Tracked in [GitHub issue #12](https://github.com/lewi0231/clean-log-system/issues/12) - not a priority for Phase 1

// Schedule Edge Cases:
- ✅ Function runs at 08:59 (should not trigger)
- ✅ Function runs at 09:01 (should not trigger)
- ✅ Function runs at exactly 09:00 (should trigger)
- ✅ Month with 28/29/30/31 days
- ✅ Leap year handling
```

---

### 4. UI/UX Tests

#### 4.1 Location Hierarchy Manager

```typescript
// Auto-Generate Configuration UI:
- ✅ Toggle enables/disables section
- ✅ Period dropdown shows all options
- ✅ Day of week shows for weekly
- ✅ Day of month shows for monthly
- ✅ Time input accepts 24-hour format
- ✅ Grouping dropdown shows all options
- ✅ Require review toggle works
- ✅ Config saves to metadata correctly
- ✅ Config loads from metadata correctly
```

#### 4.2 Invoice List & Review

```typescript
// Status Filtering:
- ✅ URL parameter ?status=pending_review filters correctly
- ✅ Status badge shows "Pending Review"
- ✅ Approve/Reject buttons visible for pending_review
- ✅ Buttons disabled during action
- ✅ Toast notifications on success/error

// Invoice Actions:
- ✅ Approve button changes status to draft
- ✅ Reject button changes status to cancelled
- ✅ Send button works for draft invoices
- ✅ Resend button works for sent invoices
```

#### 4.3 Email Notifications

```typescript
// Admin Notification Email:
- ✅ Email sent to all admin users
- ✅ Email includes invoice count
- ✅ Email includes invoice list with totals
- ✅ Review link points to correct URL
- ✅ Email formatting (HTML + text)
- ✅ Test mode redirects correctly
```

---

### 5. Performance & Scalability

#### 5.1 Large Dataset Handling

```typescript
// Performance Tests:
- ✅ 1000+ completed jobs
- ✅ 100+ locations
- ✅ Multiple hierarchy nodes
- ✅ Concurrent invoice generation
- ✅ Database query optimization

// Memory & Timeout:
- ✅ Function completes within timeout (60s)
- ✅ No memory leaks
- ✅ Efficient database queries (no N+1)
```

---

### 6. Security & Authorization

#### 6.1 Access Control

```typescript
// Authorization:
- ✅ Function uses service role (no user auth needed)
- ✅ Cron job authentication
- ✅ Admin-only UI access
- ✅ Organization isolation (no cross-org data)
```

---

## Test Execution Plan

### Phase 1: Unit Tests (Week 1)

1. Create test file: `auto-generate-invoices.test.ts`
2. Test configuration parsing
3. Test schedule validation
4. Test invoice number generation
5. Test grouping logic

### Phase 2: Integration Tests (Week 1-2)

1. Set up test database with sample data
2. Test complete auto-generate flow
3. Test review workflow
4. Test edge cases

### Phase 3: Manual Testing (Week 2)

1. UI testing in development environment
2. Email notification testing
3. End-to-end user workflow
4. Error scenario testing

### Phase 4: Production Readiness (Week 2-3)

1. Load testing with production-like data
2. Monitor function execution times
3. Verify cron job scheduling
4. Production smoke tests

---

## Test Data Setup

### Required Test Data

```sql
-- Organizations
- Test Org 1 (with org_code)
- Test Org 2 (without org_code - error case)

-- Hierarchy Nodes
- Company with auto-generate enabled (weekly, Monday, 09:00)
- Region with auto-generate enabled (monthly, day 1)
- Company with auto-generate disabled

-- Locations
- 5 locations under enabled hierarchy
- 2 locations under disabled hierarchy
- 1 location without hierarchy_parent_id

-- Jobs
- 20 completed jobs (not invoiced)
- 10 completed jobs (already invoiced)
- 5 jobs with null location_id
- Jobs with various submission_data structures
```

---

## Known Issues & TODOs

### Critical

- ✅ **Fortnightly schedule**: Removed - not needed for Phase 1
- ⚠️ **Time zone handling**: Function runs in UTC, config may be local time (see Phase 2 improvements above)

### Medium Priority

- ⚠️ **Customer grouping**: Not yet implemented - location grouping is sufficient for now
- ⚠️ **All together grouping**: Not yet implemented - location grouping is sufficient for now
- ⚠️ **Batch approval**: UI feature for Phase 2

### Low Priority

- ⚠️ **In-app notifications**: Email-only for Phase 1
- ⚠️ **Auto-approval rules**: Future enhancement

---

## Success Criteria

### Must Have (P0)

- ✅ Auto-generate creates invoices correctly
- ✅ Invoices have correct status (pending_review or draft)
- ✅ Admin notifications sent
- ✅ Review workflow works (approve/reject)
- ✅ No duplicate invoices created
- ✅ No data corruption

### Should Have (P1)

- ✅ Function completes within 60s
- ✅ Handles 1000+ jobs efficiently
- ✅ Error messages are clear
- ✅ UI is intuitive

### Nice to Have (P2)

- ⚠️ Time zone handling improved (see [GitHub issue #12](https://github.com/lewi0231/clean-log-system/issues/12) - tracked for future)
- ⚠️ Customer grouping implemented (not a priority - location grouping is sufficient)

---

## Monitoring & Alerts

### Metrics to Track

- Function execution time
- Number of invoices generated per run
- Number of errors per run
- Email delivery success rate
- Invoice approval/rejection rates

### Alerts to Set Up

- Function execution failures
- High error rate (>5%)
- No invoices generated when expected
- Email delivery failures

---

## Rollout Plan

### Stage 1: Internal Testing

- Deploy to staging environment
- Run all test suites
- Manual testing by team

### Stage 2: Beta Testing

- Enable for 1-2 test organizations
- Monitor closely for 1 week
- Gather feedback

### Stage 3: Gradual Rollout

- Enable for 10% of organizations
- Monitor for 1 week
- Increase to 50%, then 100%

### Stage 4: Full Production

- All organizations enabled
- Monitor metrics
- Address any issues

---

## Test Checklist

### Pre-Deployment

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Manual UI testing complete
- [ ] Email notifications tested
- [ ] Edge cases verified
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Rollback plan prepared

### Post-Deployment

- [ ] Monitor function execution
- [ ] Verify cron job scheduling
- [ ] Check error logs
- [ ] Verify email delivery
- [ ] User feedback collection
- [ ] Performance monitoring
