# Invoice Features Implementation Plan

This document outlines the implementation plan for completing the invoice functionality based on the user story review.

## Executive Summary

| Priority | Features | Status |
|----------|----------|--------|
| **P1** | Overdue Management, Payment Tracking, List Enhancements | Not Started |
| **P2** | PDF Export, Approval Enhancements | Not Started |
| **P3** | CSV Export, Multi-level Approval, Analytics | Future Version |

---

## Priority 1: High Business Value

These features directly impact cash flow and daily operations.

### 1.1 Overdue Invoice Management (US-009)

**Business Value**: Critical for cash flow - unpaid invoices cost money

#### Phase 1A: Automatic Overdue Detection

**Files to Create:**
- `database/supabase/functions/mark-overdue-invoices/index.ts`
- `database/supabase/functions/mark-overdue-invoices/deno.json`

**Implementation:**

```typescript
// mark-overdue-invoices/index.ts
// Cron job to mark sent invoices as overdue when past due date

// Query: SELECT * FROM invoice 
//        WHERE status = 'sent' 
//        AND due_date < CURRENT_DATE 
//        AND paid_at IS NULL

// Update: SET status = 'overdue'
```

**Database Changes:**
- Add `reminder_count` column to invoice table (integer, default 0)
- Add `last_reminder_sent_at` column to invoice table (timestamp)

**Supabase Cron Configuration:**
- Schedule: Daily at 00:05 UTC
- Function: `mark-overdue-invoices`

#### Phase 1B: Days Overdue Display

**Files to Modify:**
- `dashboard/components/invoicing/invoice-list.tsx`
- `dashboard/lib/types/index.ts` (if needed)

**Implementation:**
- Add `daysOverdue` calculation helper function
- Display days overdue in invoice list for overdue invoices
- Color-code: Yellow (1-7 days), Orange (8-14 days), Red (15+ days)

```typescript
// Helper function
const getDaysOverdue = (dueDate: string): number => {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - due.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};
```

#### Phase 1C: Dashboard Overdue Count

**Files to Modify:**
- `dashboard/app/dashboard/page.tsx`
- `dashboard/hooks/use-invoices.ts` (add count query)

**Implementation:**
- Add card showing count of overdue invoices
- Add total overdue amount
- Link to filtered invoice list

#### Phase 1D: Reminder Email System

**Files to Create:**
- `database/supabase/functions/send-invoice-reminder/index.ts`
- `database/supabase/functions/send-invoice-reminder/deno.json`
- `database/supabase/functions/_utils/email.ts` (add `sendReminderEmail` function)

**Files to Modify:**
- `dashboard/components/invoicing/invoice-list.tsx` (add Send Reminder button)

**Implementation:**
- Create reminder email template (different from initial invoice email)
- Add "Send Reminder" action to overdue invoices in list
- Track reminder count and last sent date
- Prevent spam (minimum 3 days between reminders)

---

### 1.2 Payment Tracking Improvements (US-008)

**Business Value**: Essential for accounts receivable and reconciliation

#### Phase 2A: Payment History Component

**Files to Create:**
- `dashboard/components/invoicing/payment-history.tsx`
- `dashboard/hooks/use-payments.ts`

**Implementation:**

```typescript
// payment-history.tsx
interface PaymentHistoryProps {
  invoiceId: string;
  invoiceTotal: number;
  currency: string;
}

// Display:
// - List of all payments with status, amount, method, date
// - Total paid
// - Remaining balance
// - Payment status badges (succeeded, failed, pending, refunded)
```

#### Phase 2B: Manual Payment Recording

**Files to Create:**
- `dashboard/components/invoicing/record-payment-dialog.tsx`
- `database/supabase/functions/record-manual-payment/index.ts`

**Implementation:**
- Dialog with fields: amount, method (dropdown), reference, date, notes
- Methods: Bank Transfer, Cash, Check, Other
- Validate amount doesn't exceed remaining balance
- Update invoice status to "paid" if fully paid

```typescript
// record-payment-dialog.tsx
interface RecordPaymentDialogProps {
  invoice: InvoiceWithJobs;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentRecorded: () => void;
}
```

#### Phase 2C: Invoice Detail Integration

**Files to Modify:**
- `dashboard/app/dashboard/invoicing/[id]/page.tsx` (or equivalent)
- `dashboard/components/invoicing/invoice-preview-dialog.tsx`

**Implementation:**
- Add PaymentHistory component to invoice detail view
- Add "Record Payment" button (visible for sent/overdue invoices)
- Display remaining balance prominently
- Show payment summary card

---

### 1.3 Invoice List Enhancements (US-002)

**Business Value**: Improves admin efficiency for daily invoice management

#### Phase 3A: Status Filter Dropdown

**Files to Modify:**
- `dashboard/components/invoicing/invoice-list.tsx`

**Implementation:**
- Add Select component for status filter
- Options: All, Draft, Pending Review, Sent, Paid, Overdue, Cancelled
- Filter applied client-side or via query parameter

```typescript
const INVOICE_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];
```

#### Phase 3B: Search by Invoice Number

**Files to Modify:**
- `dashboard/components/invoicing/invoice-list.tsx`
- `dashboard/hooks/use-invoices.ts`
- `database/supabase/functions/list-invoices/index.ts`

**Implementation:**
- Add search input with debounce (300ms)
- Search by invoice number (partial match)
- Search by location name (optional enhancement)

#### Phase 3C: Pagination

**Files to Modify:**
- `dashboard/components/invoicing/invoice-list.tsx`
- `dashboard/hooks/use-invoices.ts`
- `database/supabase/functions/list-invoices/index.ts`

**Implementation:**
- Add pagination component (page size: 25)
- Server-side pagination via LIMIT/OFFSET
- Show total count and current page
- Alternative: Infinite scroll with "Load More" button

---

## Priority 2: Good to Have

These features improve the user experience but aren't critical for MVP.

### 2.1 PDF Export (US-010)

**Business Value**: Professional document management and email attachments

#### Phase 4A: Server-side PDF Generation

**Files to Create:**
- `database/supabase/functions/generate-invoice-pdf/index.ts`
- `database/supabase/functions/generate-invoice-pdf/deno.json`

**Implementation Options:**

**Option A: Puppeteer (Recommended)**
- Render invoice HTML template
- Generate PDF from rendered page
- Return as base64 or direct download

**Option B: PDFKit**
- Build PDF programmatically
- More control, but more complex

**Option C: External Service**
- Use service like PDFShift or DocRaptor
- Simpler but adds external dependency

**Recommendation**: Start with Puppeteer for flexibility

#### Phase 4B: PDF Download Button

**Files to Modify:**
- `dashboard/app/invoice/[id]/page.tsx`
- `dashboard/components/invoicing/invoice-preview-dialog.tsx`

**Implementation:**
- Add "Download PDF" button next to Print button
- Show loading spinner during generation
- Trigger browser download on completion
- Filename: `Invoice-{INVOICE_NUMBER}.pdf`

---

### 2.2 Approval Workflow Enhancements (US-005)

**Business Value**: Efficiency for high-volume businesses

#### Phase 5A: Bulk Approval UI

**Files to Modify:**
- `dashboard/components/invoicing/invoice-list.tsx`

**Implementation:**
- Add checkbox column to invoice table
- Add "Select All" checkbox in header
- Show bulk action bar when items selected
- Actions: "Approve Selected", "Reject Selected"

```typescript
const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

const handleBulkApprove = async () => {
  // Approve all selected invoices with pending_review status
};
```

#### Phase 5B: Email Notifications for Pending Reviews

**Files to Create:**
- `database/supabase/functions/notify-pending-invoices/index.ts`

**Files to Modify:**
- `database/supabase/functions/_utils/email.ts` (add notification template)

**Implementation:**
- Daily digest email to admins
- Count of pending review invoices
- Link to filtered invoice list
- Configurable: on/off in organization settings

---

## Implementation Order

### Sprint 1: Overdue Detection & Dashboard
1. Create `mark-overdue-invoices` edge function
2. Add database columns for reminders
3. Set up Supabase cron job
4. Add days overdue display to invoice list
5. Add overdue count card to dashboard

### Sprint 2: Payment Tracking
1. Create `use-payments` hook
2. Create `payment-history` component
3. Create `record-payment-dialog` component
4. Create `record-manual-payment` edge function
5. Integrate into invoice detail view

### Sprint 3: List Enhancements & Reminders
1. Add status filter dropdown
2. Add search input with debounce
3. Add pagination to list
4. Create `send-invoice-reminder` edge function
5. Add "Send Reminder" button to overdue invoices

### Sprint 4: PDF & Bulk Actions
1. Create `generate-invoice-pdf` edge function
2. Add PDF download button
3. Add bulk selection UI to invoice list
4. Implement bulk approve/reject actions

### Sprint 5: Notifications (Optional)
1. Create pending invoice notification system
2. Add notification preferences to organization settings

---

## Database Schema Changes

```sql
-- Add reminder tracking to invoice table
ALTER TABLE invoice 
ADD COLUMN reminder_count INTEGER DEFAULT 0,
ADD COLUMN last_reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Index for overdue detection cron job
CREATE INDEX idx_invoice_overdue_candidates 
ON invoice (status, due_date, paid_at) 
WHERE status = 'sent' AND paid_at IS NULL;
```

---

## Testing Checklist

### Overdue Management
- [ ] Invoice marked overdue when due date passes
- [ ] Overdue count displays correctly on dashboard
- [ ] Days overdue calculation is accurate
- [ ] Reminder email sends successfully
- [ ] Reminder count increments correctly
- [ ] Cannot send reminder within 3 days of last

### Payment Tracking
- [ ] Payment history displays all payments
- [ ] Manual payment can be recorded
- [ ] Invoice status updates when fully paid
- [ ] Remaining balance calculates correctly
- [ ] Partial payments work correctly

### List Enhancements
- [ ] Status filter works correctly
- [ ] Search finds invoices by number
- [ ] Pagination navigates correctly
- [ ] Page size is respected
- [ ] Total count is accurate

### PDF Export
- [ ] PDF generates successfully
- [ ] PDF content matches invoice preview
- [ ] Download triggers correctly
- [ ] Filename is correct

### Bulk Actions
- [ ] Checkboxes select/deselect correctly
- [ ] Select all works
- [ ] Bulk approve updates all selected
- [ ] Bulk reject updates all selected
- [ ] Actions only apply to valid statuses

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| PDF generation performance | Medium | Medium | Cache generated PDFs, async generation |
| Cron job failures | Low | High | Monitoring, retry logic, alerts |
| Email delivery issues | Low | Medium | Use reliable provider (Resend), retry queue |
| Pagination breaking existing views | Low | Low | Feature flag for rollout |

---

## Success Metrics

1. **Overdue Management**
   - Reduce average days to payment by 10%
   - 80% of overdue invoices have reminder sent within 7 days

2. **Payment Tracking**
   - 100% of payments visible in dashboard
   - Reduce time to reconcile payments by 50%

3. **List Enhancements**
   - Admin can find specific invoice in <10 seconds
   - Page load time <2 seconds with pagination

4. **PDF Export**
   - PDF generation completes in <5 seconds
   - 95% customer satisfaction with PDF quality
