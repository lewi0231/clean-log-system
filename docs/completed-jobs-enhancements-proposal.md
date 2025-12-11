# Completed Jobs Page Enhancements Proposal

## Overview

This document outlines proposed enhancements to the Completed Jobs page (`dashboard/app/dashboard/completed-jobs/page.tsx`) based on user feedback and best practices research.

## Requirements Addressed

### 1. Job Editing Functionality

**User Need**: Admins need to edit completed jobs when workers make mistakes.

**Best Practices Research Findings**:

- Maintain clear audit trail for all edits
- Provide warnings when editing jobs that are already invoiced
- Allow inline editing with clear visual indicators
- Consider impact on existing invoices (may need recalculation)

**Proposed Solution**:

- Add "Edit" button/icon to each job row (admin only)
- Open edit dialog similar to `CreateJobDialog` but pre-populated
- Show warning banner if job is already invoiced:
  - "This job is included in invoice [INVOICE_NUMBER]. Editing may affect invoice totals."
  - Option to "Recalculate Invoice" after edit
- Log all edits with timestamp and admin user
- Use same form structure as create dialog for consistency

**Implementation Approach**:

1. Create `EditJobDialog` component (similar to `CreateJobDialog`)
2. Add `update-job` edge function (similar to `admin-create-job`)
3. Add edit button to `CompletedJobsList` component
4. Track edit history (consider adding `job_edits` table or `edited_at` field)

### 2. Sorting Functionality

**User Need**: Sort jobs similar to invoices.

**Current Invoice Sorting**:

- Invoices are sorted by `created_at DESC` (most recent first)
- Date range filtering available

**Proposed Solution**:
Add sort controls similar to pricing history component:

- **Sort by Date** (completed_at) - default, descending
- **Sort by Location** (alphabetical)
- **Sort by Worker** (alphabetical by first worker)
- **Sort by Status** (invoiced/paid status)
- Toggle ascending/descending for each

**UI Pattern**:
Use button group similar to `pricing-history.tsx`:

```tsx
<Button
  variant={sortBy === "date" ? "default" : "outline"}
  size="sm"
  onClick={() => handleSort("date")}
>
  <Calendar className="mr-2 h-4 w-4" />
  Sort by Date {sortBy === "date" && (sortOrder === "desc" ? "↓" : "↑")}
</Button>
```

### 3. Status Badges

**User Need**: Visual indicators for invoiced/paid status.

**Database Schema Analysis**:

- `job` table: No direct status field
- `invoice_job` table: Links jobs to invoices (many-to-many)
- `invoice` table: Has `status` (draft, sent, paid, overdue, cancelled) and `paid_at`

**Status Determination Logic**:

1. **Not Invoiced**: Job not in `invoice_job` table
2. **Invoiced (Draft)**: Job linked to invoice with status = "draft"
3. **Invoiced (Sent)**: Job linked to invoice with status = "sent"
4. **Paid**: Job linked to invoice with `paid_at IS NOT NULL` OR status = "paid"
5. **Overdue**: Job linked to invoice with status = "overdue"

**Proposed Badge Design**:

- Use Badge component similar to invoice list
- Color coding:
  - **Not Invoiced**: Gray/outline (default variant)
  - **Draft**: Yellow/outline
  - **Sent**: Blue (default variant)
  - **Paid**: Green (secondary variant)
  - **Overdue**: Red (destructive variant)

**Implementation**:

1. Update `list-jobs` edge function to include invoice status
2. Add status calculation in frontend or backend
3. Display badge in job list table

## Database Changes Required

### Option 1: Extend list-jobs query (Recommended)

Update `database/supabase/functions/list-jobs/index.ts` to include invoice information:

```typescript
.select(`
  id,
  organization_id,
  location_id,
  submission_data,
  completed_at,
  created_at,
  location:location_id (...),
  invoice_job:invoice_job (
    invoice:invoice_id (
      id,
      invoice_number,
      status,
      paid_at
    )
  )
`)
```

Then calculate status in frontend or add computed field in backend.

### Option 2: Add computed status field

Add a database view or computed column, but Option 1 is simpler.

## Implementation Plan

### Phase 1: Status Badges & Sorting

1. ✅ Update `list-jobs` edge function to include invoice data
2. ✅ Add status calculation logic
3. ✅ Add status badge column to `CompletedJobsList`
4. ✅ Implement sorting state and controls
5. ✅ Add sort buttons to page header

### Phase 2: Job Editing

1. ✅ Create `update-job` edge function
2. ✅ Create `EditJobDialog` component
3. ✅ Add edit button to job rows (admin only)
4. ✅ Add warning for invoiced jobs
5. ✅ Implement invoice recalculation option (future enhancement)

### Phase 3: Audit Trail (Future)

1. Add `job_edits` table or `edited_at`/`edited_by` fields
2. Display edit history in job details
3. Add edit history API endpoint

## UI Mockup Structure

```
┌─────────────────────────────────────────────────────────┐
│ Completed Jobs                              [Create Job]│
│ View all completed jobs and their submission data       │
├─────────────────────────────────────────────────────────┤
│ [Sort by Date ↓] [Sort by Location] [Sort by Status]   │
├─────────────────────────────────────────────────────────┤
│ Location │ Workers │ ...fields... │ Status │ [Actions]  │
│ Location1│ Worker1 │ ...         │ [Paid] │ [Edit]     │
│ Location2│ Worker2 │ ...         │ [Sent] │ [Edit]     │
└─────────────────────────────────────────────────────────┘
```

## Files to Modify

### Backend

- `database/supabase/functions/list-jobs/index.ts` - Add invoice data
- `database/supabase/functions/update-job/index.ts` - New file for editing

### Frontend

- `dashboard/app/dashboard/completed-jobs/page.tsx` - Add sorting controls
- `dashboard/components/completed-jobs/completed-jobs-list.tsx` - Add status column, edit button
- `dashboard/components/completed-jobs/edit-job-dialog.tsx` - New component
- `dashboard/lib/services/jobs.service.ts` - Add update method
- `dashboard/lib/types.ts` - Update Job type to include invoice status
- `dashboard/hooks/use-jobs.ts` - Add update mutation

## Considerations

### Invoice Recalculation

When a job is edited that's already invoiced:

- **Option A**: Automatically recalculate invoice (may be disruptive)
- **Option B**: Show warning and require manual recalculation (safer)
- **Option C**: Create new invoice version (complex)

**Recommendation**: Option B for Phase 2, Option A for future enhancement.

### Edit Permissions

- Only admins can edit jobs (already checked in page)
- Consider adding role-based permissions in backend

### Data Validation

- Use same validation rules as create dialog
- Ensure edited data matches field configs

## Next Steps

1. Review and approve this proposal
2. Implement Phase 1 (Status Badges & Sorting)
3. Test with sample data
4. Implement Phase 2 (Job Editing)
5. Gather user feedback
6. Plan Phase 3 (Audit Trail) if needed
