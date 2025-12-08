# Code Changes Needed After Database Migrations

## Summary

Most database changes are **non-breaking** and won't require immediate code changes. However, there are a few areas to review and potentially update.

---

## ✅ No Action Required

### 1. Currency Enum Type Change

**Status:** ✅ **No code changes needed**

The database now uses a `currency_code` enum instead of `TEXT`, but:

- **Supabase JS client automatically handles enums as strings** in TypeScript
- Your code already uses `SupportedCurrency` type (`"AUD" | "USD" | "GBP" | "EUR" | "CAD" | "NZD"`) which matches the enum values
- All currency values in your code are valid enum values
- **Runtime behavior is unchanged** - the database stores the same values, just with better type safety

**Files that use currency (no changes needed):**

- `dashboard/lib/types.ts` - Already uses `SupportedCurrency` type
- `dashboard/hooks/use-organization-currency.ts` - Already type-safe
- Edge functions - Handle currency as strings, which enum types work with

---

## ⚠️ Optional Improvements (Recommended)

### 2. TypeScript Type Updates for Currency

While not required, you could update type definitions to be more explicit:

**Current:**

```typescript
currency: string; // In PricingRule, FieldPricing, etc.
```

**Optional improvement:**

```typescript
currency: SupportedCurrency; // More type-safe
```

**Files that could be updated:**

- `dashboard/lib/types.ts` - Lines 153, 197, 217, 235, 251, 329
- Edge function types (optional, since they work fine as strings)

**Note:** This is optional - your code will work fine as-is. The enum values are already validated at the database level.

---

## 🔍 Review Required (Potential Breaking Changes)

### 3. Email Validation Constraints

**New Constraints Added:**

- `organization_user.email` must match email regex pattern
- `worker.email` (if not null) must match email regex pattern
- `location.email` must match email regex pattern

**Action Required:**

1. **Check for invalid emails in existing data:**

   ```sql
   -- Run these queries to check for invalid emails:
   SELECT id, email FROM organization_user
   WHERE email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';

   SELECT id, email FROM worker
   WHERE email IS NOT NULL
   AND email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';

   SELECT id, email FROM location
   WHERE email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
   ```

2. **Update validation in your forms/components:**

   - Ensure email validation happens before database insert/update
   - The database will now reject invalid emails with a constraint violation error

3. **Error handling:**
   - Add error handling for constraint violations when creating/updating users, workers, or locations
   - Display user-friendly error messages when email validation fails

**Files to review:**

- `dashboard/components/users/` - User creation/editing forms
- `dashboard/components/workers/` - Worker creation/editing forms
- `dashboard/components/locations/` - Location forms (location-form.tsx)

---

### 4. Unique Constraint on Field Config Names

**New Constraint:**

- Case-insensitive unique constraint on `organization_field_configs.name` (active configs only)

**Action Required:**

1. **Check for duplicate names:**

   ```sql
   -- Check for duplicates (case-insensitive):
   SELECT organization_id, LOWER(name), COUNT(*)
   FROM organization_field_configs
   WHERE active = true
   GROUP BY organization_id, LOWER(name)
   HAVING COUNT(*) > 1;
   ```

2. **Update field config creation logic:**

   - Ensure you check for existing names (case-insensitive) before creating
   - Show user-friendly error if duplicate name exists
   - Consider adding client-side validation to prevent duplicate names

3. **Error handling:**
   - Handle unique constraint violations gracefully
   - Provide clear error messages about duplicate names

**Files to review:**

- `dashboard/components/form-builder/` - Field config creation/editing
- Any forms that create organization_field_configs

---

## 📝 Optional: Regenerate Type Definitions

If you use Supabase's type generation (via `supabase gen types`), regenerate types after applying migrations:

```bash
# If you have this set up:
supabase gen types typescript --linked > dashboard/lib/supabase-types.ts
```

This will ensure generated types reflect the enum type (though they'll still be typed as strings in TypeScript, which is fine).

---

## 🧪 Testing Checklist

After applying Phase 3 & 4 migrations, test:

- [ ] **Email validation:**
  - Try creating a user/worker/location with invalid email → Should fail gracefully
  - Try updating email to invalid format → Should fail gracefully
- [ ] **Field config names:**
  - Try creating field config with duplicate name (case-insensitive) → Should fail gracefully
  - Verify archived configs can still have duplicate names
- [ ] **Currency operations:**
  - Create pricing rules with different currencies → Should work normally
  - Invoice creation with various currencies → Should work normally
- [ ] **Performance:**
  - Verify queries using new indexes perform well
  - Check query plans for common operations

---

## 🚨 Breaking Changes Summary

| Change                      | Breaking?       | Action Required                          |
| --------------------------- | --------------- | ---------------------------------------- |
| Currency enum type          | ❌ No           | None - handled automatically             |
| Email validation            | ⚠️ Yes          | Check existing data, add error handling  |
| Unique field config names   | ⚠️ Yes          | Check for duplicates, add error handling |
| New indexes                 | ❌ No           | None - performance improvement only      |
| Table/column comments       | ❌ No           | None - documentation only                |
| Removed pricing_rules table | ✅ Already done | None - verified no code references       |

---

## Quick Wins

1. **Update TypeScript types** (optional but recommended):

   - Change `currency: string` to `currency: SupportedCurrency` in type definitions

2. **Add email validation** in forms:

   - Use the same regex pattern in your validation: `/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/`

3. **Add duplicate name checking** before creating field configs:
   - Query existing active configs and check for case-insensitive matches

---

## Questions to Resolve

1. **Do you have any existing data with invalid emails?** Run the SQL queries above to check.

2. **Do you have duplicate field config names?** Run the duplicate check query.

3. **How do you handle database constraint violations?** Consider adding specific error handling for these new constraints.

---

**Note:** The currency enum change is the most significant structural change, but it's handled automatically by Supabase's client library. The main concerns are the new validation constraints which could cause errors if you have invalid data or try to create duplicates.
