# Project Learnings: JobFlow

This document captures project-specific learnings that complement the universal Agent Excellence Framework.

| Document Info         |            |
| --------------------- | ---------- |
| **Framework Version** | 4.8.1      |
| **Project**           | JobFlow    |
| **Created**           | 2026-01-31 |
| **Last Updated**      | 2026-04-12 |

---

## Learnings Index

| #   | Title                                                                               | Tag         | Date       |
| --- | ----------------------------------------------------------------------------------- | ----------- | ---------- |
| 1   | Always use React Query (useQuery) for data fetching                                 | react       | 2026-02-14 |
| 2   | Real-time pattern: Supabase + React Query invalidation                              | real-time   | 2026-02-14 |
| 3   | Job Colleague Confirmation Workflow                                                 | workflow    | 2026-02-14 |
| 4   | Deno TypeScript Strict Literal Type Narrowing                                       | typescript  | 2026-02-14 |
| 5   | Testing React Components with Tooltips in Vitest                                    | testing     | 2026-02-14 |
| 6   | Don't mix useOptimistic with React Query                                            | react       | 2026-02-15 |
| 7   | Dashboard logging: use `log` / `createLogger`, not `console.*`                      | engineering | 2026-04-11 |
| 8   | In-app notifications: end-to-end checklist (worker_active, bell, RLS, Realtime)     | real-time   | 2026-04-11 |
| 9   | Supplementary help: prefer `ContextualHelp` over hover `Tooltip` when a click is OK | ui          | 2026-04-12 |

---

## Learnings

### 1. Always use React Query (useQuery) for data fetching

**Date:** 2026-02-14  
**Tag:** `react`

**Context:**  
The dashboard previously had inconsistent patterns for data fetching - some hooks used `useState` + `useEffect` while others used React Query (`useQuery`).

**Learning:**  
Always use `useQuery` from TanStack React Query for server state management. Benefits:

- Automatic caching and deduplication
- Built-in loading/error states
- Background refetching
- Optimistic updates via mutations
- Consistent pattern across the codebase
- Works well with real-time subscriptions (see Learning #2)

**Don't:**

```typescript
// ❌ Manual state management
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
useEffect(() => {
  fetchData()
    .then(setData)
    .finally(() => setLoading(false));
}, []);
```

**Do:**

```typescript
// ✅ React Query
const query = useQuery({
  queryKey: ["my-data", id],
  queryFn: () => fetchData(id),
});
```

---

### 2. Real-time pattern: Supabase + React Query invalidation

**Date:** 2026-02-14  
**Tag:** `real-time`

**Context:**  
Needed real-time updates in the dashboard (e.g., worker status changes, notifications) without manual refresh.

**Learning:**  
Combine Supabase Realtime subscriptions with React Query cache invalidation:

1. **Enable table for realtime** in migrations:

   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE my_table;
   ```

2. **Create a dedicated realtime hook** that invalidates the query cache:

   ```typescript
   // hooks/use-realtime-my-entity.ts
   export function useRealtimeMyEntity(orgId: string | null) {
     const queryClient = useQueryClient();

     useEffect(() => {
       if (!orgId) return;

       const channel = supabase
         .channel(`my-entity:${orgId}`)
         .on(
           "postgres_changes",
           {
             event: "*", // INSERT, UPDATE, DELETE
             schema: "public",
             table: "my_table",
             filter: `organization_id=eq.${orgId}`,
           },
           () => {
             queryClient.invalidateQueries({
               queryKey: myEntityKey(orgId),
             });
           }
         )
         .subscribe();

       return () => void supabase.removeChannel(channel);
     }, [orgId, queryClient]);
   }
   ```

3. **Use the realtime hook** in your data hook:

   ```typescript
   export function useMyEntity() {
     const { organizationId } = useOrganization();

     // Subscribe to real-time changes
     useRealtimeMyEntity(organizationId);

     // Fetch data with React Query
     const query = useQuery({...});
   }
   ```

**Benefits:**

- Single source of truth (React Query cache)
- Automatic refetch on real-time events
- Clean separation of concerns
- Proper cleanup on unmount

---

### 3. Job Colleague Confirmation Workflow

**Date:** 2026-02-14  
**Tag:** `workflow`

**Context:**  
When a worker submits a job with colleagues (other workers), those colleagues need to confirm their participation before the job is finalized for payment/invoicing.

**Learning:**  
Implemented a confirmation workflow with the following key design decisions:

1. **Job statuses:** `approved`, `pending`, `flagged`, `cancelled`
2. **Per-worker confirmation:** Each `job_worker` has `confirmation_status` (confirmed/pending/flagged)
3. **Auto-approve:** Jobs auto-approve after a configurable timeout (org setting, default 24h)
4. **Edit window:** Submitter can withdraw within 3 hours (fixed)
5. **Single-worker jobs bypass:** Jobs without colleagues are auto-approved immediately

**Key files:**

- User story: `docs/user_stories/jobs/008-job-colleague-confirmation-workflow.md`
- Migration: `database/supabase/migrations/20260214100000_job_colleague_confirmation_workflow.sql`
- Edge functions: `confirm-job-participation`, `flag-job`, `withdraw-job`, `resolve-flagged-job`, `auto-approve-jobs`, `list-pending-confirmations`
- Dashboard: `flagged-jobs-alert.tsx`, `job-status-badge.tsx`
- Mobile: `pending-confirmations.tsx`, `use-pending-confirmations-count.ts`

**Organization setting:**

- `colleague_confirmation_timeout_hours` (1-168, default 24)

---

### 4. Deno TypeScript Strict Literal Type Narrowing

**Date:** 2026-02-14  
**Tag:** `typescript`

**Context:**  
When writing Deno tests for Supabase Edge Functions, TypeScript's strict type checking caused errors when comparing string literal values.

**Learning:**  
Deno's TypeScript compiler performs aggressive literal type narrowing. When you assign a string literal to a `const`, it becomes that specific literal type, not `string`. This causes TS2367 errors ("This comparison appears to be unintentional") when comparing two different literal values.

**Don't:**

```typescript
// ❌ TypeScript narrows to literal types
const status = "approved";
const canProcess = status === "pending"; // TS2367: Types have no overlap
```

**Do:**

```typescript
// ✅ Explicitly type as string
const status: string = "approved";
const canProcess = status === "pending"; // Works

// ✅ Or use type assertion in comparison
const status = "approved";
const canProcess = (status as string) === "pending"; // Works
```

**When to use each approach:**

- Use `: string` type annotation when the variable will be compared multiple times
- Use `as string` when you need a one-off comparison
- This is only needed in tests where you're testing logic with different status values

---

### 5. Testing React Components with Tooltips in Vitest

**Date:** 2026-02-14  
**Tag:** `testing`

**Context:**  
Testing tooltip interactions in React components using `@testing-library/react` and Vitest was failing because JSDOM doesn't properly render tooltip content on hover.

**Learning:**  
Instead of testing tooltip content visibility (which requires complex async waiting and may not work in JSDOM), test for tooltip trigger presence:

**Don't:**

```typescript
// ❌ Unreliable in JSDOM
await user.hover(screen.getByText("Pending"));
await waitFor(() => {
  expect(screen.getByText("Tooltip content")).toBeInTheDocument();
});
```

**Do:**

```typescript
// ✅ Test that tooltip trigger is properly configured
const badge = screen.getByText("Pending").closest("div");
expect(badge).toHaveAttribute("data-state"); // Radix tooltip marker
```

**Alternative approaches:**

- Mock the tooltip component entirely
- Use integration/E2E tests for tooltip content verification
- Test the data passed to the tooltip rather than the rendered content

---

### 6. Don't mix useOptimistic with React Query

**Date:** 2026-02-15  
**Tag:** `react`

**Context:**  
Implemented optimistic UI for the form builder (create/update/delete field configs) using React 19's `useOptimistic` hook alongside React Query. This caused duplicate key errors and flickering UI.

**Learning:**  
**Never use React 19's `useOptimistic` with React Query.** They are two competing state management systems that conflict when managing the same data.

**Why they conflict:**

1. `useOptimistic(baseValue, reducer)` takes a "base value" - in our case, `fieldConfigs` from React Query cache
2. When you call the optimistic setter, it renders: `reducer(baseValue, newItem)` = `[...baseValue, newItem]`
3. If you also update React Query cache (to prevent flicker), you get:
   - `baseValue` now contains `newItem`
   - `useOptimistic` renders: `[...baseValueWithNewItem, newItem]` = **DUPLICATE!**

**Don't:**

```typescript
// ❌ Two state systems fighting each other
const [optimisticItems, setOptimistic] = useOptimistic(
  items, // from React Query cache
  (state, newItem) => [...state, newItem]
);

const handleAdd = (data) => {
  startTransition(async () => {
    setOptimistic(newItem); // Updates optimistic state
    queryClient.setQueryData(key /* also adds newItem */); // CONFLICT!
    await mutation.mutateAsync(data);
  });
};
```

**Do:**

```typescript
// ✅ React Query native optimistic updates
const mutation = useMutation({
  mutationFn: createItem,

  onMutate: async (newItem) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ["items"] });

    // Snapshot for rollback
    const previousData = queryClient.getQueryData(["items"]);

    // Optimistically update cache
    queryClient.setQueryData(["items"], (old) => [...old, newItem]);

    return { previousData };
  },

  onError: (err, vars, context) => {
    // Rollback on failure
    queryClient.setQueryData(["items"], context.previousData);
  },

  onSettled: () => {
    // Refetch for consistency
    queryClient.invalidateQueries({ queryKey: ["items"] });
  },
});

// Handler just triggers the mutation
const handleAdd = (data) => {
  mutation.mutate({ ...data, _tempId: `temp-${Date.now()}` });
};
```

**When to use each:**

| Pattern                          | Use When                                                |
| -------------------------------- | ------------------------------------------------------- |
| React Query `onMutate`           | You're already using React Query for data fetching      |
| React 19 `useOptimistic`         | You're using React state (`useState`) or Server Actions |
| Server Actions + `useOptimistic` | Next.js App Router with Server Components               |

**Key files:**

- `dashboard/hooks/use-field-config-mutations.ts` - React Query pattern
- `dashboard/hooks/use-section-mutations.ts` - React Query pattern
- `docs/plans/mobile-config-optimistic-ui-plan.md` - Full investigation details

---

### 7. Dashboard logging: use `log` / `createLogger`, not `console.*`

**Date:** 2026-04-11  
**Tag:** `engineering`

**Context:**  
Ad-hoc `console.log` / `console.error` is hard to tune per environment, clutters production, and bypasses a single place for future hooks (e.g. Sentry breadcrumbs).

**Learning:**  
Use the shared module `dashboard/lib/logger.ts` (`loglevel`-based):

- Import `log` or `createLogger("ScopeName")` from `@/lib/logger`.
- Adjust verbosity with `LOG_LEVEL` or `NEXT_PUBLIC_LOG_LEVEL` (`trace` | `debug` | `info` | `warn` | `error` | `silent`). Default: `debug` in development, `warn` in production.
- **Do not** add new `console.*` calls in application code; tests and Vitest setup may still use `console` where useful.

**See also:** `docs/code-quality-alignment.md` (Prettier, Husky, ESLint `no-console` on the dashboard).

---

### 8. In-app notifications: end-to-end checklist (worker activation → nav bell)

**Date:** 2026-04-11  
**Tag:** `real-time`

**Context:**  
When a worker accepts an invitation, the admin should see an in-app notification (nav bell) without refresh. Several layers must align: Edge Function insert, RLS, Realtime, and dashboard identity.

**How it is wired (worker activated):**

1. **Insert:** `accept-worker-invitation` calls `createNotification()` in `_utils/notifications.ts` with type `worker_active`. No `receiver_id` → one row per **admin** and **owner** in `organization_user` for that org (`role IN ('admin','owner')`).
2. **Read (dashboard):** `NotificationService.getNotifications` filters `organization_id` + `receiver_id` where `receiver_id` is the logged-in user’s **`organization_user.id`** (not auth user UUID).
3. **Identity:** `useOrganization()` must return **`organizationUserId`** from `get-organization-id`. If it is `null`, `useNotifications` does not run (`enabled: false`) and **Realtime does not subscribe** — the bell stays empty.
4. **RLS:** Policies allow `SELECT`/`UPDATE` only when `receiver_id` is in `(SELECT id FROM organization_user WHERE auth_user_id = auth.uid())`. So each admin row in `organization_user` **must have `auth_user_id` set** to their Supabase Auth user id, or they will see **no rows** and Realtime will **not** deliver `postgres_changes` for those rows.
5. **Realtime:** Table `notification` is in `supabase_realtime` publication (see migrations). `useRealtimeNotifications` subscribes with `filter: receiver_id=eq.<organizationUserId>`. Supabase delivers events only for rows the user may `SELECT` under RLS.

**Likely failure modes:**

| Symptom                                  | What to verify                                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bell never loads / always empty          | `organizationUserId` from `get-organization-id` (admin email → `organization_user` row).                                                                                        |
| Query returns empty but rows exist in DB | RLS: `organization_user.auth_user_id` for that admin matches `auth.uid()`. Run backfill if needed (see migration `20260128130000_backfill_organization_user_auth_user_id.sql`). |
| Realtime never fires                     | Same RLS visibility; confirm publication includes `notification`; check browser Network/Realtime for `CHANNEL_ERROR`.                                                           |
| Only some admins get notified            | `createNotification` without `receiver_id` only targets **admin** and **owner** — not `viewer`.                                                                                 |

**Key files:**  
`database/supabase/functions/accept-worker-invitation/index.ts`, `_utils/notifications.ts`, `dashboard/hooks/use-notifications.ts`, `use-realtime-notifications.ts`, `useOrganization.ts`, migrations `*notification*`.

**Worker list refresh without manual reload:**  
`useRealtimeWorkers` is mounted once from `RealtimeSubscriptions` in the dashboard layout. Do **not** also call `useRealtimeWorkers` from `use-workers-locations` (duplicate channels). Use `queryClient.invalidateQueries({ queryKey: workersLocationsKey(orgId), refetchType: "active" })` on worker `postgres_changes`. As a backup, when a **`worker_active`** (or **`worker_created`**) notification row is inserted, invalidate the same query so the Users → Workers table updates even if worker-table realtime is delayed.

**Progressive disclosure for helper copy:**  
Use `ContextualHelp` (`dashboard/components/ui/contextual-help.tsx`) — icon opens a popover — instead of always-visible paragraphs for experienced users. For **optional explanations** (not one-line labels), also prefer it over `Tooltip` when a click/tap is acceptable; see Learning #9.

---

### 9. Supplementary help: prefer `ContextualHelp` over hover `Tooltip` when a click is OK

**Date:** 2026-04-12  
**Tag:** `ui`

**Context:**  
The Scope card used `HelpCircle` + Radix `Tooltip` beside field labels. Hover works for desktop with a mouse, but it is easy to miss, harder on touch, and long copy is awkward in a small floating layer.

**Learning:**  
For **supplementary** explanations (how a field works, a paragraph of context), use **`ContextualHelp`** (`dashboard/components/ui/contextual-help.tsx`) — the circle-help icon opens a **popover** on **click/press** so keyboard, screen reader, and mobile users get the same affordance.

| Pattern                           | Prefer when                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **`ContextualHelp`**              | Longer copy, onboarding hints, or anything where deliberate open/close is fine                                   |
| **`Tooltip` (or native `title`)** | Very short, non-critical hints on hover-only affordances, or when the design spec truly requires no click (rare) |

**Do not** replace `Tooltip` on components that are **only** a hover affordance and have no room for a button (e.g. some data-dense custom widgets) without checking design — the rule is: **when a click is possible, default to `ContextualHelp` for this project.**

**See:** `dashboard/components/ui/contextual-help.tsx` (component docstring cites progressive disclosure and touch).

---

## Project-Specific Configuration

### Key Technologies

- Framework: Next.js dashboard + Expo mobile app + Supabase
- Database: Postgres (Supabase)
- State Management: TanStack React Query
- Real-time: Supabase Realtime (postgres_changes)
- Hosting: (not yet documented)

### Known Gotchas

- **Supabase Realtime requires publication:** Tables must be added to `supabase_realtime` publication for `postgres_changes` to work
- **React Query staleTime:** Default is 2 minutes (see `query-provider.tsx`); override for time-sensitive data like notifications
- **Always clean up subscriptions:** Use `supabase.removeChannel()` in useEffect cleanup
- **Notifications + RLS:** Realtime `postgres_changes` only delivers notification rows the user can `SELECT`; ensure `organization_user.auth_user_id` is set for dashboard admins (see Learning #8)

### Database Migrations

- **NEVER edit an existing migration that has been applied.** Migrations are immutable once deployed. If you need to change schema, create a NEW migration file with the changes.
- **How to check if a migration has been applied:** Query `supabase_migrations.schema_migrations` table or check `supabase migration list` output.
- **Safe pattern:** Always create new migrations for schema changes. Use idempotent statements (e.g., `IF NOT EXISTS`, `DO $$ ... END $$`) when adding to publications or creating indexes that might already exist.
- **Example of idempotent publication addition:**
  ```sql
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'your_table'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE your_table;
    END IF;
  END $$;
  ```

---

_Project Learnings for JobFlow_
_Framework: @scainet-enterprise/agent-excellence v4.8.1_
