# Unified Invoice Sending System

## Overview

This document describes the unified invoice sending system that supports multiple sending strategies:

1. **Immediate sending** - Invoices sent immediately upon creation
2. **Location hierarchy auto-send** - Scheduled sending based on location hierarchy configuration
3. **Organization-level auto-send** - Scheduled sending for organizations without location hierarchies

## Precedence Logic

The system follows this precedence order (highest to lowest):

1. **Location Hierarchy Auto-Send** (if enabled)

   - If any job's location belongs to a hierarchy node with auto-send enabled, the invoice is created as `draft` and sent on the scheduled time
   - This overrides `invoice_send_immediately` setting

2. **Organization `invoice_send_immediately` Setting**

   - If `true` and no hierarchy auto-send applies, invoice is created with status `sent`
   - If `false`, invoice is created as `draft`

3. **Organization-Level Auto-Send** (if enabled)
   - Applies to invoices not covered by hierarchy auto-send
   - Sends draft invoices on a scheduled basis

## Configuration

### 1. Immediate Sending (`invoice_send_immediately`)

**Location:** `organization.invoice_send_immediately` (boolean)

**Usage:** Payment & Billing settings in dashboard

**Behavior:**

- `true`: Invoices are created with status `sent` (unless overridden by hierarchy auto-send)
- `false`: Invoices are created with status `draft`

### 2. Location Hierarchy Auto-Send

**Location:** `location_hierarchy.metadata.auto_send_invoices` (JSONB)

**Structure:**

```json
{
  "auto_send_invoices": {
    "enabled": true,
    "period": "daily" | "weekly" | "monthly",
    "day_of_week": 0-6,  // Optional, for weekly (0=Sunday, 6=Saturday)
    "day_of_month": 1-31, // Optional, for monthly
    "time": "HH:mm"       // Optional, default "09:00"
  }
}
```

**Use Case:** Organizations with location hierarchies (e.g., companies with multiple regions/locations)

**Behavior:**

- When enabled on a hierarchy node, all locations under that node have their invoices sent on schedule
- Takes precedence over `invoice_send_immediately`
- Configured per hierarchy node, allowing different schedules for different regions

### 3. Organization-Level Auto-Send

**Location:** `organization_settings.auto_send_invoices_config` (JSONB)

**Structure:**

```json
{
  "enabled": true,
  "period": "daily" | "weekly" | "monthly",
  "day_of_week": 0-6,  // Optional, for weekly
  "day_of_month": 1-31, // Optional, for monthly
  "time": "HH:mm"       // Optional, default "09:00"
}
```

**Use Case:** Organizations without location hierarchies or for invoices not covered by hierarchy auto-send

**Behavior:**

- Applies to all draft invoices not covered by hierarchy auto-send
- Useful for direct customer relationships where location hierarchy isn't relevant

## Implementation Details

### Invoice Creation (`create-invoice` function)

1. Checks `organization.invoice_send_immediately`
2. If `true`, checks if any job locations belong to a hierarchy with auto-send enabled
3. If hierarchy auto-send exists, creates invoice as `draft` (defer to scheduled send)
4. Otherwise, creates invoice with status based on `invoice_send_immediately`

### Auto-Send Processing (`auto-send-invoices` function)

Runs on a schedule (e.g., hourly via Supabase cron):

1. **Processes hierarchy-based auto-send:**

   - Finds hierarchy nodes with auto-send enabled that should run now
   - Gets locations under those nodes
   - Sends draft invoices for those locations

2. **Processes organization-level auto-send:**

   - Checks organization settings for auto-send config
   - Sends draft invoices not covered by hierarchy auto-send

3. **Precedence:**
   - Hierarchy auto-send takes precedence
   - Organization-level auto-send only processes invoices not already covered

## Use Cases

### Use Case 1: Direct Customer Relationships

- **Setup:** Enable `invoice_send_immediately = true`
- **Result:** All invoices sent immediately upon creation

### Use Case 2: Company Contracts with Scheduled Billing

- **Setup:** Configure location hierarchy auto-send for company nodes
- **Result:** Invoices for that company's locations are sent on schedule (e.g., monthly on 1st)

### Use Case 3: Mixed Approach

- **Setup:**
  - Some locations have hierarchy auto-send (monthly billing)
  - Organization has `invoice_send_immediately = true` for others
- **Result:**
  - Hierarchy locations: sent on schedule
  - Other locations: sent immediately

### Use Case 4: Non-Hierarchy Organizations with Scheduled Sending

- **Setup:** Configure organization-level auto-send
- **Result:** All draft invoices sent on schedule

## Migration Notes

- Migration `20251209000001_add_org_level_auto_send_invoice_config.sql` adds organization-level auto-send config
- Existing `invoice_send_immediately` setting is now fully implemented
- Location hierarchy auto-send remains unchanged but now works in conjunction with other settings

## Future Enhancements

- Email sending when invoices are marked as `sent` (currently TODO)
- Per-location override of organization settings
- More granular scheduling options
- Invoice sending analytics and reporting
