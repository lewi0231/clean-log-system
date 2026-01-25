# User Story 005: Field Editing and Updates

## Overview

Admins need to edit existing field configurations, including updating labels, types, options, location restrictions, and section assignments. The editing experience should be consistent and intuitive.

## User Story

**As an** admin user  
**I want to** edit existing field configurations  
**So that** I can update fields as business needs change without recreating them

## Acceptance Criteria

1. Admin can open field settings via gear icon on any field
2. Admin can update field label
3. Admin can update field description/placeholder
4. Admin can change field type (with appropriate validation)
5. Admin can update options for select/grouped_breakdown fields
6. Admin can toggle required status
7. Admin can update location restrictions
8. Admin can change section assignment
9. Admin can configure mutually exclusive clusters
10. Admin can set up conditional logic
11. Changes are saved when popover closes
12. UI is consistent with field creation dialog
13. Location restriction UI matches add field dialog

## Technical Details

### Current Implementation

- Component: `dashboard/components/form-builder/section-editor.tsx` (Popover with field settings)
- Hook: `dashboard/hooks/use-field-config-mutations.ts`
- Edge function: `database/supabase/functions/update-field-config/index.ts`
- Location updates: `database/supabase/functions/update-field-config-locations/index.ts`

### Field Editing Flow

1. Admin clicks gear icon on field
2. Popover opens with field settings
3. Admin makes changes to field properties
4. Changes are tracked in local state
5. On popover close, all changes are saved
6. Field updates are reflected immediately in form builder

### Location Restriction Updates

1. Admin toggles "Restrict to specific locations"
2. System loads current location restrictions
3. Admin selects/deselects locations
4. Changes saved when popover closes
5. Visual indicator updates to show restrictions

## Testing Considerations

- Editing all field properties
- Field type changes and validation
- Options updates for select fields
- Location restriction updates
- Section assignment changes
- Cluster assignment changes
- Conditional logic configuration
- Save behavior on popover close
- UI consistency with creation dialog
- Error handling for invalid updates

## Priority

**Priority**: High  
**Complexity**: Medium  
**Estimated Effort**: 2-3 days

## Notes

- Field editing uses a popover instead of a dialog (different from creation)
- Changes are batched and saved when popover closes
- Location restrictions are loaded when popover opens
- Field type changes may require option updates
- Section changes update field order automatically

## Related Issues Fixed

- ✅ Standardized location restriction UI to match add field dialog
- ✅ Consistent modern clickable list approach
- ✅ Proper state management for location restrictions
