# Investigation & Plan: Mobile Withdraw, Dashboard Display, Pending Confirmations, Realtime

**Date:** 2026-02-14  
**Status:** IMPLEMENTED (except realtime - requires infra fix)  
**Scope:** Job withdrawal, completed job worker_times display, pending confirmations for admin-as-worker, realtime notifications

---

## 1. Mobile App: Submitter Cannot Withdraw Job

### Root cause

**`convert-admin-to-worker` does not set `auth.users.user_metadata.worker_id`.**

The flow is:

- `create-job` uses `authUser.user_metadata?.worker_id` → sets `submitted_by_worker_id`
- `canWithdraw()` checks `job.submitted_by_worker_id === worker.id`
- `withdraw-job` uses `authUser.user_metadata?.worker_id` for auth

For **admin-as-worker**:

- Worker record is created with `auth_user_id`, but auth user `user_metadata` is never updated
- On job create: `user_metadata.worker_id` is undefined → `submitted_by_worker_id` = `null`
- `canWithdraw` fails because `null !== worker.id`
- Even if the button appeared, `withdraw-job` would fail (worker_id undefined → 403)

For **invited workers** (via `accept-worker-invitation`): `user_metadata.worker_id` is set when the auth user is created, so withdrawal works.

### Relevant code

| File | Notes |
|------|-------|
| `database/supabase/functions/convert-admin-to-worker/index.ts` | Creates worker but does not update auth `user_metadata` |
| `database/supabase/functions/accept-worker-invitation/index.ts` | Sets `user_metadata.worker_id` when creating auth user |
| `database/supabase/functions/create-job/index.ts` | Uses `user_metadata?.worker_id` for `submitted_by_worker_id` |
| `database/supabase/functions/withdraw-job/index.ts` | Uses `user_metadata?.worker_id` for auth |
| `mobile-app/app/(tabs)/jobs.tsx` | `canWithdraw()`, Withdraw button, `handleWithdraw()` |

### Proposed fix

1. In `convert-admin-to-worker`, after creating the worker record, update the auth user:
   - `supabase.auth.admin.updateUserById(orgUser.auth_user_id, { user_metadata: { ...existing, worker_id: newWorker.id } })`
2. For existing admin-as-worker users (already converted), run a one-off migration or script to set `user_metadata.worker_id` for any auth user that has a worker with matching `auth_user_id` but no `worker_id` in `user_metadata`.

### Optional: fallback to `auth_user_id` lookup

- Worker endpoints could optionally fall back to looking up `worker` by `auth_user_id` when `user_metadata.worker_id` is missing.
- This increases resilience but adds DB lookups; current plan focuses on fixing `user_metadata` at source.

---

## 2. Dashboard: Per-Worker Times Display Hard to Read

### Current behavior

When jobs have per-worker times, `submission_data.worker_times` is an array:

```json
[
  { "worker_id": "uuid-1", "start_time": "2025-02-14T10:00:00.000Z", "finish_time": "2025-02-14T18:00:00.000Z" },
  { "worker_id": "uuid-2", "start_time": "...", "finish_time": "..." }
]
```

`formatValue` treats it as a generic array of objects and renders `JSON.stringify(item, null, 2)`, so:

- Worker IDs are shown instead of names
- ISO timestamps are shown instead of readable times

### Relevant code

| File | Notes |
|------|-------|
| `dashboard/components/completed-jobs/job-detail-dialog.tsx` | `formatValue()` (lines 236–302), `submissionDataKeys` |
| `dashboard/components/completed-jobs/completed-jobs-list.tsx` | `formatValue()` for table cells |
| `mobile-app/app/(tabs)/new-entry.tsx` | Builds `worker_times` with `worker_id`, `start_time`, `finish_time` |

### Proposed fix

1. Add a special case for `worker_times` in `formatValue` (or a `formatWorkerTimes()` helper):
   - Resolve `worker_id` to worker name via `job.workers` or a lookup from workers service.
   - Format `start_time` and `finish_time` with `new Date(...).toLocaleString()` or a consistent format used for `start_time` / `finish_time`.
2. If `job.workers` is not available in the detail dialog, fetch workers for the organization and build a map `worker_id → name`.

### Data flow

- `job.workers` may already be in the job payload; confirm structure in `use-jobs` / API.
- Ensure any worker lookup can handle missing workers (e.g. deleted workers) without breaking the display.

---

## 3. Pending Confirmations Not Showing for Admin-as-Worker

### Root cause

Same as #1: `convert-admin-to-worker` never sets `user_metadata.worker_id`. `list-pending-confirmations` uses:

```ts
const workerId = authUser.user_metadata?.worker_id;
if (!workerId) {
  return errorResponse("Only workers can view pending confirmations", 403);
}
```

So admin-as-worker users get 403 and never see pending confirmations.

### Additional issue: `useAuth` does not return `session`

- `mobile-app/hooks/useAuth.ts` returns `{ user, loading, signOut }` only.
- `pending-confirmations.tsx` and `use-pending-confirmations-count.ts` use `const { user, session } = useAuth()`, so `session` is always undefined.
- With `headers: { Authorization: Bearer ${session?.access_token} }`, this becomes `"Bearer undefined"` and can cause auth failures.
- `jobs.tsx` works around this by fetching session in its own `useEffect` via `supabase.auth.getSession()` and keeping it in state.

### Relevant code

| File | Notes |
|------|-------|
| `mobile-app/hooks/useAuth.ts` | Does not return `session` |
| `mobile-app/app/(tabs)/pending-confirmations.tsx` | Uses `session` from `useAuth()` |
| `mobile-app/hooks/use-pending-confirmations-count.ts` | Same |
| `mobile-app/app/(tabs)/jobs.tsx` | Own session state via `getSession()` |
| `database/supabase/functions/list-pending-confirmations/index.ts` | Uses `user_metadata?.worker_id` |

### Proposed fix

1. Fix `user_metadata.worker_id` via `convert-admin-to-worker` (as in #1).
2. Fix session for pending confirmations:
   - Option A: Extend `useAuth` to return `session` (from `getSession()` and `onAuthStateChange`).
   - Option B: Have `pending-confirmations.tsx` and `use-pending-confirmations-count` follow the same pattern as `jobs.tsx` (own session state).

---

## 4. Realtime Notifications Not Working (Local)

### Research summary

- [Supabase #12544](https://github.com/supabase/supabase/issues/12544): Realtime subscriptions not working locally.
- [Supabase CLI #3767](https://github.com/supabase/cli/issues/3767): Kong may not have a route for `/realtime`.

### Possible causes and checks

| Area | Check | Fix to try |
|------|-------|------------|
| Kong routing | `curl -i http://localhost:54321/realtime/v1` | If you see `{"message":"no Route matched with those values"}` → Kong missing realtime route |
| Publication | Realtime enabled via migrations only | Disable then re-enable realtime for `notification` and `worker` in Supabase Studio |
| Realtime container | `docker ps` and realtime container logs | Look for DB connection errors; try `supabase stop` then `supabase start` |
| CLI / Docker | Old CLI or Docker state | Update Supabase CLI; remove containers; run `supabase init` and `supabase start` |
| Table enablement | Realtime enabled per table | In Studio: edit table → uncheck Realtime → save → enable again → save |
| Subscription lifecycle | Component unmount, duplicate channels | Use unique channel IDs; avoid reusing channel names |
| RLS | Realtime respects RLS | Ensure SELECT works for the subscribed rows |

### Verified findings (2026-02-14)

**Kong route check result:**
```bash
curl -i http://localhost:54321/realtime/v1
# HTTP/1.1 404 Not Found
# {"message":"no Route matched with those values"}
```

**Conclusion:** Kong is NOT routing to the realtime container, confirming the [Supabase CLI #3767](https://github.com/supabase/cli/issues/3767) issue. The realtime container is running (logs show activity), but it's unreachable through the API gateway.

### Recommended debugging steps

1. **Verify Kong realtime route:** (DONE - confirmed missing)
   ```bash
   curl -i http://localhost:54321/realtime/v1
   ```
   - If response is `"no Route matched"`, the realtime container runs but Kong does not route to it.
   - Workarounds: upgrade Supabase CLI, full `supabase stop` + `supabase start`, or check CLI release notes for Kong/realtime changes.

2. **Try toggling realtime in Studio:**
   - In Studio: open `notification` and `worker` → Realtime → disable → save → enable → save.
   - Migrations that add tables to `supabase_realtime` can sometimes cause this.

3. **Full restart with clean slate:**
   ```bash
   supabase stop
   # Optionally remove containers: docker rm $(docker ps -aq --filter "name=supabase")
   supabase start
   ```

4. **Update Supabase CLI:**
   ```bash
   brew upgrade supabase/tap/supabase  # or npm update -g supabase
   ```

5. **Realtime container logs:**
   ```bash
   docker logs supabase_realtime_<project_ref>
   ```
   - Look for connection errors, pool timeouts, or migration failures.

6. **Subscription status:**
   - Log the subscribe callback and check for `SUBSCRIBED` vs `CHANNEL_ERROR` / `CLOSED`.
   - Use unique channel names to avoid conflicts.

### Files

| File | Notes |
|------|-------|
| `dashboard/hooks/use-realtime-notifications.ts` | Subscribes to `notification` |
| `dashboard/hooks/use-realtime-workers.ts` | Subscribes to `worker` |
| `database/supabase/migrations/20260214000000_add_worker_to_realtime_publication.sql` | Adds `worker` to publication |
| `database/supabase/config.toml` | `[realtime] enabled = true` |

---

## 5. Implementation Order

1. **Admin-as-worker `user_metadata`** – Fix `convert-admin-to-worker` and backfill existing users.
2. **`useAuth` / session** – Fix session so pending confirmations and related flows work.
3. **Dashboard `worker_times`** – Add readable formatting for per-worker times.
4. **Realtime** – Run the debugging steps first; apply fixes only if Kong or publication issues are confirmed.

---

## 6. Summary Table

| Issue | Root cause | Primary fix | Status |
|-------|------------|-------------|--------|
| Withdraw not available | `user_metadata.worker_id` not set for admin-as-worker | Update auth in `convert-admin-to-worker` | ✅ FIXED |
| Pending confirmations missing | Same as above + `useAuth` does not return `session` | Same auth fix + fix session in useAuth | ✅ FIXED |
| `worker_times` unreadable | No special handling for `worker_times` in `formatValue` | Special-case `worker_times` with name lookup and readable times | ✅ FIXED |
| Realtime not working | Kong not routing to realtime container (CLI bug #3767) | Upgrade CLI, full restart, or toggle realtime in Studio | ⚠️ INFRA - try workarounds |

---

## 7. Implementation Summary

### Files changed:

1. **`database/supabase/functions/convert-admin-to-worker/index.ts`**
   - Added `supabase.auth.admin.updateUserById()` call after creating worker to set `user_metadata.worker_id`
   - This enables admin-as-worker users to use all worker features

2. **`mobile-app/hooks/useAuth.ts`**
   - Added `session` state and return value
   - Updated `getSession` and `onAuthStateChange` to track session
   - Other components can now use `const { user, session } = useAuth()`

3. **`mobile-app/app/(tabs)/jobs.tsx`**
   - Removed duplicate session handling (now uses `session` from `useAuth`)
   - Cleaned up unused `Session` import

4. **`dashboard/components/completed-jobs/job-detail-dialog.tsx`**
   - Added `workerNameMap` to resolve worker IDs to names
   - Added `formatTime()` helper
   - Updated `formatValue()` to accept `fieldName` parameter
   - Added special handling for `worker_times` array with readable formatting

5. **`dashboard/components/completed-jobs/completed-jobs-list.tsx`**
   - Added `formatTimeCompact()` helper for table view
   - Updated `formatValue()` to accept `jobWorkers` parameter
   - Added special handling for `worker_times` array with compact formatting
   - Updated call site to pass `job.workers`

### Existing admin-as-worker users:

For users who were already converted before this fix, their `auth.users.user_metadata.worker_id` is still missing. Options:
1. Have them log out and back in (won't help - metadata isn't set on login)
2. Run a one-off script to update auth metadata for all existing admin-as-worker users
3. They can be "re-converted" by deleting their worker and converting again
