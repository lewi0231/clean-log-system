# User Story 003: Admin User Contact Information Collection

## Overview

When adding dashboard users, administrators need to provide complete contact information including names and phone numbers, similar to how worker information is collected. This ensures proper identification and contactability of all team members.

## User Story

**As an** admin user
**I want to** provide complete contact information when inviting dashboard users
**So that** I can maintain accurate records and contact information for all team members

## Acceptance Criteria

1. The "Add Dashboard User" form includes fields for:
   - First Name (required)
   - Last Name (required)
   - Phone Number (required, with validation)
   - Email (required, existing)
   - Role (Admin/Viewer, existing)
2. Phone number validation:
   - Accepts various formats (+1, (555) 123-4567, 555-123-4567, etc.)
   - Stores in consistent format for database
   - Provides real-time validation feedback
3. Name fields:
   - Trim whitespace automatically
   - Allow reasonable length limits (e.g., 50 characters each)
   - Support international characters and names
4. Form behavior:
   - All fields are required except when editing existing users
   - Email field becomes read-only when editing
   - Clear validation messages for each field
5. Data consistency with worker forms (follows same patterns)

## Technical Details

### Current Implementation Status

- OrganizationUserForm only collects email and role
- WorkerForm collects first_name, last_name, email, phone
- No name or phone fields for admin users
- No phone validation logic

### Required Changes

#### Database Schema
```sql
-- Note: Use DEFAULT '' to avoid breaking existing records
-- Phone is optional for admin users (required for workers who need mobile contact)
ALTER TABLE organization_users
ADD COLUMN first_name TEXT NOT NULL DEFAULT '',
ADD COLUMN last_name TEXT NOT NULL DEFAULT '',
ADD COLUMN phone TEXT;

-- Update existing records if needed
UPDATE organization_users 
SET first_name = '', last_name = '' 
WHERE first_name IS NULL OR last_name IS NULL;
```

#### Form Updates
- Add first_name, last_name, phone fields to OrganizationUserForm
- Implement phone number validation and formatting
- Update form validation logic
- Maintain consistency with WorkerForm patterns

#### Type Updates
```typescript
interface OrganizationUser {
  id: string;
  organization_id: string;
  email: string;
  role: "admin" | "viewer";
  first_name: string;
  last_name: string;
  phone: string;
  status: "pending" | "active" | "inactive";
  created_at: string;
  invited_at: string;
  activated_at?: string;
}
```

### Implementation Location

- **Database migration**: `database/migrations/add_admin_user_contact_fields.sql`
- **Form component**: `dashboard/components/users/organization-user-form.tsx`
- **Validation**: `dashboard/lib/validation.ts` (add phone validation)
- **Types**: `dashboard/lib/types.ts`

### Phone Number Validation

**Note**: Current implementation focuses on US/Canadian phone numbers. International support may be added in future iterations.

Accept common formats:
- +1 (555) 123-4567
- (555) 123-4567
- 555-123-4567
- 5551234567
- +15551234567
- Australian: +61 4XX XXX XXX (future support)

Store in standardized format: +15551234567 (E.164 format)

```typescript
// Phone validation utility
export const validatePhoneNumber = (phone: string | null | undefined): boolean => {
  if (!phone || phone.trim() === '') return true; // Phone is optional for admin users
  
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Check for valid patterns (US/Canada focused)
  const patterns = [
    /^\+1\d{10}$/,     // +15551234567
    /^1\d{10}$/,       // 15551234567
    /^\d{10}$/,        // 5551234567
    /^\+61\d{9}$/,     // Australian mobile +61412345678
  ];

  return patterns.some(pattern => pattern.test(cleaned));
};

export const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone || phone.trim() === '') return '';
  
  const cleaned = phone.replace(/[^\d+]/g, '');
  // Convert to +1XXXXXXXXXX format for US/Canada
  if (cleaned.startsWith('+')) return cleaned; // Already has country code
  if (cleaned.startsWith('1') && cleaned.length === 11) return `+${cleaned}`;
  if (cleaned.length === 10) return `+1${cleaned}`;
  return cleaned;
};
```

## Related Components

- `dashboard/components/workers/worker-form.tsx` - Reference for field patterns
- `dashboard/components/users/organization-user-form.tsx` - Primary component to update
- `dashboard/hooks/use-organization-users.ts` - Update hook for new fields

## Testing Considerations

1. Test all phone number format validations
2. Test form submission with all required fields
3. Test name field character limits and special characters
4. Test form validation error messages
5. Test data persistence and retrieval
6. Test edit mode (email read-only, other fields editable)

## Priority

**Priority**: Medium
**Complexity**: Low-Medium
**Estimated Effort**: 2-3 hours

## Notes

- Should match the exact same validation and formatting used for worker phone numbers
- Consider using a phone input library like `react-phone-number-input` for better UX
- Names should support international characters (Unicode)
- This change requires database migration, so coordinate with deployment