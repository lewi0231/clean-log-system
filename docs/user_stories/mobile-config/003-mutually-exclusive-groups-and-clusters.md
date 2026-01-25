# User Story 003: Mutually Exclusive Groups and Clusters

## Overview

Admins need to create "choose one" options where workers can only select a single option. For example, workers might choose between "Simple Toggle" or "Detailed Breakdown" for tracking a service. Fields are assigned to clusters, and clusters act as options within a mutually exclusive group.

## User Story

**As an** admin user  
**I want to** create mutually exclusive options and assign fields to them  
**So that** workers can choose between different ways to track the same thing (e.g., simple vs detailed tracking)

## Acceptance Criteria

1. Admin can see "Advanced Options" button in the page header (always visible)
2. Admin can click button to open Advanced Options modal
3. Admin can create cluster/option names in the Advanced Options modal
4. Admin can see where to create clusters (clear link/guidance in field settings)
5. Admin can assign a field to a cluster when editing field settings
6. Admin can select from existing clusters or type a new cluster name
7. Fields in the same cluster work together as a single option
8. Only one cluster can be selected at a time in the mobile app
9. Visual indicators show which fields belong to clusters
10. Tooltips explain cluster behavior (with proper TooltipProvider)
11. Cluster names are displayed in a user-friendly format
12. Admin can see all created clusters and their assigned fields
13. Admin can delete clusters (removes assignment from all fields)
14. Modal can be closed via X button, ESC key, or clicking outside

## Technical Details

### Current Implementation

- Component: `dashboard/components/form-builder/mutually-exclusive-group-manager.tsx`
- Field settings: `dashboard/components/form-builder/section-editor.tsx` (Advanced Options)
- Database: Fields have `mutually_exclusive_group` and `group_cluster` fields
- Default group: All clusters use `default_exclusive_group` behind the scenes

### Cluster Creation Flow

1. Admin clicks "Advanced Options" button in page header (always visible)
2. Advanced Options modal opens
3. Admin types cluster name in "Create New Option" input
4. Admin clicks "Create Option" button
5. Cluster name is added to available clusters list
6. Admin closes modal (or keeps it open)
7. Admin can then assign fields to this cluster in field settings

### Field Assignment Flow

1. Admin opens field settings (gear icon)
2. Admin expands "Advanced Options" section
3. Admin sees "Mutually Exclusive Cluster" section with helpful text
4. Admin can select existing cluster from dropdown
5. Admin can type new cluster name in input field
6. Field is assigned to cluster and mutually exclusive group

### UI Improvements

- ✅ Converted Advanced Options from collapsible card to modal dialog
- ✅ Added visible "Advanced Options" button in page header
- ✅ Added helpful text pointing to Advanced Options button for cluster creation
- ✅ Fixed Tooltip error by wrapping in TooltipProvider
- ✅ Clear visual distinction between creating vs assigning clusters
- ✅ Improved discoverability with always-visible button

## Testing Considerations

- Creating cluster names in Advanced Options
- Assigning fields to clusters
- Typing new cluster names in field settings
- Visual indicators for cluster assignments
- Tooltip functionality (no errors)
- Mobile app dropdown behavior
- Cluster deletion and field reassignment
- Cluster name formatting and display

## Priority

**Priority**: Medium  
**Complexity**: Medium  
**Estimated Effort**: 2-3 days

## Notes

- All clusters share a single implicit group (`default_exclusive_group`)
- Cluster names are converted to IDs (lowercase, underscores)
- Display names are formatted (Title Case from cluster_id)
- Fields can be removed from clusters by selecting "No cluster"
- Mobile app shows dropdown with cluster options
- Only one cluster can be active at a time per mutually exclusive group

## Related Issues Fixed

- ✅ Added link/guidance to create cluster names in Advanced Options
- ✅ Fixed Tooltip error: `Tooltip` must be used within `TooltipProvider`
- ✅ Improved user guidance for cluster creation workflow
