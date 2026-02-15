# Dashboard Realtime Sync – Investigation & Plan

**Date:** 2025-02-15  
**Status:** Investigation complete  
**Scope:** Notifications, completed jobs, and worker updates not appearing in realtime

---

## 1. Research Summary: Best Patterns for Dashboard–DB Sync

### Supabase Realtime (Postgres Changes)

From [Supabase Postgres Changes docs](https://supabase.com/docs/guides/realtime/postgres-changes):

1. **Publication is required** – Tables must be in the `supabase_realtime` publication:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE your_table;
   ```

2. **RLS is enforced** – Realtime broadcasts only rows the subscribed user can `SELECT`. RLS policies apply to every change for every subscriber.

3. **Subscription setup:**
   - Use a unique channel name (anything except `"realtime"`).
   - Specify `schema`, `table`, and optionally `event` (`INSERT`, `UPDATE`, `DELETE`, `*`).
   - Use `filter` for row-level targeting (e.g. `receiver_id=eq.${userId}`).

4. **Fallbacks** – Recommended pattern (from your own PROJECT_LEARNINGS.md):
   - Realtime as primary
   - **Refetch on window focus** when user returns to tab
   - Optional **polling** if Realtime is unreliable

### Common Failure Modes

| Issue | Cause | Fix |
|-------|-------|-----|
| No events received | Table not in `supabase_realtime` | Add table to publication |
| No events received | Kong not routing (local Supabase only) | Upgrade CLI, `supabase stop` + `start` |
| Events skipped | RLS blocks row for user | Ensure SELECT policy allows the row |
| Subscription never SUBSCRIBED | WebSocket blocked, auth issues | Check browser console; verify JWT |
| Stale data | Realtime not mounted or delayed | Add refetch on focus / polling fallback |

---

## 2. Current Implementation vs Issues

### 2.1 Tables in Realtime Publication

| Table | In publication? | Hook | Mounted where |
|-------|-----------------|------|----------------|
| `notification` | ✅ Yes | `useRealtimeNotifications` | Via `useNotifications` in `NotificationBell` (Nav) |
| `worker` | ✅ Yes | `useRealtimeWorkers` | `RealtimeSubscriptions` (DashboardLayout) |
| `job` | ❌ No | (none) | — |

### 2.2 Issue 1: Completed Jobs Require Refresh

**Root cause:** The `job` table is **not** in the `supabase_realtime` publication. There is no subscription to job changes.

**Flow today:** Mobile app completes job → edge function updates `job.completed_at` → dashboard has no subscription → user must refresh.

**Fix:** Add `job` to the publication and create `useRealtimeJobs` to invalidate the jobs cache on INSERT/UPDATE.

### 2.3 Issue 2: Job Completed – No Notification in Bell

**Two sub-issues:**

**A. Notification not created**

- `job_completed` notifications are created by the `create-job` edge function when a job is created/completed.
- Verify the create-job flow is actually inserting a notification for completed jobs (it should call `createNotification` with `type: "job_completed"`).

**B. Notification created but not reaching the client**

- Realtime subscription might not be active yet (e.g. `organizationUserId` still loading).
- RLS must allow the receiver to SELECT the new row.
- Filter `receiver_id=eq.${receiverId}` must match; `receiverId` must be the `organization_user.id` of the admin.

**Checklist:**
1. In Supabase Dashboard → Database → Publications → `supabase_realtime` → confirm `notification` is enabled.
2. In browser DevTools → Network → WS → confirm the Realtime WebSocket connects and the subscription callback logs `SUBSCRIBED`.
3. In Database → Table Editor → `notification` → confirm new rows appear when a job is completed.

### 2.4 Issue 3: Worker Active – No Notification in Nav

**Flow:** Worker accepts invitation → `accept-worker-invitation` edge function → `createNotification` with `type: "worker_active"` for each admin.

**Possible causes:**
1. Same as 2.3B – Realtime subscription or RLS.
2. `RealtimeSubscriptions` only runs `useRealtimeWorkers` (workers list), not notifications. Notifications come from `NotificationBell` → `useNotifications` → `useRealtimeNotifications`.
3. `NotificationBell` is in `Nav`, which is in the root layout, so it should mount. But `useRealtimeNotifications` requires both `organizationId` and `organizationUserId`. If `organizationUserId` is null (e.g. org not fully loaded), the subscription never starts.

---

## 3. Recommended Implementation

### Phase 1: Add Job Realtime (Completed Jobs)

1. **Migration** – Add `job` to `supabase_realtime`:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE job;
   ```
   (Use idempotent pattern like `notification` / `worker` if you prefer.)

2. **Hook** – Create `useRealtimeJobs`:
   - Subscribe to `postgres_changes` on `job` with `filter: organization_id=eq.${organizationId}`.
   - On change, invalidate `jobsKey(organizationId, includeTests)`.

3. **Integration** – Either:
   - Call `useRealtimeJobs` from `useJobs`, or
   - Add it to `RealtimeSubscriptions` (and pass `includeTests` from context if needed).

### Phase 2: Notification Realtime Debugging

1. **Logging** – Add temporary logs in `useRealtimeNotifications`:
   - When subscription status changes (especially `SUBSCRIBED` vs `CHANNEL_ERROR`).
   - When a payload is received (event type and IDs).
   - When `organizationId` or `receiverId` are null so we skip the subscription.

2. **Fallbacks** – Ensure `useNotifications`:
   - Keeps `refetchOnWindowFocus: true`.
   - Optionally add a short-interval `refetchInterval` (e.g. 30s) if Realtime is flaky.

### Phase 3: Centralize Realtime Subscriptions

Today:
- `RealtimeSubscriptions` runs `useRealtimeWorkers` only.
- `useRealtimeNotifications` runs only when `NotificationBell` (and thus `useNotifications`) is mounted.

To make notifications robust regardless of which page is open:
- Mount `useRealtimeNotifications` in `RealtimeSubscriptions` as well, using `organizationId` and `organizationUserId` from `useOrganization`.
- This keeps the notification subscription active whenever the user is in the dashboard, even if the bell is not interacted with.

### Phase 4: Verify Publication in Supabase Dashboard

If using hosted Supabase:
1. Dashboard → Database → Publications → `supabase_realtime`.
2. Confirm `notification`, `worker`, and (after Phase 1) `job` are listed.
3. If a table is missing, enable it there or run the migration.

---

## 4. Files to Touch

| File | Action |
|------|--------|
| `database/supabase/migrations/YYYYMMDD_add_job_to_realtime.sql` | Add `job` to publication |
| `dashboard/hooks/use-realtime-jobs.ts` | New hook for job changes |
| `dashboard/hooks/use-jobs.ts` | Use `useRealtimeJobs` or wire it in layout |
| `dashboard/components/realtime-subscriptions.tsx` | Add `useRealtimeJobs`, optionally `useRealtimeNotifications` |
| `dashboard/hooks/use-realtime-notifications.ts` | Add debug logs (optional, for diagnosis) |

---

## 5. Quick Diagnostic Commands

**Check publication (run in Supabase SQL Editor):**
```sql
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

**Test notification creation:**
```sql
-- After completing a job, check if a notification exists
SELECT id, type, receiver_id, created_at 
FROM notification 
WHERE type = 'job_completed' 
ORDER BY created_at DESC 
LIMIT 5;
```

**Browser console:**
- Look for `Realtime: Notifications subscription active` (subscription started).
- Look for `Realtime: Notification change received` (event received).
- Look for `CHANNEL_ERROR` (subscription failed).
