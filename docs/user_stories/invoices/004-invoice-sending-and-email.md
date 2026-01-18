# User Story 004: Invoice Sending and Email

## Overview

Admins need to send invoices to customers via email with payment links. The system should handle email delivery, payment link creation, and provide options for resending invoices.

## User Story

**As an** admin user  
**I want to** send invoices to customers via email with payment links  
**So that** customers receive invoices promptly and can pay easily through the included payment link

## Acceptance Criteria

1. Admin can send invoice from invoice detail page or list
2. System validates invoice can be sent:
   - Invoice status allows sending (draft, pending_review, sent)
   - Invoice is not cancelled
   - Valid email recipients are configured
3. Email recipients are determined by:
   - Invoice email recipient configuration (primary)
   - Location email addresses (fallback)
   - Organization primary contact email (last resort)
4. System creates payment link (Stripe) when sending:
   - Payment link amount matches invoice total
   - Payment link currency matches invoice currency
   - Payment link is stored in `invoice.payment_link_id`
   - Payment link URL is included in email
5. Invoice email includes:
   - Invoice number
   - Organization name
   - Total amount (formatted with currency)
   - Due date
   - Link to view invoice online
   - "Pay Now" button linking to payment link
   - Professional HTML email template
6. System updates invoice status to "sent" after successful email
7. System tracks email delivery:
   - Email sent timestamp
   - Email recipient addresses
   - Email delivery status (if available)
8. Admin can resend invoice:
   - Creates new payment link (invalidates old one)
   - Sends email again
   - Updates sent timestamp
9. Error handling:
   - Clear error messages if email sending fails
   - Clear error messages if no email recipients found
   - Clear error messages if payment link creation fails
10. Success feedback:
   - Toast notification on successful send
   - Invoice status updates immediately
   - Email sent timestamp visible in invoice details

## Technical Details

### Current Implementation

- Edge function: `database/supabase/functions/update-invoice-status/index.ts`
- Email function: `database/supabase/functions/_utils/email.ts` (sendInvoiceEmail)
- Payment link: `database/supabase/functions/create-payment-link/index.ts`
- Service: `dashboard/lib/services/invoice.service.ts`

### Email Sending Flow

1. **Validation**: Check invoice status and email recipients
2. **Payment Link**: Create or get existing payment link
3. **Email Data**: Prepare email data with invoice details
4. **Send Email**: Call Resend API to send email
5. **Update Status**: Update invoice status to "sent"
6. **Store Payment Link**: Save payment link ID to invoice

### Email Recipient Configuration

Email recipients are determined in this order:
1. Invoice email recipient config (from `invoice_template_config.email_recipient_config`)
2. Location email addresses (from `location.email`)
3. Organization primary contact email (from `organization.primary_contact_email`)

### Payment Link Creation

- Payment link created via Stripe API
- Link amount: invoice total
- Link currency: invoice currency
- Link metadata: invoice ID, invoice number
- Link stored in `payment_link` table
- Link ID stored in `invoice.payment_link_id`

### Resend Functionality

When resending:
- `resend: true` flag passed to update-invoice-status
- New payment link created (old one remains but new one is active)
- Email sent again with new payment link
- Sent timestamp updated

## Related Components

- `dashboard/components/invoicing/invoice-list.tsx` - Send button in list
- `dashboard/components/invoicing/invoice-preview-dialog.tsx` - Send from preview
- `dashboard/app/dashboard/invoicing/[id]/page.tsx` - Send from detail page
- `database/supabase/functions/update-invoice-status/index.ts` - Send logic
- `database/supabase/functions/_utils/email.ts` - Email sending

## Testing Considerations

1. **Email Sending**:
   - Test sending invoice successfully
   - Test email content (invoice number, amount, due date)
   - Test payment link inclusion
   - Test email recipient selection
   - Test multiple recipients

2. **Payment Link**:
   - Test payment link creation
   - Test payment link amount matches invoice
   - Test payment link currency matches invoice
   - Test payment link stored correctly

3. **Resend**:
   - Test resending creates new payment link
   - Test resend email includes new payment link
   - Test old payment link still works (or is invalidated)

4. **Error Handling**:
   - Test error when no email recipients
   - Test error when email sending fails
   - Test error when payment link creation fails
   - Test error messages are clear

5. **Edge Cases**:
   - Invoice with zero amount (should payment link be created?)
   - Invoice with very long notes
   - Invoice with special characters in invoice number
   - Multiple resends (should create multiple payment links?)

6. **Email Template**:
   - Test email renders correctly in different email clients
   - Test mobile email rendering
   - Test email accessibility

## Priority

**Priority**: High  
**Complexity**: Medium  
**Estimated Effort**: 2-3 days (mostly implemented, needs refinement)

## Notes

- Current implementation exists but may need improvements
- Consider adding email template customization
- Consider adding email scheduling (send at specific time)
- Consider adding email tracking (open rates, click rates)
- Future: Support for multiple email templates
- Future: Support for email attachments (PDF invoice)
- Consider adding email preview before sending

## Research References

- Email delivery is critical for invoice systems
- Payment links improve payment conversion rates
- Professional email templates build trust
- Email tracking helps with follow-up
- Resend functionality is essential for customer service
