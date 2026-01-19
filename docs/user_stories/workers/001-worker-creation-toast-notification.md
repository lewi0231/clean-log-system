# User Story 001: Worker Creation Toast Notification

## Overview

When an admin creates a new worker, they should receive immediate feedback that an invitation email has been sent to the worker. This improves user experience by providing clear confirmation of the action taken.

## User Story

**As an** admin user  
**I want to** see a toast notification when I create a worker  
**So that** I know an invitation email has been sent to the worker

## Acceptance Criteria

1. When a worker is successfully created via the WorkerForm, a success toast notification should appear
2. The toast message should clearly indicate that an invitation email has been sent
3. The toast should include the worker's email address for confirmation
4. The toast should use the existing Sonner toast system already configured in the app
5. Error toasts should continue to work as expected if worker creation fails

## Technical Details

### Current Implementation

- Worker creation is handled in `dashboard/app/dashboard/users/page.tsx` in the `handleAddWorker` function
- The `createWorker` function is called from `dashboard/hooks/use-workers.ts`
- Toast notifications are already configured using Sonner (`sonner` package) in `dashboard/components/ui/sonner.tsx`
- Toaster component is included in the root layout at `dashboard/app/layout.tsx`

### Implementation Location

- **File to modify**: `dashboard/app/dashboard/users/page.tsx`
- **Function**: `handleAddWorker`
- **Toast library**: `sonner` (already imported as `toast` in other components)

### Toast Message Format

Suggested message:

```
"Worker created. Invitation will be sent to {workerEmail}"
```

Or more detailed:

```
"Worker created successfully. An invitation email will be sent to {workerEmail}"
```

> **Note**: The message uses "will be sent" rather than "has been sent" because worker creation and email sending are separate operations. The edge function creates the worker record and triggers the email asynchronously, so we cannot guarantee email delivery at the moment the toast appears.

### Example Implementation

```typescript
const handleAddWorker = async (workerData: {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}) => {
  if (!organizationId) return;
  try {
    await createWorker({
      organization_id: organizationId,
      ...workerData,
    });
    toast.success(`Invitation email sent to ${workerData.email}`);
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : "Failed to create worker. Please try again."
    );
  }
};
```

## Related Components

- `dashboard/components/workers/worker-form.tsx` - Worker creation form
- `dashboard/app/dashboard/users/page.tsx` - Users page containing worker management
- `dashboard/hooks/use-workers.ts` - Workers hook managing worker operations
- `dashboard/components/ui/sonner.tsx` - Toast notification component

## Testing Considerations

1. Test successful worker creation shows success toast with correct email
2. Test error handling shows error toast appropriately
3. Verify toast appears in correct position (top-right as configured)
4. Ensure toast doesn't interfere with form submission flow

## Priority

**Priority**: Medium  
**Complexity**: Low  
**Estimated Effort**: 30 minutes

## Notes

- This is a quick win that improves UX immediately
- Uses existing toast infrastructure - no new dependencies needed
- Follows the same pattern used in other parts of the app (e.g., invoice sending, onboarding)
