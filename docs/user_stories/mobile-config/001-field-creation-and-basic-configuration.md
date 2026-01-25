# User Story 001: Field Creation and Basic Configuration

## Overview

Admins need to create form fields that workers will use in the mobile app to complete jobs. Fields can be of various types (text, number, select, etc.) and need basic configuration like labels, names, descriptions, and required status.

## User Story

**As an** admin user  
**I want to** create and configure form fields for the mobile app  
**So that** workers can submit the necessary data when completing jobs

## Implementation Status

| Status | Feature |
|--------|---------|
| ✅ | Field type selection |
| ✅ | Field label and name configuration |
| ✅ | Field description/placeholder |
| ✅ | Required field toggle |
| ✅ | Section assignment |
| ✅ | Field name auto-generation from label |
| ✅ | Field validation (unique names) |
| ✅ | Options configuration for select/grouped breakdown fields |

**Overall: ~95% Complete**

## Acceptance Criteria

### Core Features (Implemented)

1. Admin can create fields of different types:
   - Text, Number, Email, Phone
   - Select (dropdown), Textarea
   - Date, Time
   - Boolean (checkbox)
   - Image, Address
   - Grouped Breakdown
2. Admin can set field label (display name)
3. System auto-generates field name from label (can be manually edited)
4. Admin can add field description/placeholder text
5. Admin can mark fields as required
6. Admin can assign fields to form sections
7. For select/grouped breakdown fields, admin can configure options (comma-separated)
8. System validates that field names are unique
9. System prevents creating fields with invalid names
10. Field dialog shows appropriate options based on field type

### Field Types Supported

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
- **Address**: Address input with components
- **Grouped Breakdown**: Multiple related fields grouped together

## Technical Details

### Current Implementation

- Component: `dashboard/components/form-builder/field-config-dialog.tsx`
- Hook: `dashboard/hooks/use-mobile-config.ts`
- Edge function: `database/supabase/functions/create-field-config/index.ts`
- Validation: Field name uniqueness, required fields

### Field Creation Flow

1. Admin clicks "Add Field" and selects field type
2. Field configuration dialog opens
3. Admin fills in:
   - Label (required)
   - Field name (auto-generated, can edit)
   - Description (optional)
   - Required toggle
   - Section assignment (optional)
   - Options (for select/grouped breakdown)
4. System validates input
5. Field is created and appears in form builder
6. Field can be assigned to a section or left unassigned

### Field Name Generation

- Converts label to lowercase
- Replaces spaces/special chars with underscores
- Ensures uniqueness by appending numbers if needed
- User can manually edit the generated name

## Testing Considerations

- Field creation with all field types
- Field name auto-generation and uniqueness
- Required field validation
- Options configuration for select fields
- Section assignment
- Field name validation (invalid characters)
- Duplicate field name prevention

## Priority

**Priority**: High  
**Complexity**: Low-Medium  
**Estimated Effort**: 2-3 days

## Notes

- Field names are used internally and in API calls
- Labels are what workers see in the mobile app
- Fields must be in a section to appear in mobile app
- Field order can be adjusted after creation
