# Notification system: architecture and reliability

## What is `receiver_id`?

- **`receiver_id`** is the **`organization_user.id`** of the user who should see the notification (the “recipient”), not the person who triggered the event.
- For events like “job submitted”, “review received”, “invoice paid”, we notify **admins/owners**. The edge function looks up all `organization_user` rows with `role IN ('admin', 'owner')` for that org and inserts **one notification row per admin**, each with `receiver_id = that admin’s organization_user.id`.
- So every row in `notification` has `receiver_id` = an **admin’s** `organization_user.id`. The **submitter** (e.g. worker) is never used as `receiver_id`; workers don’t have `organization_user` rows unless they’re also admins. If the same person is both the submitter and an admin, one of the notification rows will have `receiver_id` = their `organization_user.id` — that’s correct (we notify all admins, including that one).
- The **dashboard** only shows notifications for the **logged-in user**: it calls `get-organization-id` with the user’s email, which returns that user’s `organization_user.id` for the current org; it then fetches notifications where `receiver_id = that id`. So the viewer only sees notifications intended for them (their own `organization_user.id`). RLS enforces the same thing: you can only read rows where `receiver_id` is in `(SELECT id FROM organization_user WHERE auth_user_id = auth.uid())`.

## How it works (no webhook needed)

The in-app notification system uses **database-as-source-of-truth** plus **push/pull** to the dashboard:

1. **Event happens** (worker submits job, client submits review, invoice paid, worker accepts invite).
2. **Edge function** inserts one row per org admin into `notification` via `createNotification()`.
3. **Dashboard** gets new notifications by:
   - **Realtime** (preferred): Supabase `postgres_changes` subscription on `notification` with `receiver_id=eq.{organizationUserId}` → refetch on INSERT.
   - **Refetch on window focus**: When the user returns to the tab, we refetch so they always see fresh data even if Realtime didn’t fire.
   - **Polling**: Every 30 seconds as a fallback.

The “notification system” is the dashboard client. The **insert into `notification` is the event**. There is no separate “webhook to tell the notification system” — Realtime (or polling/focus) delivers that event to the client.

## Why not a webhook?

- **Webhooks** are for server-to-server: “when X happens, POST to this URL.” The dashboard is a browser; it can’t receive webhooks (it’s not addressable).
- **Supabase Database Webhooks** could POST to an external URL when a row is inserted. That URL would be *our* API; we’d then need to push from that API to browsers (e.g. SSE/WebSockets and connection management). That adds moving parts. Supabase Realtime already pushes DB changes to subscribed clients.
- **Recommendation**: Rely on **Realtime + refetch-on-focus + polling**. No extra webhook layer.

## Making it reliable

1. **Realtime must be enabled for `notification`**
   - Migration `20260128100000_notification_review_submitted_and_rls.sql` adds the table to the `supabase_realtime` publication (idempotent).
   - If the migration wasn’t applied or failed, enable it manually: **Dashboard → Database → Publications → `supabase_realtime` → enable `notification`**.

2. **RLS must allow the client to read its rows**
   - Policies “Authenticated users can read own notifications” and “Authenticated users can update own notifications” restrict access by `receiver_id` = current user’s `organization_user.id`.
   - The dashboard uses the Supabase client with the user’s JWT; Realtime applies the same RLS when broadcasting.

3. **Refetch on focus**
   - `useNotifications` refetches when `window` fires `focus`, so returning to the tab always shows up-to-date notifications even if Realtime didn’t deliver.

## If notifications still don’t show

1. **RLS**: The client can only read rows where `receiver_id IN (SELECT id FROM organization_user WHERE auth_user_id = auth.uid())`. If the viewer's `organization_user` row has **`auth_user_id` NULL**, that subquery returns no rows and the client sees nothing. Fix: run the backfill migration `20260128130000_backfill_organization_user_auth_user_id.sql` (or set `auth_user_id` manually for that row).
2. **Wrong recipient id**: The dashboard fetches notifications where `receiver_id = organization_user_id` (from `get-organization-id`). That `organization_user_id` must be the **viewer's** `organization_user.id` for the current org. If `get-organization-id` returns no `organization_user_id` (e.g. worker with no org_user row), the bell will be empty. Check browser console: `NotificationService: Fetch result` shows `receiverId` and `count`; compare `receiverId` with the `receiver_id` values on the notification rows in the DB — they must match.
3. **Realtime / polling**: Confirm **migration applied** (including RLS and publication). In Supabase Dashboard, check **Database → Publications → supabase_realtime** includes `notification`. Check browser console for Realtime subscription errors. Rely on **refetch on focus** and **30s polling** as fallbacks.

## Optional: server API route

If client-side RLS or Realtime can’t be fixed, add a Next.js API route (e.g. `GET /api/notifications`) that uses the service role (or server-side Supabase with the session) to fetch notifications for the current user and have the hook call that route instead of `NotificationService.getNotifications()`. That’s a fallback; fixing Realtime and RLS is preferable.
