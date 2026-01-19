# User Story 002: Invoice List and Filtering

## Overview

Admins need to view and filter all invoices in a list view with status indicators, date ranges, and quick actions. This supports invoice management, tracking, and finding specific invoices quickly.

## User Story

**As an** admin user  
**I want to** view and filter all invoices with status indicators and date ranges  
**So that** I can quickly find specific invoices, track invoice status, and manage my invoicing workflow

## Implementation Status

| Status | Feature |
|--------|---------|
| ✅ | Invoice list with reverse chronological order |
| ✅ | Invoice data display (number, date, jobs, location, total, status, due date) |
| ✅ | Status badges with appropriate colors |
| ✅ | Date range filtering |
| ✅ | Test invoice toggle |
| ✅ | Quick actions (send, approve, reject, resend) |
| ✅ | Loading states |
| ✅ | Empty state |
| ⬜ | Status filter dropdown (user-facing) |
| ⬜ | Search by invoice number |
| ⬜ | Pagination for large lists |

**Overall: ~85% Complete**

## Acceptance Criteria

### Core Features (Implemented)

1. Invoice list displays all invoices in reverse chronological order (newest first)
2. For each invoice, show:
   - Invoice number (clickable to view details)
   - Creation date
   - Number of jobs included
   - Location names (comma-separated, truncated if long)
   - Total amount (formatted with currency)
   - Status badge (draft, pending_review, sent, paid, overdue, cancelled)
   - Due date
   - Paid indicator (if paid_at is set)
   - Test invoice indicator (if is_test is true)
3. Status badges use appropriate colors:
   - Draft: outline
   - Pending Review: secondary
   - Sent: default
   - Paid: secondary (with checkmark icon)
   - Overdue: destructive
   - Cancelled: outline
4. Date range filtering:
   - Filter by start date (creation date)
   - Filter by end date (creation date)
   - Clear filters button
   - Filters persist during session
5. Test invoice toggle:
   - Show/hide test invoices (default: hidden)
   - Clear visual indicator for test invoices
6. Quick actions per invoice:
   - View details (opens invoice detail page)
   - Send invoice (if status allows)
   - Approve invoice (if pending_review)
   - Reject invoice (if pending_review)
   - Resend invoice (if sent)
7. Loading states while fetching invoices
8. Empty state when no invoices match filters

### Enhancements (To Be Implemented)

9. Status filtering:
   - Filter by specific status via dropdown
   - Show all statuses (default)
10. Search functionality:
    - Search by invoice number
    - Search by customer/location name
11. Pagination or infinite scroll for large invoice lists (50+ invoices)

## Technical Details

### Current Implementation

- Component: `dashboard/components/invoicing/invoice-list.tsx`
- Hook: `dashboard/hooks/use-invoices.ts`
- Edge function: `database/supabase/functions/list-invoices/index.ts`

### Filtering Logic

- Date filters apply to `invoice.created_at` timestamp
- Status filter applies to `invoice.status`
- Test filter applies to `invoice.is_test` flag
- Filters are combined with AND logic

### Status Display

Status badges show:
- Status text (formatted: "Pending Review" instead of "pending_review")
- Color-coded variant
- Paid checkmark icon if `paid_at` is set
- Test badge if `is_test` is true

### Quick Actions

Actions available based on invoice status:
- **Draft**: View, Send, Delete
- **Pending Review**: View, Approve, Reject
- **Sent**: View, Resend, Mark as Paid
- **Paid**: View, Resend
- **Overdue**: View, Resend, Send Reminder
- **Cancelled**: View only

## Related Components

- `dashboard/components/invoicing/invoice-list.tsx` - Main list component
- `dashboard/hooks/use-invoices.ts` - Data fetching hook
- `dashboard/app/dashboard/invoicing/page.tsx` - Parent page
- `database/supabase/functions/list-invoices/index.ts` - Backend list function

## Testing Considerations

1. **Display**:
   - Verify all invoice data displays correctly
   - Verify status badges match database status
   - Verify currency formatting
   - Verify date formatting
   - Verify location name truncation

2. **Filtering**:
   - Test start date filter
   - Test end date filter
   - Test both filters together
   - Test status filter
   - Test test invoice toggle
   - Test filter combinations
   - Test clear filters

3. **Actions**:
   - Test view details navigation
   - Test send invoice action
   - Test approve/reject actions
   - Test resend action
   - Test action availability based on status

4. **Edge Cases**:
   - Empty invoice list
   - Very long location names
   - Invoices with no jobs
   - Invoices with no locations
   - Large number of invoices (pagination)

5. **Performance**:
   - Test with 1000+ invoices
   - Test filter performance
   - Consider server-side filtering for large datasets

## Priority

**Priority**: High  
**Complexity**: Medium  
**Status**: ⚠️ Enhancements Needed

## Notes

- Current implementation is functional with date filtering and quick actions
- **Priority enhancements:**
  - Status filter dropdown for better UX
  - Search by invoice number
  - Pagination for organizations with many invoices
- **Future enhancements:**
  - Sorting options (by amount, due date, status)
  - Bulk actions (select multiple invoices)
  - Export filtered list to CSV/PDF
  - Saved filter presets

## Research References

- Invoice lists are standard in all invoicing systems
- Users expect filtering, sorting, and search capabilities
- Status indicators help users quickly understand invoice state
- Date range filtering is essential for financial reporting
- Quick actions improve workflow efficiency
