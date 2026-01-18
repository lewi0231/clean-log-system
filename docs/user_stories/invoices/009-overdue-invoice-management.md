# User Story 009: Overdue Invoice Management

## Overview

Admins need to identify, track, and manage overdue invoices. The system should automatically mark invoices as overdue and provide tools for follow-up and collection.

## User Story

**As an** admin user  
**I want to** identify and manage overdue invoices with reminders and tracking  
**So that** I can improve cash flow by following up on unpaid invoices

## Acceptance Criteria

1. System automatically marks invoices as overdue:
   - Invoice status changes to "overdue" when due date passes
   - Invoice is not paid (`paid_at` is null)
   - Invoice status is "sent" (not draft, cancelled, or already paid)
2. Overdue detection runs automatically:
   - Daily check for overdue invoices
   - Updates status from "sent" to "overdue"
   - Does not change already paid invoices
3. Admin can view overdue invoices:
   - Filter by "overdue" status in invoice list
   - Overdue count displayed in dashboard
   - Overdue invoices highlighted (red badge)
   - Days overdue calculated and displayed
4. Overdue invoice information:
   - Original due date
   - Days overdue (calculated from due date)
   - Outstanding amount
   - Last payment date (if partial payments)
   - Customer contact information
5. Overdue reminders:
   - Admin can send reminder emails for overdue invoices
   - Reminder email includes:
     - Invoice number and amount
     - Days overdue
     - Payment link
     - Urgent payment request message
   - Reminder frequency configurable (weekly, bi-weekly, monthly)
   - Reminder history tracked
6. Bulk overdue actions:
   - Select multiple overdue invoices
   - Send reminders to all selected
   - Export overdue list (CSV)
   - Mark as written off (future)
7. Overdue reporting:
   - Total overdue amount
   - Number of overdue invoices
   - Average days overdue
   - Overdue by customer/location
8. Overdue invoice workflow:
   - View overdue invoice details
   - Send reminder email
   - Record collection notes
   - Mark as paid when payment received
   - Cancel if uncollectible (future)

## Technical Details

### Current Implementation

- Status: "overdue" exists in invoice status enum
- Detection: Should be implemented via cron job or scheduled function
- Component: `dashboard/components/invoicing/invoice-list.tsx` (overdue badge)
- Edge function: `database/supabase/functions/update-invoice-status/index.ts`

### Overdue Detection Logic

```typescript
function markOverdueInvoices() {
  // Find invoices that should be overdue
  const overdueInvoices = invoices.filter(invoice => {
    const dueDate = new Date(invoice.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return invoice.status === "sent" &&
           invoice.paid_at === null &&
           dueDate < today;
  });
  
  // Update status to overdue
  overdueInvoices.forEach(invoice => {
    updateInvoiceStatus(invoice.id, "overdue");
  });
}
```

### Overdue Calculation

Days overdue = Today - Due Date

Example:
- Due date: 2025-01-15
- Today: 2025-01-20
- Days overdue: 5

### Reminder Email

Reminder email should include:
- Subject: "Payment Reminder - Invoice [INVOICE_NUMBER] is [X] days overdue"
- Invoice details
- Outstanding amount
- Days overdue
- Payment link
- Urgent message

### Reminder Configuration

Reminder settings (future):
- Enable/disable automatic reminders
- Reminder frequency (weekly, bi-weekly, monthly)
- First reminder delay (e.g., 7 days after due date)
- Maximum reminders (e.g., 3 reminders max)

## Related Components

- `dashboard/components/invoicing/invoice-list.tsx` - Overdue display
- `database/supabase/functions/update-invoice-status/index.ts` - Status updates
- Future: `dashboard/components/invoicing/overdue-reminder-dialog.tsx`
- Future: `database/supabase/functions/send-overdue-reminders/index.ts`

## Testing Considerations

1. **Overdue Detection**:
   - Test invoices marked overdue on due date
   - Test invoices not marked if paid
   - Test invoices not marked if cancelled
   - Test invoices not marked if draft

2. **Overdue Display**:
   - Test overdue badge displays correctly
   - Test days overdue calculation
   - Test overdue filter works
   - Test overdue count in dashboard

3. **Reminders**:
   - Test reminder email sending
   - Test reminder email content
   - Test reminder frequency
   - Test reminder history

4. **Edge Cases**:
   - Invoice due today (should not be overdue)
   - Invoice with partial payment
   - Invoice with multiple reminders
   - Very old overdue invoices (100+ days)

5. **Bulk Actions**:
   - Test bulk reminder sending
   - Test bulk export
   - Test bulk selection

## Priority

**Priority**: Medium-High  
**Complexity**: Medium  
**Estimated Effort**: 3-4 days

## Notes

- Overdue status exists but automatic detection may need implementation
- Consider adding automatic reminder system
- Consider adding collection workflow
- Future: Integration with collection agencies
- Future: Payment plan options for overdue invoices
- Consider adding overdue analytics dashboard

## Research References

- Overdue invoice management is critical for cash flow
- Automatic detection reduces manual work
- Reminder emails improve collection rates
- Days overdue helps prioritize follow-up
- Bulk actions improve efficiency for high-volume businesses
