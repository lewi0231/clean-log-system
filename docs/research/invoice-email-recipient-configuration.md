# Invoice Email Recipient Configuration

## Overview

This document describes the invoice email recipient configuration system that determines where invoice emails should be sent when invoices are automatically sent to customers.

## Configuration Structure

The email recipient configuration is stored in `invoice_template_config.email_recipient_config` as JSONB:

```typescript
interface InvoiceEmailRecipientConfig {
  location_email_source:
    | "location_email"
    | "hierarchy_billing_email"
    | "location_contact_email";
  form_field_email: string | null; // Field config ID that contains email for jobs without location
  default_email: string | null; // Organization default email for invoices (fallback)
}
```

## Email Recipient Precedence Logic

The system follows this precedence order when determining invoice email recipients:

### For Jobs with Locations:

1. **Hierarchy Billing Email** (if `location_email_source === "hierarchy_billing_email"`)

   - Checks if location belongs to a hierarchy node (company/region)
   - If hierarchy node has `metadata.billing_address.email`, use that
   - Falls back to next option if not available

2. **Location Email** (if `location_email_source === "location_email"` - default)

   - Uses `location.email` field
   - This is the default behavior

3. **Location Contact Email** (if `location_email_source === "location_contact_email"`)

   - Currently not implemented (would require `location.contact_email` field)
   - Reserved for future use

4. **Default Email** (fallback)
   - Uses `default_email` from config if set
   - If no default email, returns `null` (invoice won't be auto-sent)

### For Jobs without Locations:

1. **Form Field Email** (if `form_field_email` is configured)

   - Looks up the field config by ID
   - Extracts email from `submission_data[field_config.name]`
   - Validates that the value contains "@" and "."
   - Falls back to next option if not found or invalid

2. **Default Email** (fallback)
   - Uses `default_email` from config if set
   - If no default email, returns `null` (invoice won't be auto-sent)

## Configuration UI

The email recipient configuration is available in **Settings > Invoice Template**:

1. **Location Email Source**: Radio buttons to select which email source to use for jobs with locations
2. **Form Field for Email**: Dropdown to select which form field contains email addresses for jobs without locations
3. **Default Email**: Text input for fallback email address

## Implementation Details

### Utility Function

The email recipient logic is implemented in `database/supabase/functions/_utils/invoice-email.ts`:

- `getInvoiceEmailRecipient()`: Determines email for a single job
- `getInvoiceEmailRecipients()`: Determines unique emails for multiple jobs (used for invoices with multiple jobs)

### Auto-Send Integration

The `auto-send-invoices` function:

1. Fetches invoice template config to get email recipient configuration
2. For each invoice, builds job contexts from invoice jobs
3. Uses `getInvoiceEmailRecipients()` to determine email addresses
4. Logs the recipients (email sending implementation is TODO)

### Database Migration

Migration `20251209000002_add_invoice_email_recipient_config.sql`:

- Adds `email_recipient_config` column to `invoice_template_config`
- Sets default values for existing rows

## Use Cases

### Use Case 1: Standard Location-Based Invoicing

- **Setup**: `location_email_source = "location_email"`
- **Result**: Invoices sent to `location.email` for all jobs with locations

### Use Case 2: Company Centralized Billing

- **Setup**: `location_email_source = "hierarchy_billing_email"`
- **Result**: Invoices sent to company billing email from hierarchy metadata (if available), falls back to location email

### Use Case 3: Dynamic Jobs Without Locations

- **Setup**: `form_field_email = "customer_email_field_id"` (field config ID)
- **Result**: For jobs without locations, extracts email from the specified form field in submission_data

### Use Case 4: Mixed Approach with Fallback

- **Setup**:
  - `location_email_source = "location_email"`
  - `form_field_email = "customer_email"`
  - `default_email = "billing@company.com"`
- **Result**:
  - Location jobs → use location.email
  - Non-location jobs → use form field email
  - If neither available → use default email

## Future Enhancements

- Implement `location_contact_email` source (requires schema change)
- Add email validation and verification
- Support multiple email recipients per invoice
- Add email sending implementation (currently TODO)
- Add email delivery tracking and bounce handling
