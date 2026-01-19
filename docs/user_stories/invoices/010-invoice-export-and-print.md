# User Story 010: Invoice Export and Print

## Overview

Admins and customers need to export and print invoices for record-keeping, accounting, and customer records. The system should support PDF generation and print-friendly formats.

## User Story

**As an** admin user or customer  
**I want to** export and print invoices in professional formats  
**So that** I can keep records, send to accounting, and provide customers with physical copies

## Implementation Status

| Status | Feature |
|--------|---------|
| ✅ | Browser print functionality |
| ✅ | Print-friendly layout |
| ⬜ | Print styles optimization |
| ⬜ | Server-side PDF generation |
| ⬜ | PDF download button |
| ⬜ | CSV export for invoice list |

**Overall: ~40% Complete**

## Acceptance Criteria

### Print Functionality (Implemented)

1. Admin and customers can print invoices:
   - Print button in invoice detail view
   - Print button in invoice preview dialog
   - Print opens browser print dialog
   - Print layout is optimized for printing
2. Print layout includes:
   - All invoice information
   - Professional formatting
   - Page breaks where appropriate
   - Header/footer (optional)
   - Print-friendly colors (black/white)
3. Print styles:
   - Hide navigation and action buttons
   - Show only invoice content
   - Optimize for A4/Letter paper size
   - Proper margins and spacing

### PDF Export (To Be Implemented)

4. Admin can download invoice as PDF:
   - Download button in invoice detail view
   - Generates PDF file with invoice content
   - PDF filename: `Invoice-[INVOICE_NUMBER].pdf`
   - PDF includes all invoice information
5. PDF generation:
   - Uses same layout as print view
   - Professional PDF formatting
   - Includes company logo and branding
   - Suitable for email attachment
6. Bulk PDF export (future):
   - Select multiple invoices
   - Download as ZIP file
   - Each invoice as separate PDF

### Export Options

7. CSV export for invoice list:
   - Export filtered invoice list
   - Includes: invoice number, date, amount, status, customer
   - Suitable for spreadsheet analysis
8. Excel export (future):
   - Export invoice list with formatting
   - Include calculations and totals
   - Suitable for accounting software import

## Technical Details

### Current Implementation

- Print: Browser print functionality via `window.print()`
- Print styles: CSS `@media print` rules
- Components: `dashboard/app/invoice/[id]/page.tsx`, `dashboard/components/invoicing/invoice-preview-dialog.tsx`

### Print Implementation

```typescript
const handlePrint = () => {
  window.print();
};
```

Print styles hide non-essential elements:
```css
@media print {
  .print\\:hidden {
    display: none !important;
  }
  /* Show only invoice content */
}
```

### PDF Generation (Future)

Options for PDF generation:
1. **Browser Print to PDF**: Current approach (user prints to PDF)
2. **Server-side PDF**: Generate PDF on server (e.g., Puppeteer, PDFKit)
3. **Client-side PDF**: Generate PDF in browser (e.g., jsPDF, pdfmake)

**Recommendation**: Start with browser print to PDF, add server-side PDF generation later for better control and email attachments.

### Export Formats

**CSV Export**:
- Invoice list data
- Comma-separated values
- Headers: Invoice Number, Date, Due Date, Amount, Status, Customer

**PDF Export** (future):
- Single invoice per PDF
- Professional layout
- Includes all invoice details
- Suitable for email/archiving

## Related Components

- `dashboard/app/invoice/[id]/page.tsx` - Print functionality
- `dashboard/components/invoicing/invoice-preview-dialog.tsx` - Print from preview
- `dashboard/components/invoicing/invoice-list.tsx` - Export list (future)

## Testing Considerations

1. **Print**:
   - Test print dialog opens
   - Test print layout is correct
   - Test all invoice information prints
   - Test print on different browsers
   - Test print on different paper sizes

2. **Print Styles**:
   - Test non-essential elements hidden
   - Test invoice content visible
   - Test page breaks work correctly
   - Test margins and spacing

3. **PDF Export** (future):
   - Test PDF generation
   - Test PDF content matches invoice
   - Test PDF file download
   - Test PDF filename

4. **Edge Cases**:
   - Very long invoices (multiple pages)
   - Invoices with many line items
   - Invoices with images/logo
   - Invoices with special characters

## Priority

**Priority**: Medium  
**Complexity**: Medium  
**Status**: ⚠️ Enhancements Needed

## Dependencies

- Invoice preview component (✅ exists)
- Edge function infrastructure (✅ exists)

## Implementation Tasks

### Phase 1: Print Improvements

1. **Print Styles Enhancement**
   - Review and improve `@media print` CSS rules
   - Ensure proper page breaks for multi-page invoices
   - Hide all navigation and action buttons
   - Optimize for A4/Letter paper sizes

### Phase 2: PDF Generation

2. **Server-side PDF Generation** (Recommended approach)
   - Create edge function `generate-invoice-pdf/index.ts`
   - Use Puppeteer or similar for PDF rendering
   - Generate from invoice HTML template
   - Return PDF as downloadable file

3. **PDF Download Button**
   - Add "Download PDF" button to invoice detail view
   - Show loading state during generation
   - Trigger download on completion

4. **Email PDF Attachment** (depends on PDF generation)
   - Optionally attach PDF to invoice emails
   - Configuration option in template settings

### Phase 3: List Export (Future)

5. **CSV Export for Invoice List**
   - Export filtered invoice list to CSV
   - Include: invoice number, date, amount, status, customer
   - Useful for accounting software import

## Notes

- Browser print works but PDF generation is highly requested
- **Priority: MEDIUM** - Important for professional workflows
- Server-side PDF recommended over client-side for consistency
- **Future enhancements:**
  - Batch PDF generation for multiple invoices
  - Custom PDF templates
  - Excel export with formatting

## Research References

- Print functionality is standard in all invoicing systems
- PDF export is expected feature
- Professional formatting improves brand perception
- Export options support accounting integration
- Print-friendly layouts are important for physical records
