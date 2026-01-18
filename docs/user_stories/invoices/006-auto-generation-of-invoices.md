# User Story 006: Auto-Generation of Invoices

## Overview

The system should automatically generate invoices for completed jobs based on configured schedules. This reduces manual work and ensures timely invoicing.

## User Story

**As an** admin user  
**I want to** configure automatic invoice generation for completed jobs  
**So that** invoices are created automatically on a schedule without manual intervention

## Acceptance Criteria

1. Admin can enable/disable auto-generation at organization or location hierarchy level
2. Auto-generation configuration includes:
   - Enable/disable toggle
   - Schedule period (daily, weekly, monthly)
   - Day of week (for weekly: 0-6, Sunday-Saturday)
   - Day of month (for monthly: 1-31)
   - Time of day (HH:mm format, e.g., "09:00")
   - Grouping method (by location, all jobs together)
3. System runs auto-generation on schedule:
   - Daily: At specified time every day
   - Weekly: On specified day of week at specified time
   - Monthly: On specified day of month at specified time
4. Auto-generation process:
   - Finds all completed, uninvoiced jobs
   - Groups jobs according to configuration (by location or all together)
   - Creates invoices for each group
   - Sets invoice status to "pending_review" (requires admin approval)
   - Generates invoice numbers
   - Calculates invoice totals
   - Sets due dates based on organization default
5. Admin receives notification when invoices are auto-generated:
   - Email notification with invoice count
   - Dashboard notification
   - List of generated invoice numbers
6. Auto-generated invoices are clearly marked:
   - Status: "pending_review"
   - Visual indicator in invoice list
   - Can filter by auto-generated invoices
7. System handles edge cases:
   - No completed jobs (no invoices created, no error)
   - All jobs already invoiced (no invoices created, no error)
   - Jobs from different locations (grouping handled correctly)
   - Jobs with missing pricing rules (error logged, job skipped)
8. Auto-generation respects job completion:
   - Only includes completed jobs
   - Only includes jobs not already invoiced
   - Respects job completion date
9. Configuration is stored in location hierarchy metadata:
   - `auto_generate_invoices.enabled`
   - `auto_generate_invoices.period`
   - `auto_generate_invoices.day_of_week`
   - `auto_generate_invoices.day_of_month`
   - `auto_generate_invoices.time`
   - `auto_generate_invoices.grouping`
10. Admin can view auto-generation history:
   - When last run
   - How many invoices created
   - Any errors encountered

## Technical Details

### Current Implementation

- Edge function: `database/supabase/functions/auto-generate-invoices/index.ts`
- Auto-invoice utility: `database/supabase/functions/_utils/auto-invoice.ts`
- Configuration: Stored in `location_hierarchy.metadata.auto_generate_invoices`
- Cron job: Runs auto-generation function on schedule

### Auto-Generation Schedule

**Daily**:
- Runs every day at specified time
- Example: Every day at 9:00 AM

**Weekly**:
- Runs on specified day of week at specified time
- Example: Every Monday at 9:00 AM

**Monthly**:
- Runs on specified day of month at specified time
- Example: 1st of every month at 9:00 AM

### Grouping Methods

**By Location**:
- Groups jobs by `location_id`
- Creates one invoice per location
- All jobs for a location in one invoice

**All Together**:
- Groups all jobs into one invoice
- Creates single invoice for all completed jobs

### Invoice Creation

Auto-generated invoices:
- Status: `pending_review` (always, not configurable)
- Require admin approval before sending
- Use same calculation logic as manual invoices
- Generate invoice numbers using same format
- Set due dates using organization default

### Configuration Storage

Configuration stored in `location_hierarchy.metadata`:
```json
{
  "auto_generate_invoices": {
    "enabled": true,
    "period": "weekly",
    "day_of_week": 1,
    "time": "09:00",
    "grouping": "location",
    "require_review": true
  }
}
```

## Related Components

- `database/supabase/functions/auto-generate-invoices/index.ts` - Main function
- `database/supabase/functions/_utils/auto-invoice.ts` - Utility functions
- `dashboard/components/settings/invoice-template-settings.tsx` - Configuration UI (future)

## Testing Considerations

1. **Schedule Execution**:
   - Test daily schedule
   - Test weekly schedule
   - Test monthly schedule
   - Test time of day execution
   - Test day of week execution
   - Test day of month execution

2. **Job Grouping**:
   - Test grouping by location
   - Test grouping all together
   - Test with jobs from multiple locations
   - Test with single job

3. **Invoice Creation**:
   - Test invoice creation for each group
   - Test invoice status is pending_review
   - Test invoice numbers generated correctly
   - Test invoice totals calculated correctly

4. **Edge Cases**:
   - No completed jobs
   - All jobs already invoiced
   - Jobs with missing pricing rules
   - Jobs with errors in calculation
   - Concurrent auto-generation runs

5. **Notifications**:
   - Test admin notification on generation
   - Test notification includes invoice count
   - Test notification includes invoice numbers

## Priority

**Priority**: Medium-High  
**Complexity**: High  
**Estimated Effort**: 4-5 days

## Notes

- Current implementation exists but may need improvements
- Consider adding UI for configuration (currently in metadata)
- Consider adding manual trigger for testing
- Consider adding dry-run mode (preview without creating)
- Future: Support for multiple schedules per organization
- Future: Support for custom grouping rules
- Consider adding auto-generation logs/audit trail

## Research References

- Auto-generation reduces manual work significantly
- Scheduled invoicing improves cash flow
- Approval workflow ensures accuracy
- Grouping by location is common for field service businesses
- Notifications help admins stay informed
