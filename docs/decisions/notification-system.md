# Notification system: architecture and reliability

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

- Confirm **migration applied** (including RLS and publication).
- In Supabase Dashboard, check **Database → Publications → supabase_realtime** includes `notification`.
- Confirm the logged-in user has an **organization_user** row with `auth_user_id` set (so `receiver_id` matches and RLS allows read).
- Check browser console for Realtime subscription errors (e.g. `RealtimeDisabledForConfiguration`, `RlsPolicyError`).
- Rely on **refetch on focus** and **30s polling** as fallbacks; the bell should still update when the user focuses the tab or waits for the next poll.

## Optional: server API route

If client-side RLS or Realtime can’t be fixed, add a Next.js API route (e.g. `GET /api/notifications`) that uses the service role (or server-side Supabase with the session) to fetch notifications for the current user and have the hook call that route instead of `NotificationService.getNotifications()`. That’s a fallback; fixing Realtime and RLS is preferable.
