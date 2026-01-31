# Plan: Auto-Generate Invoices for Non-Location Organizations

## Overview

Currently, auto-generate invoices only works for organizations with location hierarchies. This plan extends the feature to support organizations without predefined locations (e.g., car detailers who complete jobs at customer houses).

## Current State

### Location-Based Auto-Generate

- Configured in `location_hierarchy.metadata.auto_generate_invoices`
- Only processes jobs for locations under hierarchy nodes with auto-generate enabled
- Runs on a schedule (daily/weekly/monthly)
- Groups jobs by location

### Limitations

- Organizations without location hierarchies cannot use auto-generate
- Jobs without `location_id` are not processed
- No organization-level auto-generate configuration

## Proposed Solution

### Precedence Logic

1. **Location Hierarchy Auto-Generate** (highest priority)

   - If a job has a location with hierarchy auto-generate enabled, use that
   - Existing behavior unchanged (scheduled generation)

2. **Organization-Level Immediate Auto-Generate** (fallback)
   - If enabled, automatically creates invoice immediately when job is completed
   - Only applies to jobs without location hierarchies OR jobs with locations that don't have hierarchy auto-generate
   - Configured in `organization_settings.auto_generate_invoices_immediately` (boolean)
   - Creates invoice in `pending_review` state for admin review before sending

### Configuration Structure

Add to `organization_settings` table:

```sql
ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS auto_generate_invoices_immediately BOOLEAN DEFAULT FALSE;
```

This is a simple boolean flag - when `true`, invoices are automatically generated immediately upon job completion.

### Behavior

- **When enabled**: Upon job completion (when `completed_at` is set), automatically:

  1. Create invoice with status `pending_review`
  2. Include the completed job in the invoice
  3. Calculate pricing based on job submission data
  4. Admin can then review and send the invoice

- **Invoice Status**: Always created as `pending_review` (not `draft`) to ensure admin review before sending
- **One Invoice Per Job**: Each completed job gets its own invoice (no grouping needed for immediate generation)

### Invoice Display Fields Configuration

For non-location organizations, invoice display fields should be configurable in invoice settings. The system should use:

- Job submission data fields (from `job.submission_data`)
- Organization-level default billing address (from `organization.business_address`)
- Customer information from job fields (e.g., customer name, address from form fields)

## Implementation Steps

### Phase 1: Database & Backend

1. **Migration**: Add `auto_generate_invoices_config` to `organization_settings`

   - File: `database/supabase/migrations/YYYYMMDDHHMMSS_add_org_auto_generate_invoices.sql`
   - Add JSONB column with default NULL

2. **Update `auto-generate-invoices` Edge Function**

   - After processing location hierarchy auto-generate:
     - Check for organization-level config
     - Find completed jobs without location_id OR jobs with location_id but no hierarchy auto-generate
     - Process based on organization config
     - Respect grouping option (job vs all)

3. **Update `create-invoice` Edge Function**
   - When creating invoice for non-location job:
     - Use `organization.business_address` as billing address if available
     - Use job submission data fields for customer information
     - Check invoice template config for field mappings

### Phase 2: Frontend Configuration

1. **Invoice Settings Page** (`dashboard/app/dashboard/settings/page.tsx`)

   - Add new section: "Auto-Generate Invoices"
   - Show only if organization doesn't use predefined locations OR as fallback option
   - Configuration options:
     - Enable/disable toggle
     - Period (daily/weekly/monthly)
     - Day of week/month
     - Time
     - Grouping (per job or all together)
   - Show note: "Location-specific auto-generate takes precedence"

2. **Update Onboarding Question**

   - Current: "Automatically generate invoices from completed jobs?"
   - Update description to clarify:
     - "If enabled, invoices will be automatically created from completed jobs based on your schedule."
     - "For organizations with location hierarchies, configure this per location. For others, configure in Invoice Settings."
     - "All invoices are created as drafts for your review before sending."

3. **Invoice Template Configuration**
   - Allow mapping of job submission fields to invoice display fields
   - Configure which fields appear on invoices
   - Set default billing address source (organization business_address or job fields)

### Phase 3: Edge Function Updates

1. **`auto-generate-invoices/index.ts`**

   ```typescript
   // After processing hierarchy-based auto-generate:

   // Get organizations with org-level auto-generate enabled
   const { data: orgSettings } = await supabase
     .from("organization_settings")
     .select("organization_id, auto_generate_invoices_config")
     .not("auto_generate_invoices_config", "is", null);

   for (const orgSetting of orgSettings) {
     const config = orgSetting.auto_generate_invoices_config;
     if (!config.enabled) continue;

     // Find completed jobs not covered by hierarchy auto-generate
     // Jobs without location_id OR jobs with location_id but no hierarchy config
     const uninvoicedJobs = await findUninvoicedJobs(
       orgSetting.organization_id,
       hierarchyCoveredLocationIds
     );

     // Process based on grouping
     if (config.grouping === "job") {
       // Create one invoice per job
     } else {
       // Group all jobs into one invoice
     }
   }
   ```

2. **Invoice Field Mapping**
   - Use invoice template config to map job submission fields
   - Fallback to organization business_address for billing
   - Extract customer info from job fields (name, address, etc.)

## Configuration UI Design

### Settings Page - Invoice Tab

```
┌─────────────────────────────────────────────────┐
│ Auto-Generate Invoices                          │
├─────────────────────────────────────────────────┤
│ [Enable Toggle]                                 │
│                                                  │
│ When enabled, invoices are automatically        │
│ created from completed jobs based on your       │
│ schedule. Location-specific auto-generate takes  │
│ precedence.                                      │
│                                                  │
│ Schedule:                                        │
│ [Period: Daily ▼]                               │
│ [Time: 09:00]                                   │
│ [Day of Week: Monday ▼] (if weekly)            │
│ [Day of Month: 1 ▼] (if monthly)               │
│                                                  │
│ Grouping:                                        │
│ ○ Create one invoice per job                    │
│ ● Group all jobs into one invoice              │
│                                                  │
│ Note: All invoices are created as drafts for    │
│ your review before sending.                     │
└─────────────────────────────────────────────────┘
```

## Testing Scenarios

1. **Non-Location Organization**

   - Enable org-level auto-generate
   - Complete job without location_id
   - Verify invoice created on schedule

2. **Mixed Organization**

   - Some locations have hierarchy auto-generate
   - Enable org-level auto-generate
   - Verify hierarchy takes precedence for those locations
   - Verify org-level processes remaining jobs

3. **Grouping Options**

   - Test "per job" grouping (one invoice per job)
   - Test "all" grouping (batch all jobs into one invoice)

4. **Invoice Display**
   - Verify billing address from organization.business_address
   - Verify customer info from job submission fields
   - Verify field mappings from invoice template config

## Migration Path

1. Add database column (backward compatible - defaults to NULL)
2. Update edge function to support both modes
3. Add UI configuration
4. Update onboarding flow
5. Test with existing organizations (should not break)
6. Test with new non-location organizations

## Open Questions

1. Should org-level auto-generate also process jobs WITH locations that don't have hierarchy config?
   - **Decision**: Yes, as fallback
2. How to handle customer address for non-location jobs?

   - **Decision**: Extract from job submission fields, fallback to organization business_address

3. Should we allow different grouping strategies per organization?

   - **Decision**: Yes, configurable per organization

4. How to handle invoice numbering for grouped invoices?
   - **Decision**: Use existing invoice numbering system, one number per invoice

## Related Files

- `database/supabase/functions/auto-generate-invoices/index.ts`
- `database/supabase/functions/create-invoice/index.ts`
- `dashboard/app/dashboard/settings/page.tsx`
- `dashboard/components/onboarding/onboarding-wizard.tsx`
- `database/supabase/migrations/` (new migration needed)
