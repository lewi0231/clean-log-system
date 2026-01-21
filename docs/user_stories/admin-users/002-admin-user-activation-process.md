# User Story 002: Admin User Activation Process

## Overview

When an admin user receives an invitation email, they need a secure way to activate their account by setting up a password and completing their profile. The system should track activation status and provide clear feedback throughout the process.

## User Story

**As a** newly invited admin user
**I want to** activate my account through a secure email link
**So that** I can set up my password and start using the dashboard

## Acceptance Criteria

1. Invitation emails contain a secure, time-limited activation link
2. Clicking the activation link redirects to a dedicated activation page
3. The activation page:
   - Verifies the token is valid and not expired
   - Pre-fills the user's email from the invitation
   - Requires setting a strong password
   - Confirms password requirements are met
4. Upon successful activation:
   - User status changes from "pending" to "active"
   - User is automatically logged in
   - Redirected to dashboard with welcome message
   - Activation timestamp is recorded
5. Invalid/expired links show appropriate error messages with retry options
6. Users can request a new invitation if their original link expires
7. Password requirements are clearly communicated (minimum length, complexity)

## Technical Details

### Current Implementation Status

- Basic email verification exists for workers via `verify-email` page
- No admin user activation flow implemented
- No status tracking in organization_users table
- No password reset/resend invitation functionality

### Required Changes

#### Database Updates
```sql
ALTER TABLE organization_users
ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
ADD COLUMN invited_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN activated_at TIMESTAMPTZ,
ADD COLUMN auth_user_id UUID REFERENCES auth.users(id);
```

#### Authentication Flow Options

**Option A: Use Supabase Built-in Invite (Recommended)**
- Use `supabase.auth.admin.inviteUserByEmail()` which handles:
  - Token generation and expiration
  - Email sending with activation link
  - Password setup flow
- Extend existing verify-email page to handle admin user type
- Link auth_user_id to organization_users after successful activation

**Option B: Custom Token Implementation**
- Create `admin_invitation_tokens` table for custom tokens
- Implement secure token generation and validation
- Add password setting functionality for invited users
- More control but more maintenance

#### Status Tracking
- Update user status upon successful activation
- Display status in admin user list with appropriate visual indicators
- Handle edge cases (multiple invitations, expired tokens)

#### Partial State Handling
- User clicks activation link but doesn't complete password setup
- User refreshes page during activation flow
- Token valid but activation times out

### Implementation Location

- **Database migration**: `database/migrations/add_admin_user_status_tracking.sql`
- **Activation page**: `dashboard/app/activate-admin/page.tsx` (or extend existing verify-email)
- **Email function**: `database/functions/send-admin-invitation/index.ts`
- **Auth helpers**: `dashboard/lib/auth.ts` - add admin user activation methods

### Security Considerations

1. **Token Security**:
   - Use cryptographically secure random tokens
   - Include expiration (7 days default)
   - One-time use tokens (invalidate after use)
   - Include user ID and timestamp in token for verification

2. **Password Requirements**:
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character

3. **Rate Limiting**:
   - Limit activation attempts per IP
   - Prevent brute force attacks on token validation

### Token Structure

```typescript
interface AdminActivationToken {
  userId: string;
  email: string;
  role: 'admin' | 'viewer';
  organizationId: string;
  expiresAt: number; // timestamp
  token: string; // random secure token
}
```

## Related Components

- `dashboard/app/verify-email/page.tsx` - Existing email verification (can be extended)
- `dashboard/components/auth/password-setup.tsx` - New component for password setup
- `dashboard/components/users/organization-user-list.tsx` - Status display updates
- `database/functions/send-admin-invitation/index.ts` - Email sending logic

## Testing Considerations

1. Test valid token activation flow
2. Test expired token handling
3. Test invalid token error messages
4. Test password validation requirements
5. Test automatic login after activation
6. Test status changes in database
7. Test resend invitation functionality
8. Test multiple invitation handling

## Priority

**Priority**: High
**Complexity**: Medium-High
**Estimated Effort**: 6-8 hours

## Notes

- Should leverage existing email verification patterns where possible
- Consider using Supabase's built-in auth methods for password setting
- Need to handle the case where a user already exists in auth.users but not activated
- Should provide clear error messages for expired/invalid links with easy retry options