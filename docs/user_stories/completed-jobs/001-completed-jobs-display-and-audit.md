# User Story 001: Completed Jobs Display and Audit Trail

## Overview

Admins need to view completed jobs with proper field display, audit trail information, and location-based field restrictions when creating/editing jobs.

## User Story

**As an** admin user  
**I want to** view completed jobs with proper field display, see who submitted each job, and have location restrictions enforced when creating/editing jobs  
**So that** I can track job completion, maintain an audit trail, and ensure location-specific fields are only available at the correct locations

## Acceptance Criteria

### Field Display

1. Boolean fields that are `true` display a checkmark icon (✓) instead of text
2. Boolean fields that are `false` display a dash (-) instead of text
3. Fields that don't exist in a job's submission_data show "N/A" in italic, muted text
4. All other field types display their values appropriately (dates, numbers, text, etc.)

### Audit Trail

5. Each completed job displays who submitted it (submitted_by_email) in a "Submitted By" column
6. Jobs created via the dashboard show the admin user's email who created it
7. Jobs created via the mobile app show "-" (no submitted_by_email)
8. The "Submitted By" column appears between the dynamic fields and "Completed At" column

### Location Restrictions

9. When creating a new job, fields are filtered based on the selected location
10. When editing an existing job, fields are filtered based on the selected location
11. Fields with location restrictions only appear when the selected location matches the restriction
12. Fields without location restrictions appear for all locations
13. When location is changed in create/edit dialogs, the field list updates to reflect the new location's restrictions

## Technical Details

### Current Implementation

- Components:
  - `dashboard/components/completed-jobs/completed-jobs-list.tsx` - Main list display
  - `dashboard/components/completed-jobs/create-job-dialog.tsx` - Create job dialog
  - `dashboard/components/completed-jobs/edit-job-dialog.tsx` - Edit job dialog
- Database:
  - `job.submitted_by_email` - Tracks who created the job (TEXT, nullable)
  - `location_field_config` - Junction table for field location restrictions
- Edge Functions:
  - `list-jobs` - Returns jobs with submitted_by_email
  - `admin-create-job` - Stores submitted_by_email when creating jobs
  - `list-field-configs` - Filters fields based on location_id parameter

### Field Display Logic

- Boolean `true`: `<CheckCircle2 className="h-4 w-4 text-green-600" />`
- Boolean `false`: `<span className="text-muted-foreground">-</span>`
- Field not present: `<span className="text-muted-foreground italic text-xs">N/A</span>`

### Location Restriction Flow

1. User selects/changes location in create/edit dialog
2. `useFieldConfigs` hook is called with `locationId` parameter
3. `FieldConfigsService.list()` passes `location_id` to `list-field-configs` edge function
4. Edge function filters fields:
   - Fields with no location restrictions: shown for all locations
   - Fields with location restrictions: only shown if location_id matches
5. Dialog updates to show only relevant fields for selected location

## Related User Stories

- [Mobile Config 002: Location-Based Field Restrictions](../mobile-config/002-location-based-field-restrictions.md) - Defines how location restrictions are configured
