# User Story 004: Admin User Information Display

## Overview

The Users page should display comprehensive information about dashboard users including their names, contact details, and activation status. This provides administrators with a complete view of their team members and their account status.

## User Story

**As an** admin user
**I want to** see complete information about all dashboard users
**So that** I can manage my team effectively and track user account status

## Acceptance Criteria

1. The Dashboard Users table displays:
   - Full Name (First + Last)
   - Email address
   - Phone number
   - Role (Admin/Viewer)
   - Status (Active/Pending/Inactive with visual indicators)
   - Date created/invited
   - Actions (Edit/Delete)
2. Status indicators:
   - **Active**: Green badge/check icon
   - **Pending**: Yellow/orange badge with clock icon
   - **Inactive**: Red badge with warning icon
3. Contact information formatting:
   - Names displayed as "First Last"
   - Phone numbers formatted consistently (e.g., (555) 123-4567)
   - Email addresses as clickable mailto links
4. Table features:
   - Sortable columns (Name, Status, Created Date)
   - Search/filter functionality
   - Responsive design for mobile viewing
5. Empty states:
   - Clear message when no users exist
   - Call-to-action to add first user

## Technical Details

### Current Implementation Status

- OrganizationUserList shows Email, Role, Created, Actions
- No names or phone numbers displayed
- No status tracking or indicators
- Basic table without advanced features

### Required Changes

#### Component Updates
- Update OrganizationUserList to display new fields
- Add status badges with appropriate colors/icons
- Format phone numbers consistently
- Add sorting and filtering capabilities

#### Data Fetching
- Update useOrganizationUsers hook to include new fields
- Ensure proper data typing for all user properties

#### UI Enhancements
- Implement status badges using existing design system
- Add responsive table features
- Include loading states for better UX

### Implementation Location

- **List component**: `dashboard/components/users/organization-user-list.tsx`
- **Hook updates**: `dashboard/hooks/use-organization-users.ts`
- **Type updates**: `dashboard/lib/types.ts`
- **UI components**: Use existing Badge component for status

### Status Badge Implementation

```tsx
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";

const StatusBadge = ({ status }: { status: 'active' | 'pending' | 'inactive' }) => {
  const configs = {
    active: {
      variant: "default" as const,
      icon: CheckCircle,
      text: "Active",
    },
    pending: {
      variant: "secondary" as const,
      icon: Clock,
      text: "Pending",
    },
    inactive: {
      variant: "destructive" as const,
      icon: AlertCircle,
      text: "Inactive",
    }
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant}>
      <Icon className="w-3 h-3 mr-1" />
      {config.text}
    </Badge>
  );
};
```

**Note**: Use shadcn/ui Badge variants directly rather than custom className overrides to maintain design system consistency.

### Additional Table Features

- **Resend Invitation**: Action button for pending users to resend activation email
- **Last Activity**: Consider adding last login timestamp for active users
- **Pagination**: Required for organizations with many users (>20)

### Phone Number Formatting

```typescript
export const formatDisplayPhone = (phone: string): string => {
  // Assuming phone is stored as +15551234567
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{1})(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[2]}) ${match[3]}-${match[4]}`;
  }
  return phone; // fallback for unexpected formats
};
```

## Related Components

- `dashboard/components/users/organization-user-list.tsx` - Primary component to update
- `dashboard/components/ui/badge.tsx` - For status indicators
- `dashboard/hooks/use-organization-users.ts` - Data fetching hook

## Testing Considerations

1. Test all status badge displays and colors
2. Test phone number formatting for various inputs
3. Test name display formatting
4. Test table sorting and filtering
5. Test responsive design on different screen sizes
6. Test empty state display
7. Test loading states

## Priority

**Priority**: Medium
**Complexity**: Low-Medium
**Estimated Effort**: 3-4 hours

## Notes

- Should follow the same display patterns used in worker lists
- Consider adding tooltips for status explanations
- Phone numbers should be clickable for mobile dialing
- Status should be updated in real-time when users activate accounts