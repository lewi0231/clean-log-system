# Pricing Hooks – React Query Migration & Optimistic UI Plan

## Overview

Migrate the pricing hooks from `useState` + `useEffect` + blocking `await refetch()` to React Query with native optimistic updates. This aligns with [Project Learning #6](docs/decisions/PROJECT_LEARNINGS.md#6-dont-mix-useoptimistic-with-react-query) and the pattern established in mobile-config mutations.

---

## Current State Analysis

### Hooks Summary

| Hook | Data Source | Mutations | Current Pattern |
|------|-------------|-----------|------------------|
| `use-field-pricing` | `PricingService.listRules` (scope: field) | `upsertPricing`, `deletePricing` | useState + useEffect; `await fetchFieldPricing()` after every mutation |
| `use-option-pricing` | `PricingService.listRules` (scope: option) | `upsertPricing`, `deletePricing` | Same; has `skipRefetch` for bulk ops |
| `use-base-pricing` | `PricingService.listRules` (scope: base) | `upsertPricing`, `deletePricing` | Same |
| `use-pricing-history` | `PricingService.listHistory` | None | Read-only; useState + useEffect |

### Pain Points

1. **Blocking refetch** – Every upsert/delete blocks until `fetchFieldPricing()` completes, making the UI feel sluggish
2. **Inconsistent with project patterns** – Dashboard uses React Query elsewhere (see Learning #1); pricing hooks are the exception
3. **No optimistic updates** – User waits for network round-trip before seeing changes
4. **BulkPricingEditor** – Calls `PricingService.upsertRule` directly in a loop; doesn't integrate with any cache

### Key Complexity: Upsert Semantics

Pricing rules use **timeline matching** – multiple rules can exist for the same (field, location, context) with different `effective_at` dates:

- **Update**: Match by field + location + context + effective date → replace that rule
- **Create**: No match → add new rule

For optimistic updates, we must:
- **Update**: Find matching rule in cache, replace with optimistic data
- **Create**: Add new rule (with temp ID until server responds)

---

## Target Architecture

### Query Keys (add to `query-provider.tsx`)

```typescript
export const fieldPricingKey = (
  orgId: string | null,
  options?: { effectiveAt?: string | null; locationHierarchyId?: string | null; locationId?: string | null; pricingContext?: "customer" | "worker" }
): QueryKey => ["field-pricing", orgId, options?.effectiveAt ?? null, options?.locationHierarchyId ?? null, options?.locationId ?? null, options?.pricingContext ?? "customer"];

export const optionPricingKey = (
  orgId: string | null,
  fieldConfigId?: string | null,
  options?: { effectiveAt?: string | null; locationHierarchyId?: string | null; locationId?: string | null; pricingContext?: "customer" | "worker" }
): QueryKey => ["option-pricing", orgId, fieldConfigId ?? null, options?.effectiveAt ?? null, options?.locationHierarchyId ?? null, options?.locationId ?? null, options?.pricingContext ?? "customer"];

export const basePricingKey = (
  orgId: string | null,
  options?: { effectiveAt?: string | null; locationHierarchyId?: string | null; locationId?: string | null; pricingContext?: "customer" | "worker" }
): QueryKey => ["base-pricing", orgId, options?.effectiveAt ?? null, options?.locationHierarchyId ?? null, options?.locationId ?? null, options?.pricingContext ?? "customer"];

export const pricingHistoryKey = (
  orgId: string | null,
  options?: { dateFrom?: string; dateTo?: string; pricingContext?: "customer" | "worker" }
): QueryKey => ["pricing-history", orgId, options?.dateFrom ?? null, options?.dateTo ?? null, options?.pricingContext ?? null];
```

---

## Implementation Plan

### Phase 1: Add Query Keys & Migrate use-pricing-history

**Goal:** Introduce query keys and migrate the simplest hook (read-only).

**Changes:**
1. Add `fieldPricingKey`, `optionPricingKey`, `basePricingKey`, `pricingHistoryKey` to `app/query-provider.tsx`
2. Migrate `use-pricing-history.ts` to `useQuery`:
   - Replace `useState`/`useEffect` with `useQuery`
   - Return `{ historyEntries: data ?? [], loading: isLoading, error: error?.message ?? null, refetch }`

**Result:** Pricing history uses React Query; no behavior change yet.

---

### Phase 2: Migrate use-field-pricing

**Goal:** Convert to React Query with optimistic updates.

**Changes to `use-field-pricing.ts`:**

1. **Replace fetch with useQuery**
   ```typescript
   const queryKey = fieldPricingKey(organizationId, { effectiveAt: options?.effectiveAt, locationHierarchyId, locationId, pricingContext });
   const { data, isLoading, error, refetch } = useQuery({
     queryKey,
     queryFn: () => PricingService.listRules({ ... }).then(rules => rules.map(transformFieldPricing)),
     enabled: !!organizationId,
   });
   const fieldPricing = data ?? [];
   ```

2. **Add useMutation for upsert with optimistic update**
   - `onMutate`: Cancel queries, snapshot cache, optimistically update or add rule
   - `onError`: Rollback to snapshot
   - `onSettled`: Invalidate field-pricing + pricing-history

3. **Add useMutation for delete**
   - `onMutate`: Cancel, snapshot, remove rule from cache
   - `onError`: Rollback
   - `onSettled`: Invalidate both keys

4. **Upsert optimistic logic**
   - If `existingRule` found (match by field + location + context + effective date): replace in cache
   - Else: add new rule with temp ID `temp-{Date.now()}`
   - On success, server returns real rule; `invalidateQueries` refetches and replaces temp with real

5. **Unique constraint retry**
   - Keep in `onError`: if 23505/unique constraint, refetch then retry with found ID. Could also invalidate and let user retry manually—simpler but slightly worse UX.

**Interface:** Keep same `UseFieldPricingResult`; consumers unchanged.

---

### Phase 3: Migrate use-option-pricing

**Goal:** Same pattern as field pricing.

**Changes:**
1. Replace fetch with `useQuery` using `optionPricingKey(organizationId, fieldConfigId, filters)`
2. Add upsert mutation with optimistic update
3. Add delete mutation with optimistic update
4. Handle `skipRefetch` option: when true, callers (e.g. bulk ops) will invalidate manually; mutation `onSettled` still invalidates by default

**Note:** `skipRefetch` in option pricing is used by bulk operations. With React Query, the pattern becomes: mutation runs, `onSettled` invalidates. For bulk ops that call `upsertPricing` in a loop with `skipRefetch: true`, we have two options:
- **(A)** Remove `skipRefetch`; each upsert invalidates (more refetches, but simpler)
- **(B)** Add `skipInvalidation` to mutation; bulk editor does one manual `invalidateQueries` at end

Recommend **(B)** for bulk performance.

---

### Phase 4: Migrate use-base-pricing

**Goal:** Same pattern as field and option pricing.

**Changes:**
1. Replace fetch with `useQuery` using `basePricingKey`
2. Add upsert mutation with optimistic update (update-or-create logic)
3. Add delete mutation with optimistic update

**Base pricing matching:** More complex (field-based vs standalone, job_type_field_config_id, job_type_value). Reuse existing `existing` find logic; optimistic update mirrors it.

---

### Phase 5: Update BulkPricingEditor

**Goal:** Integrate with React Query cache.

**Current:** Loops and calls `PricingService.upsertRule` directly; calls `onApplied?.()` at end.

**Changes:**
1. Accept `queryClient` (or get via `useQueryClient`) and `refetch`/invalidation callback
2. After bulk loop completes: `queryClient.invalidateQueries({ queryKey: fieldPricingKey(orgId, options) })`
3. Or: use `useFieldPricing`'s `refetch` passed as `onApplied` to trigger refetch—simpler if `onApplied` is already called
4. Check current `onApplied` usage: if it triggers parent refetch, ensure parent uses the hook's refetch. With React Query, `invalidateQueries` is the correct trigger.

**Recommended:** Pass `queryClient` to `BulkPricingEditor` (or use `useQueryClient` inside). After loop: `queryClient.invalidateQueries({ queryKey: ["field-pricing", organizationId] })` (partial key to invalidate all field-pricing for org).

---

### Phase 6: Cross-invalidation

**Goal:** When pricing rules change, pricing history should refresh.

**Changes:**
1. In each mutation's `onSettled`, also invalidate:  
   `queryClient.invalidateQueries({ queryKey: ["pricing-history"] })`  
   (partial key to invalidate all history for the org)
2. Or use a shared prefix if we add one; partial key `["pricing-history"]` may be too broad. Safer:  
   `queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "pricing-history" })`  
   or define `pricingHistoryKey` with orgId and invalidate that specific key.

**Simpler:** In `onSettled` for field/option/base mutations:
```typescript
queryClient.invalidateQueries({ queryKey: pricingHistoryKey(organizationId) });
```
But `pricingHistoryKey` includes dateFrom/dateTo. We don't have those in the mutation context. Options:
- Invalidate all: `queryClient.invalidateQueries({ queryKey: ["pricing-history", organizationId] })` — use a base key
- Or: `queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "pricing-history" && q.queryKey[1] === organizationId })`

Adjust query key design so a prefix match works: `["pricing-history", orgId, ...]` then  
`queryClient.invalidateQueries({ queryKey: ["pricing-history", organizationId] })` invalidates all history for that org.

---

## Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `app/query-provider.tsx` | 1 | Add fieldPricingKey, optionPricingKey, basePricingKey, pricingHistoryKey |
| `hooks/use-pricing-history.ts` | 1 | useQuery |
| `hooks/use-field-pricing.ts` | 2 | useQuery + useMutation (optimistic) |
| `hooks/use-option-pricing.ts` | 3 | useQuery + useMutation (optimistic) |
| `hooks/use-base-pricing.ts` | 4 | useQuery + useMutation (optimistic) |
| `components/pricing/bulk-pricing-editor.tsx` | 5 | Invalidate cache after bulk |
| Consumers | 1–5 | Minimal; keep same hook interfaces |

---

## Testing Strategy

1. **Unit tests:** Update mocks to provide `QueryClient`/`QueryClientProvider`; existing tests that mock `PricingService` can stay, but we need to mock `useQuery`/`useMutation` or wrap in `QueryClientProvider` and mock the service
2. **Preserve test coverage:** Ensure upsert (create vs update), delete, error handling, and refetch behavior are covered
3. **Manual:** Verify pricing page feels responsive; changes appear immediately; rollback on error

---

## Rollback Considerations

- Keep `PricingService` as-is; only the hooks change
- Hook return shapes remain the same
- If issues arise, we can revert hook-by-hook

---

## Out of Scope (for this plan)

- `use-field-pricing-card-state` – local UI state only
- `use-service-pricing-mode` – separate concern
- Changing `PricingService` API

---

## Summary

| Phase | Description |
|-------|-------------|
| 1 | Query keys + migrate use-pricing-history to useQuery |
| 2 | use-field-pricing: useQuery + optimistic mutations |
| 3 | use-option-pricing: same pattern |
| 4 | use-base-pricing: same pattern |
| 5 | BulkPricingEditor: invalidate cache after bulk |
| 6 | Cross-invalidate pricing-history when rules change |

**Estimated effort:** Medium. Main complexity is preserving upsert matching logic inside optimistic updates and handling the unique-constraint retry in field pricing.
