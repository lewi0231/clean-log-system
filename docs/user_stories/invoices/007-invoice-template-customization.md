# User Story 007: Invoice Template Customization

## Overview

Admins need to customize invoice appearance including branding, layout, and information display. This ensures invoices match company branding and meet business requirements.

## User Story

**As an** admin user  
**I want to** customize invoice templates with branding and layout options  
**So that** invoices match my company's branding and display information in the format I need

## Acceptance Criteria

1. Admin can access invoice template settings in Settings section
2. Invoice header customization:
   - Invoice title (default: "TAX INVOICE")
   - Show/hide company logo
   - Show/hide ABN/tax ID
   - Logo upload and preview
3. Bill to section customization:
   - Select which location fields to display
   - Fields: name, address, contact person, email, phone
   - Custom field order
   - Show/hide specific fields
4. Service address configuration:
   - Source selection: auto (from location), location fields, form fields
   - Field selection for location-based display
   - Field selection for form-based display
5. Billing address configuration:
   - Enable/disable billing address section
   - Source selection: auto (from location), hierarchy parent
   - Display hierarchy parent address if different from service address
6. Line item display customization:
   - Include/exclude option values in descriptions
   - Description format (e.g., "{field_label}: {option_value}")
   - Show/hide base price separately
   - Customize column headers
7. Email recipient configuration:
   - Primary recipient source (location email, hierarchy email, custom)
   - Additional recipient emails
   - CC/BCC options (future)
8. Template preview:
   - Live preview of invoice with current settings
   - Preview updates as settings change
   - Preview uses sample data
9. Settings are saved per organization:
   - Stored in `invoice_template_config` table
   - Applied to all invoices for organization
   - Can be overridden per invoice (future)
10. Default values provided:
   - Sensible defaults for all settings
   - Migration from old format (if exists)
   - Backward compatibility

## Technical Details

### Current Implementation

- Component: `dashboard/components/settings/invoice-template-settings.tsx`
- Service: `dashboard/lib/services/invoice-template.service.ts`
- Edge function: `database/supabase/functions/get-invoice-details/index.ts` (returns template config)
- Database: `invoice_template_config` table
- Defaults: `dashboard/lib/constants/invoice-template-defaults.ts`

### Template Configuration Structure

```typescript
interface InvoiceTemplateConfig {
  invoice_title?: string;
  show_logo?: boolean;
  show_abn?: boolean;
  bill_to_fields?: string[];
  service_address_config?: {
    source: "auto" | "location" | "form_fields";
    location_fields?: string[];
    form_fields?: string[];
  };
  billing_address_config?: {
    enabled: boolean;
    source: "auto" | "hierarchy";
  };
  line_item_display?: {
    include_option_value?: boolean;
    description_format?: string;
    show_base_price_separately?: boolean;
  };
  email_recipient_config?: {
    primary_source: "location" | "hierarchy" | "custom";
    additional_emails?: string[];
  };
}
```

### Default Configuration

```typescript
const DEFAULT_CONFIG = {
  invoice_title: "Tax Invoice",
  show_logo: true,
  show_abn: true,
  bill_to_fields: ["name", "address", "contact_person", "email", "phone"],
  service_address_config: {
    source: "auto",
    location_fields: ["name", "address", "contact_person", "email", "phone"],
  },
  billing_address_config: {
    enabled: false,
    source: "auto",
  },
  line_item_display: {
    include_option_value: true,
    description_format: "{field_label}: {option_value}",
    show_base_price_separately: true,
  },
};
```

### Template Application

- Template config fetched when displaying invoice
- Config applied to invoice preview and detail views
- Config stored in `invoice_template_config` table per organization
- Config merged with defaults if missing values

## Related Components

- `dashboard/components/settings/invoice-template-settings.tsx` - Main settings component
- `dashboard/components/settings/invoice-template/InvoiceHeaderSettings.tsx` - Header settings
- `dashboard/components/invoicing/invoice-preview.tsx` - Preview component
- `dashboard/lib/services/invoice-template.service.ts` - Template service

## Testing Considerations

1. **Settings Save/Load**:
   - Test saving template settings
   - Test loading template settings
   - Test default values when no config exists
   - Test migration from old format

2. **Template Application**:
   - Test invoice preview uses template config
   - Test invoice detail view uses template config
   - Test public invoice view uses template config
   - Test all template options are applied

3. **Preview**:
   - Test live preview updates
   - Test preview with different settings
   - Test preview with sample data

4. **Edge Cases**:
   - Missing template config (should use defaults)
   - Invalid template config (should use defaults)
   - Logo upload failure
   - Very long invoice title
   - Missing bill to fields

5. **Validation**:
   - Test field selection validation
   - Test format string validation
   - Test email validation

## Priority

**Priority**: Medium  
**Complexity**: Medium  
**Estimated Effort**: 3-4 days (mostly implemented, needs refinement)

## Notes

- Current implementation exists but may need UX improvements
- Consider adding template presets (professional, simple, detailed)
- Consider adding per-invoice template override
- Future: Multiple template options (select template per invoice)
- Future: Custom CSS/styling options
- Consider adding template export/import

## Research References

- Invoice customization is important for branding
- Users expect flexible template options
- Preview functionality improves UX
- Default values reduce setup time
- Template consistency improves professionalism
