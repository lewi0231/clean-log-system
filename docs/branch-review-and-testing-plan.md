# Branch Review: Manual Testing Improvements

## Overview

This branch introduces significant features including email verification, bank transfer payments, auto-invoice generation, multi-select fields, address fields, image fields, and various UI improvements.

---

## 1. Code Issues and Improvements

### 1.1 Critical Issues

#### Issue 1: Inconsistent Alert Usage

**Files Affected**: `dashboard/app/dashboard/settings/page.tsx` (lines 684, 721, 771)
**Problem**: Still using browser `alert()` despite `STYLING_PRACTICES.md` explicitly stating to use `AlertDialog`.

```typescript
// Current (inconsistent):
alert("Failed to disconnect Stripe account. Please try again.");

// Should be:
setErrorDialog({
  open: true,
  title: "Error",
  message: "Failed to disconnect Stripe account. Please try again.",
});
```

**Recommendation**: Replace all remaining `alert()` calls with `AlertDialog` in settings page.

---

#### Issue 2: Multi-select Validation Rules Not Preserved

**File**: `dashboard/components/form-builder/section-editor.tsx` (line 1181-1185)
**Problem**: When toggling `allow_multiple` off, it sets `validation_rules` to `null`, which would clear any other validation rules that might exist.

```typescript
validation_rules:
  checked
    ? { allow_multiple: true }
    : null,  // ❌ This clears ALL validation rules
```

**Recommendation**: Merge with existing validation rules instead:

```typescript
validation_rules: checked
  ? { ...field.validation_rules, allow_multiple: true }
  : field.validation_rules
      ? { ...field.validation_rules, allow_multiple: undefined }
      : null,
```

---

#### Issue 3: Address Autocomplete Component Not Used

**File**: `dashboard/components/ui/address-autocomplete.tsx` (469 lines)
**Problem**: The component was created but then removed from the settings page. It's now unused code.
**Recommendation**: Either:

1. Delete the component if not needed
2. Or keep it for future mobile-config address field autocomplete

---

### 1.2 Moderate Issues

#### Issue 4: Duplicate Invoice Auto-Generation Logic

**Files**: `database/supabase/functions/create-job/index.ts` and `update-job/index.ts`
**Problem**: The auto-generate invoice logic is duplicated across both files (~200 lines each).
**Recommendation**: Extract to a shared utility function in `_utils/invoice-generation.ts`.

---

#### Issue 5: Missing Error Handling in Bank Transfer Save

**File**: `dashboard/app/dashboard/settings/page.tsx` (line 784-850)
**Problem**: `handleSaveBankTransferSettings` doesn't have proper error state handling - it only logs errors.
**Recommendation**: Add proper error feedback:

```typescript
} catch (err) {
  log.error("Settings: Failed to save bank transfer settings", { error: err });
  setErrorDialog({
    open: true,
    title: "Save Failed",
    message: "Failed to save bank transfer settings. Please try again.",
  });
}
```

---

#### Issue 6: Hardcoded 30-Day Invoice Due Date

**Files**: `create-job/index.ts` and `update-job/index.ts`
**Problem**: Due date is hardcoded to 30 days. This should be configurable per organization.

```typescript
const defaultDueDate = new Date();
defaultDueDate.setDate(defaultDueDate.getDate() + 30); // Hardcoded
```

**Recommendation**: Add `default_invoice_due_days` to organization settings.

---

#### Issue 7: Tour Step Popover Logic May Fail

**File**: `dashboard/components/tours/page-tour-tooltip.tsx`
**Problem**: The popover opening logic searches for buttons by text content which is fragile.

```typescript
const addFieldButton = Array.from(document.querySelectorAll("button")).find(
  (btn) =>
    btn.textContent?.includes("Add Field") && btn.querySelector(".lucide-plus")
);
```

**Recommendation**: Add a `data-tour-trigger="add-field-popover"` attribute to the button for more reliable targeting.

---

### 1.3 Minor Issues / Improvements

#### Issue 8: Switch Styling Not Consistent

**Problem**: Some switches have the styling class, some don't.
**Files to Check**:

- `dashboard/components/form-builder/section-editor.tsx` - ✅ Has styling
- `dashboard/components/settings/field-config-form.tsx` - ✅ Has styling
- `dashboard/components/onboarding/onboarding-wizard.tsx` - ✅ Has styling
- Other switch components may be missing the styling

**Standard styling class**:

```typescript
className =
  "data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30";
```

---

#### Issue 9: Unused Geoapify API Key

**File**: `dashboard/lib/env.ts`
**Problem**: `NEXT_PUBLIC_GEOAPIFY_API_KEY` is defined but the address autocomplete is not actively used.
**Recommendation**: Document that this is for future use or remove if not needed.

---

#### Issue 10: Image Field Placeholder

**Files**: `mobile-app/components/field-renderer-nativebase.tsx`, `field-renderer.tsx`
**Problem**: Image field shows "Image upload coming soon" - needs actual implementation.
**Recommendation**: Create a GitHub issue to track full implementation with Cloudinary.

---

#### Issue 11: Address Field Missing Autocomplete

**Files**: `mobile-app/components/field-renderer-nativebase.tsx`, `field-renderer.tsx`
**Problem**: Address field is just a text input without autocomplete.
**Recommendation**: Plan for Geoapify integration on mobile (can reuse dashboard component logic).

---

### 1.4 Next.js Best Practices

#### Issue 12: Large Settings Page Component

**File**: `dashboard/app/dashboard/settings/page.tsx` (1643 lines)
**Problem**: This file is very large and handles multiple concerns.
**Recommendation**: Split into smaller components:

- `OrganizationTab.tsx`
- `InvoicingTab.tsx`
- `PaymentProvidersTab.tsx`
- `BankTransferSettings.tsx`

---

#### Issue 13: Missing Suspense Boundary

**File**: `dashboard/app/verify-email/page.tsx`
**Problem**: Uses `useSearchParams()` which should be wrapped in Suspense.
**Recommendation**: Add Suspense boundary or use the pattern from other pages.

---

## 2. Consistency Issues

### 2.1 Error Handling Patterns

| Location                          | Pattern Used          |
| --------------------------------- | --------------------- |
| Settings page (logo upload)       | `AlertDialog` ✅      |
| Settings page (Stripe disconnect) | `alert()` ❌          |
| Settings page (currency change)   | `alert()` ❌          |
| Onboarding wizard                 | Inline error state ✅ |
| Verify email page                 | `Alert` component ✅  |

**Recommendation**: Standardize on `AlertDialog` for all error feedback.

### 2.2 Button Styling

Most buttons now have `cursor-pointer` class, but verify all interactive elements have it.

### 2.3 Switch Styling

All switches should use the standard styling class defined in `STYLING_PRACTICES.md`.

---

## 3. Testing Plan

> **Note**: Automated tests have been implemented for the critical test cases below. See test files:
>
> - `dashboard/__tests__/app/verify-email.test.tsx` - Email verification tests
> - `dashboard/__tests__/app/home-navigation.test.tsx` - Home page navigation tests
> - `dashboard/__tests__/components/settings/bank-transfer-settings.test.tsx` - Bank transfer tests
> - `dashboard/__tests__/components/form-builder/multi-select-field.test.tsx` - Multi-select tests
> - `dashboard/__tests__/components/form-builder/address-image-fields.test.tsx` - Address/image field tests
> - `database/supabase/functions/_utils/__tests__/auto-invoice.test.ts` - Auto-invoice unit tests
> - `database/supabase/functions/__tests__/auto-invoice-integration.test.ts` - Auto-invoice integration tests

### 3.1 Email Verification Flow

#### Test Case EV-1: New Organization Registration

**Steps**:

1. Navigate to `/signup`
2. Fill in organization name, admin email, and password
3. Submit the form
4. Verify redirect to `/verify-email?email=...`
5. Check email inbox for verification email
6. Click verification link in email
7. Verify successful verification message
8. Verify auto-redirect to `/onboarding`

**Expected Results**:

- User receives verification email within 1 minute
- Verification link works correctly
- Session is established after verification
- User can access dashboard after verification

#### Test Case EV-2: Resend Verification Email

**Steps**:

1. Navigate to `/verify-email?email=test@example.com`
2. Click "Resend Verification Email" button
3. Wait for success message
4. Check email inbox

**Expected Results**:

- Button shows loading state
- Success message appears
- New email is received

#### Test Case EV-3: Invalid Verification Token

**Steps**:

1. Navigate to `/verify-email#token_hash=invalid&type=email`
2. Observe error handling

**Expected Results**:

- Error message is displayed
- User can request new verification email

---

### 3.2 Bank Transfer Settings

#### Test Case BT-1: Configure Bank Transfer Details

**Steps**:

1. Navigate to `/dashboard/settings?tab=payment`
2. Enter BSB (format: 123-456)
3. Enter Account Number (6-10 digits)
4. Enter Account Name
5. Toggle "Show bank transfer on invoices"
6. Click "Save Bank Transfer Settings"

**Expected Results**:

- BSB auto-formats as XXX-XXX
- Validation error for invalid BSB format
- Validation error for invalid account number length
- Settings save successfully
- "Unsaved changes" warning clears

#### Test Case BT-2: Bank Transfer on Invoice

**Steps**:

1. Configure bank transfer settings (BT-1)
2. Create and view an invoice
3. Check invoice preview

**Expected Results**:

- Bank transfer section appears on invoice
- BSB, Account Number, Account Name displayed
- Invoice number shown as reference
- Note about manual tracking displayed

---

### 3.3 Auto-Generate Invoices

#### Test Case AI-1: Enable Auto-Generate in Onboarding

**Steps**:

1. Start new organization onboarding
2. On Step 4 (Invoicing), enable "Automatically generate invoices"
3. Complete onboarding
4. Check organization settings

**Expected Results**:

- Setting is saved to `organization_settings.auto_generate_invoices_immediately`

#### Test Case AI-2: Auto-Generate on Job Creation (Mobile)

**Preconditions**: Organization has `auto_generate_invoices_immediately = true`
**Steps**:

1. Create a new job via mobile app
2. Submit job with completed status
3. Check invoices list

**Expected Results**:

- Invoice is automatically created
- Invoice status is `pending_review`
- Invoice is linked to the job

#### Test Case AI-3: Location Hierarchy Takes Precedence

**Preconditions**:

- Organization has `auto_generate_invoices_immediately = true`
- Location has hierarchy with auto-generate configured
  **Steps**:

1. Create job at that location
2. Check invoices

**Expected Results**:

- Location hierarchy auto-generate is used, not immediate

---

### 3.4 Multi-Select Field

#### Test Case MS-1: Create Multi-Select Field

**Steps**:

1. Navigate to mobile config
2. Add new select field
3. Enable "Allow Multiple Selections"
4. Add options
5. Save field

**Expected Results**:

- Field saves with `validation_rules.allow_multiple = true`
- Field appears in form builder

#### Test Case MS-2: Edit Existing Field to Multi-Select

**Steps**:

1. Open existing select field in section editor
2. Toggle "Allow Multiple Selections" on
3. Verify change saves

**Expected Results**:

- `validation_rules` updated without losing other rules

---

### 3.5 Image Field Type

#### Test Case IF-1: Add Image Field

**Steps**:

1. Navigate to mobile config
2. Click "Add Field"
3. Select "Image" field type
4. Configure field settings
5. Save

**Expected Results**:

- Image field appears in form builder
- Image field shows in mobile preview (placeholder)

#### Test Case IF-2: Mobile App Rendering

**Steps**:

1. Create job with image field in mobile app
2. View the field

**Expected Results**:

- Shows "Image upload coming soon" placeholder
- No errors in console

---

### 3.6 Address Field Type

#### Test Case AF-1: Add Address Field

**Steps**:

1. Navigate to mobile config
2. Add "Address" field type
3. Configure and save

**Expected Results**:

- Field saves correctly
- Appears in mobile preview

#### Test Case AF-2: Mobile App Address Input

**Steps**:

1. Open job with address field in mobile app
2. Enter address text
3. Submit job

**Expected Results**:

- Text input works
- Value saves correctly
- No autocomplete (expected - future feature)

---

### 3.7 Organization Settings

#### Test Case OS-1: Business Address Fields

**Steps**:

1. Navigate to `/dashboard/settings?tab=organization`
2. Fill in Street Address, City, State, Postcode
3. Blur each field (auto-save)

**Expected Results**:

- Each field auto-saves on blur
- Combined address saves to `business_address`

#### Test Case OS-2: Primary Contact Email Tooltip

**Steps**:

1. Navigate to organization settings
2. Hover over info icon next to "Primary Contact Email"

**Expected Results**:

- Tooltip explains this doesn't change sign-in email

---

### 3.8 Page Tours

#### Test Case PT-1: Mobile Config Tour

**Steps**:

1. Navigate to mobile config
2. Start tour (if not auto-started)
3. Go through all 3 steps
4. Click "Back" button
5. Complete tour

**Expected Results**:

- Step 1: Sections card highlighted
- Step 2: Add Field popover opens and content highlighted
- Step 3: Mobile preview highlighted (not cut off)
- Back button works correctly
- Tour completes without hanging

#### Test Case PT-2: Tour with Missing Element

**Steps**:

1. Modify DOM to remove a tour target
2. Start tour
3. Observe behavior

**Expected Results**:

- Tour auto-skips to next step
- Console warning logged
- Tour doesn't hang

---

### 3.9 Home Page Navigation

#### Test Case HP-1: Get Started Link

**Steps**:

1. Navigate to home page (`/`)
2. Click "Get Started" button

**Expected Results**:

- Redirects to `/signup` (not `/dashboard`)

---

## 4. Regression Testing

### 4.1 Existing Features to Verify

- [ ] Standard job creation still works
- [ ] Invoice creation without auto-generate still works
- [ ] Stripe payment flow unaffected
- [ ] Worker invitation flow works
- [ ] Mobile app login works
- [ ] Existing select fields work (single select)
- [ ] Form builder drag-and-drop works

---

## 5. Performance Considerations

### 5.1 Address Autocomplete Debouncing

- Verify 400ms debounce is working
- Check network tab for excessive API calls

### 5.2 Settings Page Load Time

- Page has grown significantly
- Consider lazy loading tabs

---

## 6. Security Considerations

### 6.1 Email Verification

- Tokens should expire appropriately
- Verify OTP validation is secure

### 6.2 Bank Transfer Details

- Ensure RLS policies protect bank details
- Only organization admins should access

---

## 7. Action Items Summary

### High Priority

1. [x] Fix remaining `alert()` calls in settings page ✅
2. [x] Fix multi-select validation rules preservation ✅
3. [x] Add error feedback for bank transfer save failures ✅ (already implemented)

### Medium Priority

4. [ ] Extract duplicate invoice generation logic to utility
5. [x] Add Suspense boundary to verify-email page ✅
6. [x] Create GitHub issue for image field full implementation ✅ (Issue #19)
7. [x] Add data-tour-trigger attribute for reliable popover targeting ✅

### Low Priority

8. [ ] Consider splitting settings page into smaller components (see architecture note below)
9. [x] Document unused address autocomplete component ✅
10. [x] Add configurable invoice due days setting ✅

---

## Architecture Note: Settings Page Component Splitting

The settings page (`dashboard/app/dashboard/settings/page.tsx`) has grown to ~1700 lines and handles multiple concerns. While functional, consider splitting into smaller components in a future refactor:

### Recommended Structure

```
dashboard/components/settings/
├── OrganizationTab.tsx          # Organization info, logo, address
├── InvoicingTab.tsx             # Invoice settings, auto-generate, due days
├── PaymentProvidersTab.tsx      # Stripe, bank transfer settings
├── AdvancedSettingsTab.tsx      # Locations, ratings links
└── settings-types.ts            # Shared types and interfaces
```

### Benefits

- Improved code organization and maintainability
- Easier testing of individual sections
- Better code splitting for performance
- Clearer separation of concerns

### Implementation Notes

- Each tab component would receive `settings`, `setSettings`, `organizationId`, and `supabase` as props
- Error handling (`setErrorDialog`) could be lifted to parent or use context
- Bank transfer "unsaved changes" tracking would stay in PaymentProvidersTab
- Consider using React.lazy() for tab content to improve initial load time

This refactor is recommended but not urgent - the current implementation is functional and well-organized.
