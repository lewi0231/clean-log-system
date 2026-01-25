# User Story 002: Location-Based Field Restrictions

## Overview

Admins need to restrict certain fields to specific customer locations. This allows different locations to have different form fields, enabling location-specific data collection workflows.

## User Story

**As an** admin user  
**I want to** restrict fields to specific locations  
**So that** different locations can have different form fields based on their needs

## Acceptance Criteria

1. Admin can enable "Restrict to specific locations" toggle for a field
2. When enabled, admin sees a list of active locations
3. Admin can select multiple locations for a field
4. Location selection uses consistent UI (clickable items with check icons)
5. Selected locations are visually indicated
6. Field only appears in mobile app when worker is at a selected location
7. If no locations selected, field appears at all locations
8. Location restrictions can be configured when creating a new field
9. Location restrictions can be updated when editing an existing field
10. Visual indicator (badge) shows when a field has location restrictions
11. UI is consistent between "add field" and "edit field" dialogs

## Technical Details

### Current Implementation

- Components:
  - `dashboard/components/form-builder/field-config-dialog.tsx` (add field)
  - `dashboard/components/form-builder/section-editor.tsx` (edit field)
- Edge function: `database/supabase/functions/update-field-config-locations/index.ts`
- Database: `location_field_config` junction table

### Location Restriction Flow

1. Admin enables "Restrict to specific locations" toggle
2. System loads active locations for the organization
3. Admin selects locations from the list
4. On save, location restrictions are saved via edge function
5. Mobile app filters fields based on current location

### UI Consistency

**Modern Approach (Standardized)**:
- Clickable list items with check icons
- Hover states and visual feedback
- Consistent styling across add/edit dialogs
- Uses `Check` icon from lucide-react
- Border and background styling for selected items

**Previous Approach (Replaced)**:
- Checkbox inputs with labels
- Less visual polish
- Different styling between dialogs

## Testing Considerations

- Location restriction toggle functionality
- Multi-location selection
- Saving restrictions for new fields
- Updating restrictions for existing fields
- Mobile app field filtering by location
- Visual indicators for restricted fields
- Empty state when no locations available
- UI consistency between dialogs

## Priority

**Priority**: Medium-High  
**Complexity**: Low-Medium  
**Estimated Effort**: 1-2 days

## Notes

- Location restrictions only available if organization uses predefined locations
- If toggle is enabled but no locations selected, field appears at all locations
- Location restrictions are stored in `location_field_config` junction table
- Mobile app filters fields based on job location when rendering form

## Related Issues Fixed

- ✅ Standardized location restriction UI between add/edit dialogs
- ✅ Modern clickable list approach with check icons
- ✅ Consistent styling and behavior
