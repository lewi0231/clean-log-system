# User Story 001: Invoice Creation and Calculation

## Overview

Admins need to create invoices for completed jobs with accurate pricing calculations based on configured pricing rules. The system should calculate line items, apply pricing rules, and generate invoice totals automatically.

## User Story

**As an** admin user  
**I want to** create invoices for completed jobs with automatic pricing calculations  
**So that** I can accurately bill customers based on the work completed and configured pricing rules

## Implementation Status

| Status | Feature |
|--------|---------|
| ✅ | Job selection for invoice creation |
| ✅ | Duplicate invoice prevention |
| ✅ | Automatic pricing calculation |
| ✅ | Line item generation |
| ✅ | Subtotal/adjustments/total calculation |
| ✅ | Invoice number generation |
| ✅ | Due date configuration |
| ✅ | Invoice notes |
| ✅ | Currency support |
| ✅ | Validation |

**Overall: ~95% Complete**

## Acceptance Criteria

### Core Features (Implemented)

1. Admin can select one or more completed jobs to include in an invoice
2. System prevents creating invoices for jobs that are already invoiced
3. System calculates invoice totals automatically using pricing rules:
   - Line items based on field values and quantities
   - Unit pricing, fixed pricing, tiered pricing, percentage pricing
   - Location-based pricing rules
   - Hierarchy-based pricing rules
   - Conditional pricing rules
4. Calculation includes:
   - Subtotal (sum of all line items)
   - Total adjustments (discounts, surcharges)
   - Total amount
   - Worker payment total (for reference)
   - Margin calculation
5. Admin can preview calculation before creating invoice
6. Admin can set due date (defaults to organization's default due days)
7. Admin can add notes to invoice (optional)
8. System generates unique invoice number (format: ORGCODE-YYYY-####)
9. Invoice is created with status "draft" (manual) or "pending_review" (auto-generated)
10. Invoice currency matches organization currency
11. System validates that all required data is present

## Technical Details

### Current Implementation

- Edge function: `database/supabase/functions/create-invoice/index.ts`
- Calculation function: `database/supabase/functions/calculate-invoice/index.ts`
- Service: `dashboard/lib/services/invoice.service.ts`
- Validation: `database/supabase/functions/_utils/zod-schemas.ts` (createInvoiceSchema)

### Invoice Creation Flow

1. **Job Selection**: Admin selects jobs from completed jobs list
2. **Validation**: System checks:
   - Jobs belong to organization
   - Jobs are not already invoiced
   - Jobs are completed
3. **Calculation**: System calls `calculate-invoice` function:
   - Fetches job data, pricing rules, field configs
   - Applies pricing rules per job
   - Calculates totals and margins
4. **Invoice Creation**: System creates invoice record:
   - Generates invoice number
   - Sets due date (default or custom)
   - Links jobs via `invoice_job` table
   - Stores calculation data for reference

### Invoice Number Format

Format: `{ORG_CODE}-{YEAR}-{SEQUENCE}`

Example: `ABC-2025-0001`, `ABC-2025-0002`

- ORG_CODE: Organization code from `organization.org_code`
- YEAR: Current year (4 digits)
- SEQUENCE: Sequential number, padded to 4 digits, resets each year

### Pricing Rule Application

The system applies pricing rules in this order:
1. Fixed price locations (highest precedence)
2. Service-specific pricing modes
3. Field-based pricing rules
4. Conditional rules (discounts, surcharges)

### Database Schema

- `invoice` table: Main invoice record
- `invoice_job` table: Links invoices to jobs (many-to-many)
- Calculation data stored in `invoice` record for audit trail

## Related Components

- `dashboard/components/completed-jobs/completed-jobs-list.tsx` - Job selection
- `dashboard/components/completed-jobs/job-detail-dialog.tsx` - Job details
- `database/supabase/functions/create-invoice/index.ts` - Creation logic
- `database/supabase/functions/calculate-invoice/index.ts` - Calculation logic

## Testing Considerations

1. **Calculation Accuracy**:
   - Test with different pricing rule types (unit, fixed, tiered, percentage)
   - Test with location-based rules
   - Test with hierarchy-based rules
   - Test with conditional rules (discounts, surcharges)
   - Test with multiple jobs in one invoice

2. **Validation**:
   - Test preventing duplicate invoicing
   - Test with incomplete jobs (should error)
   - Test with jobs from different organizations (should error)
   - Test with missing pricing rules (should handle gracefully)

3. **Invoice Number Generation**:
   - Test sequential numbering
   - Test year rollover
   - Test with multiple organizations (separate sequences)

4. **Edge Cases**:
   - Zero-amount invoices (should be allowed)
   - Multiple jobs in one invoice (10+ jobs)
   - Jobs with missing field data
   - Concurrent invoice creation

## Priority

**Priority**: High  
**Complexity**: High  
**Status**: ✅ Complete

## Notes

- Current implementation is functional but may need UX improvements
- Consider adding "bulk invoice creation" for multiple jobs at once
- Invoice preview before creation would improve UX
- Consider allowing editing of calculated amounts (with audit trail)
- Future: Support for partial invoicing (invoice part of a job)

## Research References

- Invoice creation should be fast and accurate
- Users expect automatic calculations to reduce errors
- Preview before creation is standard practice
- Unique invoice numbers are required for accounting compliance
- Validation prevents duplicate invoicing and errors
