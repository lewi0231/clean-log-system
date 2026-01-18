# User Story 005: Invoice Approval Workflow

## Overview

Admins need to review and approve auto-generated invoices before they are sent to customers. This ensures accuracy and allows manual adjustments before customer delivery.

## User Story

**As an** admin user  
**I want to** review and approve auto-generated invoices before they are sent  
**So that** I can verify invoice accuracy and make adjustments before customers receive them

## Acceptance Criteria

1. Auto-generated invoices are created with status "pending_review"
2. Admin can view pending review invoices in invoice list:
   - Filter by "pending_review" status
   - Clear visual indicator (badge) for pending review
   - Count of pending review invoices
3. Admin can approve invoice:
   - Review invoice details and calculations
   - Approve action changes status to "sent" (or "draft" if not auto-sending)
   - Invoice can then be sent to customer
   - Approval timestamp recorded
4. Admin can reject invoice:
   - Reject action changes status to "draft" or "cancelled"
   - Admin can add rejection reason/notes
   - Rejected invoice can be edited and resent
   - Rejection timestamp recorded
5. Admin can edit pending review invoice:
   - Modify due date
   - Modify notes
   - Cancel invoice
   - Then approve or reject
6. Bulk approval (optional):
   - Select multiple pending review invoices
   - Approve all at once
   - Bulk rejection with reason
7. Notification system:
   - Admin notified when invoices are pending review
   - Notification count in dashboard
   - Email notification option
8. Approval workflow respects organization settings:
   - Auto-send after approval (if configured)
   - Require approval for all auto-generated invoices
9. Audit trail:
   - Track who approved/rejected
   - Track when approved/rejected
   - Track approval/rejection reason
10. Quick actions:
   - Approve and send (one action)
   - Approve and keep as draft
   - Reject and cancel

## Technical Details

### Current Implementation

- Status: "pending_review" added to invoice status enum
- Auto-generation: Creates invoices with "pending_review" status
- Edge function: `database/supabase/functions/update-invoice-status/index.ts`
- Component: `dashboard/components/invoicing/invoice-list.tsx` (approve/reject buttons)

### Invoice Status Flow

```
Auto-generated: pending_review
    ↓
Approve → sent (or draft if not auto-sending)
    ↓
Reject → draft (or cancelled)
```

### Auto-Generation Behavior

- Auto-generated invoices always created with "pending_review" status
- `require_review: true` in auto-generate config (not configurable, always true)
- Admin must approve before sending

### Approval Actions

**Approve**:
- Status: `pending_review` → `sent` (or `draft`)
- Action: `update-invoice-status` with `status: "sent"`
- Optional: Auto-send email after approval

**Reject**:
- Status: `pending_review` → `draft` (or `cancelled`)
- Action: `update-invoice-status` with `status: "draft"` or `"cancelled"`
- Optional: Add rejection notes

## Related Components

- `dashboard/components/invoicing/invoice-list.tsx` - Approve/reject buttons
- `dashboard/app/dashboard/invoicing/page.tsx` - Invoice list page
- `database/supabase/functions/update-invoice-status/index.ts` - Status update
- `database/supabase/functions/auto-generate-invoices/index.ts` - Auto-generation

## Testing Considerations

1. **Approval**:
   - Test approving pending review invoice
   - Test status changes correctly
   - Test approval timestamp recorded
   - Test approve and send workflow

2. **Rejection**:
   - Test rejecting pending review invoice
   - Test status changes correctly
   - Test rejection notes saved
   - Test rejected invoice can be edited

3. **Bulk Actions**:
   - Test bulk approval
   - Test bulk rejection
   - Test bulk actions with mixed statuses

4. **Workflow**:
   - Test auto-generated invoices have pending_review status
   - Test approval workflow end-to-end
   - Test rejection workflow end-to-end

5. **Edge Cases**:
   - Approve already approved invoice (should error)
   - Reject already sent invoice (should error)
   - Multiple admins approving same invoice (should handle gracefully)

## Priority

**Priority**: High  
**Complexity**: Medium  
**Estimated Effort**: 2-3 days

## Notes

- Current implementation supports pending_review status
- Approve/reject actions exist but may need UX improvements
- Consider adding approval workflow customization (multi-level approval)
- Consider adding approval deadlines (auto-approve after X days)
- Future: Approval history/audit log
- Consider adding email notifications for pending reviews

## Research References

- Approval workflows are standard for auto-generated invoices
- Users expect clear approval/rejection actions
- Audit trails are important for compliance
- Bulk actions improve efficiency for high-volume businesses
- Notifications help ensure timely approvals
