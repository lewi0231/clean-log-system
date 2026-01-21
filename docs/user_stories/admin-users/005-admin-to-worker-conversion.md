# User Story 005: Admin to Worker Conversion

## Overview

Dashboard users (admins and viewers) should be able to easily convert themselves into mobile app workers. This allows administrators to also perform fieldwork when needed, or enables office staff to transition to field roles seamlessly.

## User Story

**As a** dashboard user (admin or viewer)
**I want to** convert my account to a worker account
**So that** I can use the mobile app to perform jobs when needed

## Acceptance Criteria

1. Dashboard users can access a "Become a Worker" option from:
   - User profile/settings page
   - Users page (action button on their own record)
   - Quick action in the navigation menu
2. Conversion process:
   - Confirms user wants to convert their account
   - Explains that they'll gain mobile app access
   - Maintains their existing dashboard access
   - Pre-fills their existing contact information
3. Upon conversion:
   - Creates a new worker record linked to the same user account
   - User receives mobile app download instructions
   - Success confirmation with next steps
4. Account state after conversion:
   - Retains dashboard access and permissions
   - Gains ability to log into mobile app
   - Can perform jobs and receive payments
   - Contact information stays synchronized
5. Edge cases handled:
   - User already has a worker account (show current status)
   - Conversion can be reversed if needed
   - Multiple organizations (associate with current org)

## Technical Details

### Current Implementation Status

- Dashboard users and workers are separate entities
- No conversion mechanism exists
- No shared authentication between dashboard and mobile app
- Workers require separate account creation

### Required Changes

#### Database Design
- **Prerequisite**: `auth_user_id` must be added to `organization_users` table (see Story 002)
- Link dashboard users to worker accounts via shared auth_user_id
- Ensure data consistency between organization_users and workers tables
- Handle the case where one auth user has both roles

#### Worker Record Requirements
- Workers require a PIN code for mobile app login
- PIN must be unique within the organization
- Converted users need PIN generation/assignment

#### Conversion Flow
- Add "Become Worker" button/action to relevant places
- Create worker record with existing user data
- **Generate unique PIN** for mobile app access
- Update user profile to reflect dual roles
- Send mobile app setup instructions (including PIN)

#### Authentication
- Ensure single auth user can access both dashboard and mobile app
- Mobile app uses PIN + org_code for login (different from dashboard)
- Maintain role-based permissions appropriately
- Handle session management across platforms

#### Reverse Flow (Worker to Dashboard User)
- Not in scope for this story
- Document as potential future enhancement
- Would require similar linking via auth_user_id

### Implementation Location

- **Conversion component**: `dashboard/components/users/become-worker-dialog.tsx`
- **Profile page**: `dashboard/app/dashboard/profile/page.tsx` (add conversion option)
- **Users page**: `dashboard/app/dashboard/users/page.tsx` (add action button)
- **Worker creation**: Extend `dashboard/hooks/use-workers.ts`
- **Auth logic**: `dashboard/lib/auth.ts`

### Conversion Process Flow

```typescript
interface BecomeWorkerData {
  // Pre-filled from existing dashboard user
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  // Link to existing auth user
  auth_user_id: string;
  organization_id: string;
  // Worker-specific fields
  pin_code: string; // Generated unique PIN for mobile app
}

const generateUniquePin = async (organizationId: string): Promise<string> => {
  // Generate a 4-6 digit PIN that's unique within the organization
  let pin: string;
  let isUnique = false;
  
  while (!isUnique) {
    pin = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit PIN
    const existing = await checkPinExists(organizationId, pin);
    isUnique = !existing;
  }
  
  return pin;
};

const handleBecomeWorker = async (userId: string) => {
  // 1. Get dashboard user data
  const dashboardUser = await getOrganizationUser(userId);

  // 2. Check prerequisite: auth_user_id must exist
  if (!dashboardUser.auth_user_id) {
    throw new Error("Dashboard user must be activated before converting to worker");
  }

  // 3. Check if worker account already exists
  const existingWorker = await getWorkerByAuthUserId(dashboardUser.auth_user_id);

  if (existingWorker) {
    // Show message that they're already a worker
    toast.info("You already have a worker account. Download the mobile app to get started.");
    return;
  }

  // 4. Generate unique PIN for mobile app
  const pinCode = await generateUniquePin(dashboardUser.organization_id);

  // 5. Create worker record
  const workerData: BecomeWorkerData = {
    first_name: dashboardUser.first_name,
    last_name: dashboardUser.last_name,
    email: dashboardUser.email,
    phone: dashboardUser.phone || '', // Phone may be optional for admin users
    auth_user_id: dashboardUser.auth_user_id,
    organization_id: dashboardUser.organization_id,
    pin_code: pinCode,
  };

  await createWorker(workerData);

  // 6. Send mobile app instructions (including PIN and org code)
  await sendMobileAppInstructions(dashboardUser.email, pinCode);

  // 7. Show success message
  toast.success("You're now set up as a worker! Check your email for mobile app instructions.");
};
```

## Related Components

- `dashboard/components/users/organization-user-list.tsx` - Add "Become Worker" action
- `dashboard/app/dashboard/profile/page.tsx` - Add conversion option in profile
- `dashboard/hooks/use-workers.ts` - Extend for conversion logic
- `mobile-app/` - Ensure mobile app can authenticate converted users

## Testing Considerations

1. Test successful conversion from dashboard user to worker
2. Test mobile app login after conversion
3. Test duplicate conversion prevention
4. Test email instructions are sent correctly
5. Test profile updates reflect dual roles
6. Test permission handling (dashboard + mobile access)
7. Test conversion reversal if needed

## Priority

**Priority**: Medium
**Complexity**: Medium-High
**Estimated Effort**: 4-6 hours

## Notes

- This enables flexible workforce management
- Should maintain data consistency between systems
- Consider adding a "Worker Status" indicator in dashboard user list
- Mobile app instructions should include download links and setup steps
- Need to ensure billing/payment systems work for converted users