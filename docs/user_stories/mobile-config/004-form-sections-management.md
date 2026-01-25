# User Story 004: Form Sections Management

## Overview

Admins need to organize form fields into collapsible sections for better mobile app UX. Sections help group related fields together and can be collapsed by default to reduce visual clutter.

## User Story

**As an** admin user  
**I want to** create and manage form sections  
**So that** I can organize fields into logical groups that improve the mobile app experience

## Acceptance Criteria

1. Admin can create new form sections
2. Admin can set section title and description
3. Admin can configure section to be collapsed by default
4. Admin can edit existing sections
5. Admin can delete sections (fields are moved out, not deleted)
6. Admin can reorder sections via drag-and-drop
7. Admin can assign fields to sections
8. Admin can move fields between sections
9. Admin can reorder fields within a section
10. Fields must be in a section to appear in mobile app
11. Sections are displayed in mobile preview
12. Section collapse behavior works in mobile app

## Technical Details

### Current Implementation

- Component: `dashboard/components/form-builder/section-editor.tsx`
- Hook: `dashboard/hooks/use-section-mutations.ts`
- Edge function: `database/supabase/functions/create-form-section/index.ts`
- Database: `form_section` table with `field_ids` array

### Section Creation Flow

1. Admin clicks "Add Section" button
2. Dialog opens for section details
3. Admin enters title, description (optional), collapse setting
4. Section is created and appears in form builder
5. Admin can drag fields into the section

### Field Assignment Flow

1. Admin drags field from main list into section
2. Field is added to section's `field_ids` array
3. Field appears in section in form builder
4. Field appears in mobile preview within that section

## Testing Considerations

- Section creation and editing
- Section deletion (fields preserved)
- Drag-and-drop reordering of sections
- Drag-and-drop assignment of fields to sections
- Field reordering within sections
- Section collapse behavior
- Mobile app section rendering
- Empty sections handling
- Field count badges

## Priority

**Priority**: High  
**Complexity**: Medium  
**Estimated Effort**: 2-3 days

## Notes

- Fields must be in a section to appear in mobile app
- Sections can be collapsed by default for cleaner mobile UX
- Section order determines display order in mobile app
- Field order within section determines display order
- Deleting a section doesn't delete fields, just removes section assignment
