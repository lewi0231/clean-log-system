# User Story 002: Notification System - Worker Becomes Active

## Overview

When a worker accepts their invitation and becomes active, admins should be notified so they can track worker onboarding progress and take appropriate action (e.g., assigning jobs, providing training materials).

## User Story

**As an** admin user  
**I want to** receive a notification when a worker becomes active  
**So that** I know the worker has completed onboarding and can now use the mobile app

## Acceptance Criteria

### Phase 1: Basic Notification System (MVP)

1. When a worker accepts their invitation (becomes active), a notification is created for all admins in the organization
2. Notifications are stored in a database table with the following attributes:
   - `id` (primary key)
   - `organization_id` (foreign key)
   - `receiver_id` (user ID - can be null for organization-wide notifications)
   - `type` (enum: e.g., 'worker_active', 'job_completed', etc.)
   - `title` (string)
   - `message` (text)
   - `related_entity_type` (string, e.g., 'worker')
   - `related_entity_id` (string, e.g., worker ID)
   - `read` (boolean, default false)
   - `created_at` (timestamp)
   - `read_at` (timestamp, nullable)
3. Notifications are displayed in the dashboard (notification center/icon)
4. Unread notifications show a badge count
5. Users can mark notifications as read
6. Notifications persist in the database (not ephemeral like toasts)

### Phase 2: Enhanced Features (Future)

- Notification preferences (users can opt-in/opt-out of notification types)
- Email notifications for critical events (configurable)
- Real-time updates using Supabase Realtime
- Notification grouping/grouping similar notifications
- Notification history/pagination
- Archive/dismiss functionality

## Technical Details

### Current Implementation Context

- Worker becomes active in `database/supabase/functions/accept-worker-invitation/index.ts`
- The `worker.active` field is set to `true` when invitation is accepted (line 75)
- Currently, no notification mechanism exists for this event

### Database Schema Design

#### Notifications Table

```sql
CREATE TABLE notification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES organization_user(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- e.g., 'worker_active', 'job_completed', 'invoice_generated'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity_type TEXT, -- e.g., 'worker', 'job', 'invoice'
  related_entity_id UUID,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT notification_type_check CHECK (type IN ('worker_active', 'job_completed', 'invoice_generated', 'payment_received'))
);

-- Index for efficient queries
CREATE INDEX idx_notification_organization_receiver ON notification(organization_id, receiver_id, read, created_at DESC);
CREATE INDEX idx_notification_related_entity ON notification(related_entity_type, related_entity_id);

-- RLS Policies
ALTER TABLE notification ENABLE ROW LEVEL SECURITY;

-- NOTE: This codebase primarily accesses data through Edge Functions using the
-- service role key (see createServiceRoleClient()), following the existing pattern.
-- The organization_user table has auth_user_id (not a direct mapping from id to auth.uid()).

CREATE POLICY "Service role can manage notification"
  ON notification
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
```

> **Schema Note**: Table names follow the existing singular convention (`organization`, `worker`, `job`, etc.) rather than plural. The `organization_user` table uses `auth_user_id` to link to Supabase Auth users, not the `id` column directly.

### Implementation Steps

#### Step 1: Create Notification Helper Function

Create a shared utility function in `database/supabase/functions/_utils/notifications.ts`:

```typescript
export interface CreateNotificationParams {
  organization_id: string;
  receiver_id?: string; // null for all admins in org
  type:
    | "worker_active"
    | "job_completed"
    | "invoice_generated"
    | "payment_received";
  title: string;
  message: string;
  related_entity_type?: string;
  related_entity_id?: string;
}

export async function createNotification(
  supabase: SupabaseClient,
  params: CreateNotificationParams
): Promise<{ success: boolean; error?: string }> {
  // If receiver_id is not specified, create notifications for all admins
  if (!params.receiver_id) {
    const { data: admins, error: adminError } = await supabase
      .from("organization_user")
      .select("id")
      .eq("organization_id", params.organization_id)
      .in("role", ["admin", "owner"]);

    if (adminError) {
      return { success: false, error: adminError.message };
    }

    // Create notification for each admin
    const notifications = admins.map((admin) => ({
      organization_id: params.organization_id,
      receiver_id: admin.id,
      type: params.type,
      title: params.title,
      message: params.message,
      related_entity_type: params.related_entity_type,
      related_entity_id: params.related_entity_id,
    }));

    const { error } = await supabase
      .from("notification")
      .insert(notifications);

    if (error) {
      return { success: false, error: error.message };
    }
  } else {
    // Single notification for specific user
    const { error } = await supabase.from("notification").insert([params]);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}
```

#### Step 2: Update accept-worker-invitation Edge Function

Add notification creation when worker becomes active:

```typescript
// After worker.active is set to true (around line 75-77)
const { error: updateError } = await supabase
  .from("worker")
  .update({
    auth_user_id: authData.user.id,
    address: address,
    abn: abn,
    active: true,
  })
  .eq("id", invitation.worker.id);

if (updateError) {
  console.error("Update worker error:", updateError);
  return errorResponse("Failed to update worker", 500);
}

// Create notification for admins
const notificationResult = await createNotification(supabase, {
  organization_id: invitation.organization_id,
  type: "worker_active",
  title: "Worker Activated",
  message: `${
    invitation.worker.name || invitation.worker.email
  } has completed onboarding and is now active.`,
  related_entity_type: "worker",
  related_entity_id: invitation.worker.id,
});

if (!notificationResult.success) {
  // Log but don't fail the request - notification is non-critical
  logger.warn("Failed to create notification", {
    error: notificationResult.error,
  });
}
```

#### Step 3: Create Frontend Notification Components

- **Notification Bell Icon** with badge count (in dashboard header/nav)
- **Notification Dropdown/Modal** showing recent notifications
- **Notification List Component** with read/unread states
- **Mark as Read** functionality
- **Notification Service/Hook** for fetching and updating notifications

#### Step 4: Create Notifications Hook

`dashboard/hooks/use-notifications.ts`:

```typescript
export function useNotifications() {
  // Fetch unread count
  // Fetch notifications list
  // Mark notification as read
  // Real-time subscription for new notifications
}
```

### Notification Message Examples

**Worker Active:**

- Title: "Worker Activated"
- Message: "{Worker Name} has completed onboarding and is now active."

**Future Examples:**

- Job Completed: "{Worker Name} completed job at {Location}"
- Invoice Generated: "Invoice #{Invoice Number} generated for {Customer Name}"
- Payment Received: "Payment of ${amount} received for invoice #{Invoice Number}"

## UI/UX Design Considerations

### Notification Bell Icon

- Location: Dashboard header/navigation bar
- Badge: Red circle with unread count (similar to typical notification patterns)
- Icon: Bell icon (from lucide-react)

### Notification Dropdown/Modal

- Clicking bell opens dropdown/modal
- Shows list of notifications (newest first)
- Unread notifications have visual distinction (background color, bold text)
- Click notification to mark as read and navigate to related entity (if applicable)
- "Mark all as read" button
- "View all notifications" link (if pagination needed)

### Design Patterns (Based on Research)

1. **Event-Driven Architecture**: Notifications triggered by events (worker becomes active, job completed, etc.)
2. **User Preferences**: Allow users to opt-in/opt-out of notification types (Phase 2)
3. **Multi-Channel Support**: In-app notifications now, email in Phase 2
4. **Read/Unread State**: Clear visual distinction
5. **Related Entity Links**: Click notification to navigate to related entity
6. **Persistence**: All notifications stored in database for history

## Best Practices (From Research)

1. **User Preferences**: Eventually allow users to control notification types
2. **Non-Intrusive**: Don't interrupt workflow unless critical
3. **Actionable**: Notifications should allow quick action (e.g., view worker, view job)
4. **Grouping**: Group similar notifications to reduce noise (Phase 2)
5. **Real-time Updates**: Use Supabase Realtime for live notification updates (Phase 2)
6. **Performance**: Index database queries properly, paginate results
7. **Scalability**: Consider archiving old notifications after a period

## Related Files

- `database/supabase/functions/accept-worker-invitation/index.ts` - Where worker becomes active
- `database/supabase/migrations/` - Database migration for notifications table
- `dashboard/components/notifications/` - Frontend notification components (to be created)
- `dashboard/hooks/use-notifications.ts` - Notifications hook (to be created)
- `dashboard/components/dashboard-sidebar.tsx` or `dashboard/components/nav.tsx` - Notification bell location

## Testing Considerations

### Backend Testing

1. Test notification creation when worker becomes active
2. Test notifications are created for all admins in organization
3. Test RLS policies prevent unauthorized access
4. Test notification creation failure doesn't break worker activation

### Frontend Testing

1. Test notification badge shows correct unread count
2. Test notification dropdown displays notifications correctly
3. Test marking notifications as read
4. Test navigation to related entities
5. Test real-time updates (Phase 2)

## Priority

**Priority**: Medium  
**Complexity**: Medium-High  
**Estimated Effort**:

- Phase 1 (MVP): 4-6 hours
- Phase 2 (Enhanced): 8-12 hours

## Dependencies

- Database migration for notifications table
- Supabase RLS policies
- Frontend notification UI components
- Notification hook/service
- (Phase 2) Supabase Realtime setup
- (Phase 2) Email notification integration

## Future Enhancements

1. Notification preferences/settings page
2. Email notifications for critical events
3. Push notifications (mobile app)
4. Notification grouping/aggregation
5. Notification templates
6. Notification analytics (which notifications are most important)
7. Notification scheduling/digests
8. Notification sound/desktop notifications

## Notes

- Start with MVP (Phase 1) to validate concept
- Notification system can be extended for other events (jobs, invoices, payments)
- Consider using Supabase Realtime for live updates (Phase 2)
- Keep notifications simple initially - can add complexity later
- Follow established patterns from other SaaS platforms (Slack, GitHub, etc.)
