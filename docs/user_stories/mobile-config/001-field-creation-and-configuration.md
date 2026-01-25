# User Story 001: Field Creation and Configuration

## Overview

Admins need to create and configure form fields that workers will use in the mobile app to complete jobs. Fields can be of various types (text, number, select, etc.) and need proper configuration including labels, names, descriptions, and requirements.

## User Story

**As an** admin user  
**I want to** create and configure form fields for the mobile app  
**So that** workers can collect the necessary data when completing jobs

## Acceptance Criteria

1. Admin can create new fields by clicking "Add Field" button
2. Admin can select field type from available options:
   - Text, Number, Email, Phone
   - Select (dropdown), Textarea
   - Date, Time
   - Boolean (Checkbox)
   - Image, Address
   - Grouped Breakdown
3. Admin can set field label (display name shown to workers)
4. Admin can set field name (internal identifier, auto-generated from label)
5. Admin can customize field name if needed
6. Admin can add description/placeholder text for the field
7. Admin can mark field as required
8. For select/grouped_breakdown fields, admin can specify options (comma-separated)
9. Admin can assign field to a section (or leave unassigned)
10. Admin can configure location restrictions (if using predefined locations)
11. Field is saved and immediately available in the form builder
12. Field appears in mobile preview after creation

## Technical Details

### Current Implementation

- Component: `dashboard/components/form-builder/field-config-dialog.tsx`
- Hook: `dashboard/hooks/use-mobile-config.ts`
- Edge function: `database/supabase/functions/create-field-config/index.ts`
- Service: Field config mutations in `dashboard/hooks/use-field-config-mutations.ts`

### Field Creation Flow

1. User clicks "Add Field" button in Visual Form Builder
2. FieldConfigDialog opens with field type selection
3. User fills in field details (label, description, options if applicable)
4. User can configure location restrictions if enabled
5. On save, field is created via edge function
6. Field appears in form builder and mobile preview

### Field Types

- **Text**: Single-line text input
- **Number**: Numeric input with validation
- **Email**: Email format validation
- **Phone**: Phone number input
- **Select**: Dropdown with predefined options
- **Textarea**: Multi-line text input
- **Date**: Date picker
- **Time**: Time picker
- **Boolean**: Checkbox (yes/no)
- **Image**: Image capture/upload
- **Address**: Address input with validation
- **Grouped Breakdown**: Multiple related fields grouped together

## Testing Considerations

- Field creation with all field types
- Auto-generation of field names from labels
- Manual field name customization
- Required field validation
- Options configuration for select fields
- Location restriction configuration
- Section assignment
- Mobile preview accuracy

## Priority

**Priority**: High  
**Complexity**: Medium  
**Estimated Effort**: 2-3 days

## Notes

- Field names must be unique within an organization
- Field names are auto-generated but can be customized
- Location restrictions only appear if organization uses predefined locations
- Fields must be in a section to appear in mobile app
