# User Story 006: Advanced Field Options

## Overview

Admins need access to advanced field configuration options including conditional logic and mutually exclusive cluster assignments. These features require clear guidance and links to help users understand the workflow.

## User Story

**As an** admin user  
**I want to** configure advanced field options like conditional logic and clusters  
**So that** I can create sophisticated form behaviors that match my business needs

## Acceptance Criteria

1. Admin can see "Advanced Options" button in page header (always visible)
2. Admin can click button to open Advanced Options modal
3. Admin can access "Advanced Options" section in field settings (for field-level options)
4. Admin can configure mutually exclusive clusters in the modal
5. Admin sees clear guidance on where to create cluster names (points to modal button)
6. Admin can set up conditional logic for field visibility
7. Admin can understand the relationship between clusters and groups
8. Tooltips provide helpful explanations (without errors)
9. Links and guidance help users navigate the workflow
10. Advanced Options modal provides focused experience
11. Conditional logic editor is intuitive and functional
12. Cluster assignment integrates with Advanced Options modal
13. Modal can be closed via X button, ESC key, or clicking outside

## Technical Details

### Current Implementation

- Component: `dashboard/app/dashboard/mobile-config/page.tsx` (Modal trigger button)
- Modal: `dashboard/components/ui/dialog.tsx` (Dialog component)
- Conditional Logic: `dashboard/components/form-builder/conditional-logic-editor.tsx`
- Cluster Manager: `dashboard/components/form-builder/mutually-exclusive-group-manager.tsx`
- Advanced Options Modal: Accessible via button in page header

### Advanced Options Workflow

1. Admin clicks "Advanced Options" button in page header
2. Advanced Options modal opens
3. Admin can create cluster/option names in the modal
4. Admin closes modal and opens field settings (gear icon)
5. Admin expands "Advanced Options" section in field settings
6. Admin sees:
   - Mutually Exclusive Cluster section with helpful text (points to modal button)
   - Conditional Logic Editor
7. Admin can assign field to cluster or create new cluster name
8. Admin can configure conditional logic rules

### UI Improvements

- ✅ Converted Advanced Options from collapsible card to modal dialog
- ✅ Added visible "Advanced Options" button in page header
- ✅ Added helpful text pointing to Advanced Options button for cluster creation
- ✅ Fixed Tooltip errors by wrapping in TooltipProvider
- ✅ Clear visual hierarchy for advanced features
- ✅ Modal provides focused experience without page scroll
- ✅ Improved discoverability with always-visible button

## Testing Considerations

- Advanced Options button visibility in header
- Modal open/close functionality
- Modal keyboard navigation (ESC to close)
- Cluster creation in modal
- Cluster assignment workflow
- Conditional logic configuration
- Tooltip functionality (no errors)
- Link/guidance text visibility (points to modal button)
- Integration between modal and field settings
- User understanding of workflow
- Error handling for invalid configurations
- Modal focus management
- Modal accessibility (screen readers)

## Priority

**Priority**: Medium  
**Complexity**: Medium-High  
**Estimated Effort**: 3-4 days

## Notes

- Advanced Options button is always visible in page header for discoverability
- Modal provides focused experience without requiring page scroll
- Conditional logic allows showing/hiding fields based on other field values
- Cluster creation happens in Advanced Options modal (accessible via header button)
- Field assignment to clusters happens in field settings
- Clear guidance helps users understand the two-step process (create in modal, then assign in field settings)
- Modal follows standard dialog patterns for accessibility

## Related Issues Fixed

- ✅ Converted Advanced Options to modal for better accessibility
- ✅ Added visible button in page header for discoverability
- ✅ Updated guidance text: "Need to create a new cluster name? Click the Advanced Options button at the top of the page"
- ✅ Fixed Tooltip Provider errors
- ✅ Improved user workflow understanding
