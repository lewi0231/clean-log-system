# User Story 001: Admin User Invitation Creation

## Overview

As an admin user, I need to be able to invite other users to join my organization as either admin or viewer users. When I create an invitation, the new user should receive an email with instructions on how to activate their account and set up their login credentials.

## User Story

**As an** admin user
**I want to** invite other users to join my organization as admin or viewer users
**So that** I can grant appropriate access levels to team members who need to manage or view organization data

## Acceptance Criteria

1. Admin users can access an "Add Dashboard User" form from the Users page
2. The form requires:
   - Email address (validated format)
   - Role selection (Admin or Viewer)
   - First name
   - Last name
   - Phone number
3. Upon successful submission:
   - A new organization user record is created with status "pending"
   - An invitation email is sent to the provided email address
   - A success toast notification appears with confirmation
4. The invitation email includes:
   - Organization name
   - User's assigned role (Admin/Viewer)
   - Activation link to set up password and complete registration
   - Clear instructions on next steps
5. If email sending fails, appropriate error handling and user feedback is provided

## Technical Details

### Current Implementation Status

- Basic form exists in `OrganizationUserForm` component
- Currently only collects email and role
- No name or phone collection
- No email sending functionality implemented
- No status tracking (active/pending)
- No `auth_user_id` linking to Supabase Auth users

### Required Changes

#### Database Schema Updates
- Add `first_name`, `last_name`, `phone` fields to organization_users table
- Add `status` field (enum: 'pending', 'active', 'inactive')
- Add `invited_at`, `activated_at` timestamps
- Add `auth_user_id` UUID field to link to auth.users (nullable until activation)

#### Email System
- Use Supabase's `supabase.auth.admin.inviteUserByEmail()` for token generation and email
- Alternatively, create custom email template for admin user invitations
- Implement email sending via Supabase Edge Functions
- Include secure activation token/link generation

#### Edge Cases to Handle
- User already exists in auth.users but for a different organization
- User already exists in organization_users with pending status (resend invitation)
- User's email domain restrictions (if applicable)

#### UI Updates
- Update `OrganizationUserForm` to collect name and phone
- Update `OrganizationUserList` to display names, status, and contact info
- Add status indicators (pending/active badges)

### Implementation Location

- **Database migration**: `database/migrations/`
- **Email template**: `database/functions/send-admin-invitation/`
- **Form component**: `dashboard/components/users/organization-user-form.tsx`
- **List component**: `dashboard/components/users/organization-user-list.tsx`
- **Hook updates**: `dashboard/hooks/use-organization-users.ts`

### Email Template Structure

```
Subject: You've been invited to join {Organization Name} as an {Role}

Dear {First Name},

You've been invited to join {Organization Name} as a {Role} user.

Your login email: {email}
Role: {Admin/Viewer}

To get started, please click the link below to set up your password and activate your account:

[Activate Account Button]
{activation_url}

This link will expire in 7 days for security reasons.

If you have any questions, please contact the person who invited you.

Best regards,
The {Organization Name} Team
```

## Related Components

- `dashboard/app/dashboard/users/page.tsx` - Users page with tabs
- `dashboard/components/users/organization-user-form.tsx` - User creation form
- `dashboard/components/users/organization-user-list.tsx` - User list display
- `dashboard/hooks/use-organization-users.ts` - Organization users hook

## Testing Considerations

1. Test successful invitation creation and email sending
2. Test form validation for all required fields
3. Test email template rendering with correct data
4. Test activation link generation and expiration
5. Test error handling when email service fails
6. Test duplicate email prevention
7. Test role-based permissions for who can invite users

## Priority

**Priority**: High
**Complexity**: Medium
**Estimated Effort**: 4-6 hours

## Notes

- This is foundational functionality for multi-user organizations
- Should follow the same email patterns used for worker invitations
- Consider implementing email preview in development mode
- Need to handle edge cases like users who already exist in the system