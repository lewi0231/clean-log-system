# User Story 006: Admin In-App Notifications

## Overview

Admins need to stay informed about important events in their organization. When a worker creates a job, becomes active, or is removed; when an admin creates an invoice, sends it to a client, creates a job, or changes settings, pricing, form fields, locations, or users; when a payment is received or a client submits a review; or when a job’s status changes — the relevant admins should receive an in-app notification so they can take action or stay in sync without constantly refreshing.

This user story defines **when** notifications are sent, **who** receives them (all admins vs. other admins only), and how this fits with the existing notification system (database + Realtime + dashboard bell).

## User Story

**As an** admin user  
**I want to** receive in-app notifications when important events happen in my organization  
**So that** I stay informed and can act on new jobs, payments, reviews, and configuration changes without missing updates

## Scope: Who Gets Notified

- **All admins** (including the actor): use when the event is external (worker, client, payment provider) or when every admin should see it (e.g. worker created job, payment received, review submitted).
- **Other admins only** (exclude the actor): use when an admin performs the action so the acting admin does not need to notify themselves (e.g. admin created job, admin created invoice, admin changed settings).

The current `createNotification(supabase, { ..., receiver_id: undefined })` sends to **all** admins. For "other admins only" scenarios, the edge function (or a small helper) must resolve admin IDs, exclude the acting admin’s `organization_user.id`, and either call `createNotification` once per remaining admin or extend the utility to accept `exclude_receiver_id`.

## Notification Scenarios

### 1. Worker creates a job — all admins

When a worker submits a job (mobile or equivalent), all admins in the organization receive a notification.

- **Status**: Implemented in `create-job` edge function (`job_completed` type used for worker-submitted job).
- **Recipients**: All admins.
- **Type**: `job_completed` (or consider `job_created` if you want to distinguish worker-created vs job-completed).

### 2. Admin creates a job — other admins

When an admin creates a job via the dashboard (e.g. admin-create-job), other admins (not the creator) receive a notification.

- **Status**: Implemented in `admin-create-job` edge function; verify it excludes the acting admin.
- **Recipients**: Other admins only.
- **Type**: Same as job-related type; ensure title/message indicate "Job created (by [Name])".

### 3. Admin creates an invoice — other admins

When an admin creates an invoice (draft or sent), other admins are notified.

- **Status**: To implement.
- **Recipients**: Other admins only.
- **Type**: Add `invoice_created` (or reuse `invoice_generated` with message distinguishing creation vs auto-generation). Trigger in the edge function or path that creates the invoice.

### 4. Payment received — all admins

When a payment is recorded (Stripe webhook or manual entry), all admins are notified.

- **Status**: Implemented in `stripe-webhook` and `record-manual-payment` (`payment_received`).
- **Recipients**: All admins.
- **Type**: `payment_received`.

### 5. Client completes a review — all admins

When a client submits feedback/review (e.g. submit-feedback), all admins are notified.

- **Status**: Implemented in `submit-feedback` (`review_submitted`).
- **Recipients**: All admins.
- **Type**: `review_submitted`.

### 6. Admin alters organizational information (settings) — other admins

When an admin updates organization-level settings (name, contact info, branding, etc.), other admins are notified.

- **Status**: To implement.
- **Recipients**: Other admins only.
- **Type**: Add `settings_updated`. Trigger in the edge function or API that updates organization settings.

### 7. Admin adds or removes a form field to a section — other admins

When an admin adds, removes, or reorders a form field in a job type section, other admins are notified.

- **Status**: To implement.
- **Recipients**: Other admins only.
- **Type**: Add `form_field_updated` (or `section_config_updated`). Trigger in the edge function that updates job type / section / field config.

### 8. Admin adds a worker — other admins

When an admin invites or adds a new worker, other admins are notified.

- **Status**: To implement (worker invite flow may live in register-organization or a dedicated invite-worker function).
- **Recipients**: Other admins only.
- **Type**: Add `worker_added`. Distinguish from `worker_active` (worker became active after accepting invite).

### 9. Admin creates another admin or viewer — other admins

When an admin invites a new dashboard user (admin or viewer), other admins are notified.

- **Status**: To implement.
- **Recipients**: Other admins only.
- **Type**: Add `admin_added` or `dashboard_user_invited`. Trigger in the flow that creates the organization_user invitation (e.g. same place that sends the invitation email).

### 10. Admin adds a location, company, or region — other admins

When an admin creates or significantly updates a location, company, or region in the hierarchy, other admins are notified.

- **Status**: To implement.
- **Recipients**: Other admins only.
- **Type**: Add `location_added` or `location_hierarchy_updated`. Trigger in the edge function that creates/updates location_hierarchy (or equivalent).

### 11. Admin alters the pricing of a field — other admins

When an admin changes pricing (field pricing, base pricing, or pricing rules), other admins are notified.

- **Status**: To implement.
- **Recipients**: Other admins only.
- **Type**: Add `pricing_updated`. Trigger in the edge function(s) that update field_pricing, base_pricing, or pricing_rules.

### 12. Worker becomes active — all admins

When a worker accepts their invitation and becomes active, all admins are notified.

- **Status**: Implemented in `accept-worker-invitation` (`worker_active`).
- **Recipients**: All admins.
- **Type**: `worker_active`.

### 13. Invoice sent to client — all admins (or other admins)

When an invoice is sent (email/link) to a client, admins are notified.

- **Status**: To implement.
- **Recipients**: All admins (or other admins if the sender should be excluded).
- **Type**: Add `invoice_sent`. Trigger in the edge function or flow that sends the invoice to the client.

### 14. Job status changed — other admins

When an admin (or system) changes job status (e.g. approved, rejected, on hold), other admins are notified.

- **Status**: To implement.
- **Recipients**: Other admins only.
- **Type**: Add `job_status_updated`. Trigger in the edge function or API that updates job status.

### 15. Worker removed or deactivated — other admins

When an admin deactivates or removes a worker, other admins are notified.

- **Status**: To implement.
- **Recipients**: Other admins only.
- **Type**: Add `worker_removed` or `worker_deactivated`. Trigger in the edge function or API that deactivates/removes the worker.

### 16. Dashboard user removed or deactivated — other admins

When an admin deactivates or removes an organization_user (admin/viewer), other admins are notified.

- **Status**: To implement.
- **Recipients**: Other admins only.
- **Type**: Add `dashboard_user_removed`. Trigger in the flow that deactivates/removes the organization_user.

## Acceptance Criteria (Summary)

1. For each scenario above, the correct set of recipients (all admins vs. other admins) receives exactly one in-app notification per event.
2. Notifications appear in the dashboard notification center (bell) and respect existing RLS and Realtime (see [Notification system](../../decisions/notification-system.md)).
3. Each notification has a consistent shape: `type`, `title`, `message`, and when applicable `related_entity_type` and `related_entity_id` for deep-linking.
4. The acting admin is not notified when the scenario is "other admins only."
5. New notification types are added to the database constraint, `_utils/notifications.ts` `NotificationType`, and the dashboard `notification-list` icons and routes where applicable.

## Technical Details

### Current Implementation

- **Architecture**: [Notification system: architecture and reliability](../../decisions/notification-system.md) — database as source of truth, Realtime + refetch-on-focus + optional polling.
- **Helper**: `database/supabase/functions/_utils/notifications.ts` — `createNotification(supabase, params)`. With `receiver_id` undefined, notifications are created for all admins/owners; no built-in “exclude actor” yet.
- **Existing types** (in DB and `NotificationType`): `worker_active`, `job_completed`, `invoice_generated`, `payment_received`, `review_submitted`.
- **Dashboard**: `dashboard/hooks/use-notifications.ts`, `dashboard/lib/services/notification.service.ts`, `dashboard/components/notifications/notification-list.tsx` (icons and routes by type).

### New Notification Types to Add

Add to migration (and to `notification_type_check`), to `NotificationType` in `_utils/notifications.ts`, and to dashboard notification list icons/routes:

| Type                       | Scenario(s)                          | Recipients   |
|----------------------------|--------------------------------------|--------------|
| `invoice_created`          | Admin creates invoice                | Other admins |
| `settings_updated`         | Admin changes org settings           | Other admins |
| `form_field_updated`       | Admin adds/removes form field        | Other admins |
| `worker_added`             | Admin adds worker                    | Other admins |
| `admin_added`              | Admin invites admin/viewer           | Other admins |
| `location_added`           | Admin adds location/company/region   | Other admins |
| `pricing_updated`          | Admin changes pricing                | Other admins |
| `invoice_sent`             | Invoice sent to client               | All or other admins |
| `job_status_updated`       | Job status changed                   | Other admins |
| `worker_removed`           | Worker deactivated/removed           | Other admins |
| `dashboard_user_removed`    | Org user deactivated/removed        | Other admins |

### Implementing "Other Admins Only"

Option A (recommended): In the edge function, after resolving the current user’s `organization_user.id`:

1. Query all admin/owner `organization_user.id`s for the org.
2. Filter out the actor’s id.
3. For each remaining id, call `createNotification(supabase, { ..., receiver_id: id })`, or add a helper e.g. `createNotificationForOtherAdmins(supabase, { ... params, exclude_receiver_id: actorOrgUserId })` that does this inside `_utils/notifications.ts`.

Option B: Keep a single code path that always notifies “all admins” and add an optional `exclude_receiver_id` to `CreateNotificationParams`; in `createNotification`, when creating rows for admins, skip the excluded id. This avoids multiple inserts per admin from the caller.

### Implementation Locations (by scenario)

| Scenario                    | Trigger location (edge function or API)     |
|-----------------------------|---------------------------------------------|
| Worker creates job          | `create-job` ✅                             |
| Admin creates job          | `admin-create-job` ✅ (verify exclude actor)|
| Admin creates invoice      | Invoice creation edge function / API       |
| Payment received            | `stripe-webhook`, `record-manual-payment` ✅ |
| Client review               | `submit-feedback` ✅                        |
| Org settings updated       | Organization update edge function / API    |
| Form field updated         | Job type / section / field config function  |
| Admin adds worker          | Worker invite / register flow               |
| Admin adds admin/viewer    | Dashboard user invite flow (e.g. same as 001) |
| Location/company/region added | Location hierarchy create/update function |
| Pricing updated            | Pricing update edge function(s)             |
| Worker becomes active      | `accept-worker-invitation` ✅                |
| Invoice sent to client     | Invoice send flow (email/link to client)    |
| Job status changed         | Job status update edge function / API      |
| Worker removed/deactivated | Worker deactivate/remove flow              |
| Dashboard user removed/deactivated | Organization user deactivate/remove flow |

### Dashboard Updates

- **notification-list.tsx**: Add icon and (if needed) route for each new `Notification["type"]`.
- **notification.service.ts** / types: Ensure `Notification` type includes new types so the Record for icons remains exhaustive.

## Related Documentation

- [Notification system (architecture)](../../decisions/notification-system.md)
- [Worker notification system (worker becomes active)](../workers/002-worker-active-notification-system.md)
- [Admin user invitation (001)](./001-admin-user-invitation-creation.md) — invite flow where `admin_added` can be triggered

## Related Components

- `database/supabase/functions/_utils/notifications.ts` — notification types and `createNotification`
- `dashboard/hooks/use-notifications.ts` — fetching and Realtime
- `dashboard/lib/services/notification.service.ts` — API and types
- `dashboard/components/notifications/notification-list.tsx` — icons and navigation by type

## Testing Considerations

1. For each scenario, trigger the event and assert the correct receivers get one notification row in `notification` (and no duplicate for the same event).
2. For "other admins only" scenarios, assert the acting admin does not receive a notification.
3. Verify Realtime: second admin has dashboard open and sees the new notification without refresh.
4. Verify deep-links: `related_entity_type` and `related_entity_id` open the correct page when supported.
5. Verify RLS: each user only sees their own notifications.

## Priority

**Priority**: High  
**Complexity**: Medium (mostly adding triggers and new types; one “other admins” pattern)  
**Estimated effort**: 2–4 hours per scenario (types + trigger + dashboard icon/route); bulk migration for new types once.

## Notes

- Notifications are non-blocking: if `createNotification` fails, log and continue; do not fail the main operation.
- Keep title and message short and actionable; include actor name for "other admins" scenarios when useful (e.g. "Jane Doe created an invoice").
- Future: user preferences to opt in/out of certain notification types or channels (e.g. email) can be added later; this story focuses on in-app, per-event behavior.
