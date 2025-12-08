# Phase 1 Implementation Status

## ✅ Completed Components

### 1. Database Schema

- ✅ Migration created: `20251207000001_add_bill_to_address_config.sql`
- ✅ Added `service_address_config` JSONB column with defaults
- ✅ Added `billing_address_config` JSONB column with defaults
- ✅ Added appropriate comments

### 2. TypeScript Types

- ✅ Added `ServiceAddressConfig` interface
- ✅ Added `BillingAddressConfig` interface
- ✅ Updated `InvoiceTemplateConfig` to include new config fields

### 3. Backend Functions

- ✅ Updated `update-invoice-template-config` to handle new fields with validation
- ✅ Updated `get-invoice-template-config` to return new fields with defaults
- ✅ Updated `get-invoice-details` to:
  - Include new config fields
  - Fetch `hierarchy_parent_id` from locations
  - Fetch location hierarchy metadata for billing detection
  - Return `hierarchy_metadata` in response

### 4. Frontend Services & Hooks

- ✅ Updated `InvoiceTemplateService` types to include new fields
- ✅ Updated `useInvoiceTemplateConfig` hook to pass new fields
- ✅ Updated service interface types

### 5. Settings UI

- ✅ Added Service Address Configuration card with:
  - Source selection (auto/location/form_fields)
  - Location field checkboxes (name, address, contact_person, email, phone)
- ✅ Added Billing Address Configuration card with:
  - Toggle to enable/disable billing address
  - Source selection (auto/hierarchy/organization)
  - Helpful descriptions

## 🔄 Remaining Work

### Invoice Preview Component

The invoice preview component needs to be updated to:

1. Read the new configuration from `template_config`
2. Determine service address source (auto/location/form_fields)
3. Render location fields based on `service_address_config.location_fields`
4. Check for billing address from hierarchy metadata
5. Display both service and billing addresses appropriately

**Key logic needed:**

```typescript
// Service Address Logic:
const serviceConfig = template_config?.service_address_config || {
  source: "auto",
  location_fields: ["name", "address", "contact_person", "email", "phone"],
};

const primaryLocation = invoice.invoice_job?.[0]?.job?.location;
const hasLocation = !!primaryLocation?.id;

// Determine source
let serviceAddressSource = serviceConfig.source;
if (serviceAddressSource === "auto") {
  serviceAddressSource = hasLocation ? "location" : "form_fields";
}

// Render based on source
if (serviceAddressSource === "location" && primaryLocation) {
  // Show configured location fields
  const fieldsToShow = serviceConfig.location_fields || [];
  // Render only selected fields
} else {
  // Use form fields from submission_data
}

// Billing Address Logic:
const billingConfig = template_config?.billing_address_config || {
  enabled: false,
  source: "auto",
};

if (billingConfig.enabled) {
  const hierarchyMetadata = invoice.hierarchy_metadata; // From get-invoice-details
  const hierarchyParentId = primaryLocation?.hierarchy_parent_id;

  if (hierarchyParentId && hierarchyMetadata?.[hierarchyParentId]) {
    const hierarchyNode = hierarchyMetadata[hierarchyParentId];
    if (
      hierarchyNode.type === "company" &&
      hierarchyNode.metadata?.billing_address
    ) {
      // Render billing address from hierarchy metadata
    }
  }
}
```

## Next Steps

1. Update invoice preview component interface to include:

   - `service_address_config` and `billing_address_config` in template_config type
   - `hierarchy_metadata` in invoice type

2. Implement service address rendering logic

3. Implement billing address rendering logic with hierarchy metadata detection

4. Test with various scenarios:
   - Jobs with predefined locations
   - Jobs with dynamic address fields
   - Jobs with locations in company hierarchy
   - Jobs without locations

## Files Modified

- ✅ `database/supabase/migrations/20251207000001_add_bill_to_address_config.sql`
- ✅ `dashboard/lib/types.ts`
- ✅ `dashboard/components/settings/invoice-template-settings.tsx`
- ✅ `dashboard/hooks/use-invoice-template-config.ts`
- ✅ `dashboard/lib/services/invoice-template.service.ts`
- ✅ `database/supabase/functions/update-invoice-template-config/index.ts`
- ✅ `database/supabase/functions/get-invoice-template-config/index.ts`
- ✅ `database/supabase/functions/get-invoice-details/index.ts`
- 🔄 `dashboard/components/invoicing/invoice-preview.tsx` (interface updated, rendering logic needed)
