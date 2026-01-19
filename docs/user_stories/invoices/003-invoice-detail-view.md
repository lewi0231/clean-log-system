# User Story 003: Invoice Detail View

## Overview

Admins and customers need to view detailed invoice information including line items, calculations, payment history, and invoice status. This supports invoice review, payment processing, and customer communication.

## User Story

**As an** admin user or customer  
**I want to** view detailed invoice information with line items and payment history  
**So that** I can review invoice accuracy, track payment status, and understand what was billed

## Implementation Status

| Status | Feature |
|--------|---------|
| ✅ | Invoice header display |
| ✅ | Organization details |
| ✅ | Bill to / Service address |
| ✅ | Line items table |
| ✅ | Pricing breakdown |
| ✅ | Status badges |
| ✅ | Print functionality |
| ✅ | Send/Resend actions |
| ✅ | Approve/Reject actions |
| ✅ | Public invoice view |
| ✅ | Bank transfer details |
| ⬜ | Payment history display |
| ⬜ | Mark as paid (manual) dialog |

**Overall: ~90% Complete**

## Acceptance Criteria

### Admin View (Dashboard)

1. Admin can view full invoice details including:
   - Invoice header (number, date, due date, status)
   - Organization details (name, logo, ABN, contact info)
   - Bill to information (location details, billing address if configured)
   - Service address (where work was performed)
   - Line items table with:
     - Field name/label
     - Option value (if applicable)
     - Quantity
     - Unit price
     - Total
   - Pricing breakdown:
     - Subtotal
     - Adjustments (discounts, surcharges)
     - Total amount
   - Applied pricing rules (for reference)
   - Notes (if any)
   - Payment history (if payments exist)
2. Admin can perform actions:
   - Print invoice
   - Download as PDF (via print)
   - Send invoice (if not sent)
   - Resend invoice (if sent)
   - Approve invoice (if pending_review)
   - Reject invoice (if pending_review)
   - Mark as paid (manual payment)
   - Edit invoice (if draft)
   - Cancel invoice (if not paid)
3. Payment history shows:
   - All payments for this invoice
   - Payment date, amount, method, status
   - Payment reference numbers
   - Fees and net amount
4. Invoice preview matches template configuration
5. Responsive design for mobile viewing

### Customer View (Public)

6. Customer can view invoice via public link (`/invoice/[id]`)
7. Customer view includes:
   - Same invoice details as admin view
   - Payment button (if not paid and payment link exists)
   - Payment status indicator
   - Payment history (their payments only)
8. Customer cannot see:
   - Internal notes
   - Worker payment information
   - Admin-only actions
9. Customer can:
   - View invoice details
   - Pay invoice (via payment link)
   - Print/download invoice
10. Public view is accessible without authentication

## Technical Details

### Current Implementation

- Admin view: `dashboard/app/dashboard/invoicing/[id]/page.tsx`
- Public view: `dashboard/app/invoice/[id]/page.tsx`
- Preview component: `dashboard/components/invoicing/invoice-preview.tsx`
- Payment history: `dashboard/components/invoicing/payment-history.tsx`
- Edge function: `database/supabase/functions/get-invoice-details/index.ts`
- Public edge function: `database/supabase/functions/get-invoice-public/index.ts`

### Invoice Data Structure

```typescript
interface InvoiceData {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  created_at: string;
  due_date: string;
  paid_at: string | null;
  subtotal: number;
  total: number;
  currency: string;
  notes: string | null;
  calculation: InvoiceCalculation;
  template_config: InvoiceTemplateConfig;
  invoice_job: InvoiceJob[];
  payments?: Payment[];
}
```

### Template Configuration

Invoice display respects template configuration:
- Invoice title (default: "TAX INVOICE")
- Show/hide logo
- Show/hide ABN
- Bill to fields selection
- Service address configuration
- Billing address configuration
- Line item display format

### Payment Link

- Payment link is created when invoice is sent
- Link is included in invoice email
- Link allows customer to pay via Stripe
- Payment link ID stored in `invoice.payment_link_id`

## Related Components

- `dashboard/app/dashboard/invoicing/[id]/page.tsx` - Admin detail page
- `dashboard/app/invoice/[id]/page.tsx` - Public detail page
- `dashboard/components/invoicing/invoice-preview.tsx` - Preview component
- `dashboard/components/invoicing/payment-history.tsx` - Payment history
- `dashboard/components/invoicing/payment-link-button.tsx` - Payment button

## Testing Considerations

1. **Display**:
   - Verify all invoice data displays correctly
   - Verify line items match calculation
   - Verify currency formatting
   - Verify date formatting
   - Verify template configuration is applied

2. **Actions**:
   - Test print functionality
   - Test PDF download (print to PDF)
   - Test send invoice action
   - Test resend invoice action
   - Test approve/reject actions
   - Test mark as paid action

3. **Public View**:
   - Test public access without authentication
   - Test payment button functionality
   - Test payment history display
   - Test that admin-only data is hidden

4. **Edge Cases**:
   - Invoice with no line items
   - Invoice with very long notes
   - Invoice with many payments
   - Invoice with missing template config (should use defaults)
   - Invoice with missing organization logo

5. **Responsive Design**:
   - Test on mobile devices
   - Test print layout
   - Test PDF generation

## Priority

**Priority**: High  
**Complexity**: Medium  
**Status**: ⚠️ Enhancements Needed

## Notes

- Current implementation is comprehensive for invoice display
- **Priority enhancements:**
  - Payment history display component (see US-008)
  - Mark as paid dialog for manual payments
- **Future enhancements:**
  - Edit invoice functionality for draft invoices
  - Duplicate invoice functionality
  - Invoice comments/notes history
  - Real PDF generation (not just print)
  - Invoice versioning (track changes)
  - Invoice sharing options (email, link)

## Research References

- Invoice detail views are standard in all invoicing systems
- Customers expect clear, professional invoice presentation
- Payment history helps with reconciliation
- Print/PDF functionality is essential for record-keeping
- Public invoice links improve customer experience
