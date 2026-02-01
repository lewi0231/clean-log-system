# Plan: Multi-Select Field for Add-Ons

## Overview

Add the ability to configure select fields to allow multiple selections, enabling use cases like "add-ons" where users can select multiple options.

## Simplified Approach

**Decision: Keep it simple** - Add a boolean flag `allow_multiple` to ValidationRules. Let the mobile app handle the implementation details (checkboxes, dropdown, etc.) based on what works best for that platform.

## Implementation Plan

### 1. Data Model Changes

Add to ValidationRules:

```typescript
export interface ValidationRules {
  // ... existing fields
  allow_multiple?: boolean; // For select fields - allows multiple selections
}
```

**Why ValidationRules?** - Keeps validation-related settings together, and this is a validation/behavior rule for the field.

### 2. Field Configuration UI

Add toggle in field configuration forms (only for `field_type === "select"`):

- Location: `field-config-dialog.tsx`, `field-config-form.tsx`, `section-editor.tsx`
- Label: "Allow multiple selections"
- Description: "Enable users to select multiple options from this list. The mobile app will handle the UI implementation."
- Only show when field type is "select"

### 3. Data Storage

- **Single select** (`allow_multiple: false` or undefined): Store as `string` (current behavior)
- **Multi-select** (`allow_multiple: true`): Store as `string[]` (array of selected option values)

Update `hasValue` function in `use-field-configs.ts` to handle arrays:

```typescript
case "select":
  if (fieldConfig.validation_rules?.allow_multiple) {
    return Array.isArray(value) && value.length > 0;
  }
  return typeof value === "string" && value.length > 0;
```

### 4. Rendering

**Dashboard**: Keep current single-select rendering for now. Multi-select can be added later if needed.

**Mobile App**: Implementation is left to the mobile app team. They can choose the best approach (checkboxes, multi-select dropdown, etc.) based on their UX preferences and platform capabilities.

### 5. Files to Modify

1. `shared/types/validation-rule.ts` - Add `allow_multiple?: boolean`
2. `dashboard/components/form-builder/field-config-dialog.tsx` - Add toggle (only for select fields)
3. `dashboard/components/form-builder/section-editor.tsx` - Add toggle in inline editor (only for select fields)
4. `dashboard/components/settings/field-config-form.tsx` - Add toggle (only for select fields)
5. `mobile-app/hooks/use-field-configs.ts` - Update `hasValue` function to handle arrays
6. `dashboard/components/completed-jobs/create-job-dialog.tsx` - Handle array values for multi-select
7. `dashboard/components/completed-jobs/edit-job-dialog.tsx` - Handle array values for multi-select

**Note**: Mobile app rendering implementation is left to the mobile team.

## Implementation Steps

1. ✅ Fix required badge contrast
2. Update ValidationRules type - add `allow_multiple?: boolean`
3. Add toggle to field configuration UIs (only show for select fields)
4. Update `hasValue` function to handle arrays
5. Update job dialog components to handle array values
6. Test with single and multi-select scenarios

## Testing Scenarios

1. Select field with `allow_multiple=false` (or undefined) → Should work as single select (current behavior)
2. Select field with `allow_multiple=true` → Should store as array, mobile app handles UI
3. Verify `hasValue` correctly validates both string and array values
4. Verify job creation/editing handles both string and array values correctly
