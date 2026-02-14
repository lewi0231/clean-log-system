# Project Learnings: JobFlow

This document captures project-specific learnings that complement the universal Agent Excellence Framework.

| Document Info         |                       |
| --------------------- | --------------------- |
| **Framework Version** | 4.8.1                 |
| **Project**           | JobFlow |
| **Created**           | 2026-01-31      |
| **Last Updated**      | 2026-02-14      |

---

## Learnings Index

| #   | Title                                          | Tag        | Date       |
| --- | ---------------------------------------------- | ---------- | ---------- |
| 1   | Always use React Query (useQuery) for data fetching | react      | 2026-02-14 |
| 2   | Real-time pattern: Supabase + React Query invalidation | real-time  | 2026-02-14 |
| 3   | Job Colleague Confirmation Workflow | workflow   | 2026-02-14 |
| 4   | Deno TypeScript Strict Literal Type Narrowing | typescript | 2026-02-14 |
| 5   | Testing React Components with Tooltips in Vitest | testing    | 2026-02-14 |

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
  fetchData().then(setData).finally(() => setLoading(false));
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
         .on("postgres_changes", {
           event: "*", // INSERT, UPDATE, DELETE
           schema: "public",
           table: "my_table",
           filter: `organization_id=eq.${orgId}`,
         }, () => {
           queryClient.invalidateQueries({
             queryKey: myEntityKey(orgId),
           });
         })
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

---

_Project Learnings for JobFlow_
_Framework: @scainet-enterprise/agent-excellence v4.8.1_
