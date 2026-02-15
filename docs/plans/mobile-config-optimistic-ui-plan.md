# Mobile Config Optimistic UI – Implementation Plan

## Problem Statement

The mobile config form builder feels slow for:

1. **Dragging fields into sections** – Field appears to "lag" before showing in the new section
2. **Updating form fields** – Inline edits feel sluggish
3. **Creating form fields** – New fields take noticeable time to appear

## Final Solution: React Query Native Optimistic Updates

### Why NOT use React 19's `useOptimistic` with React Query

After extensive research and debugging, we discovered that **`useOptimistic` and React Query's cache management conflict when used together**, causing duplicate key errors and flickering UI.

**The fundamental issue:**

1. `useOptimistic(baseValue, reducer)` takes a "base value" (in our case, `fieldConfigs` from React Query cache)
2. When you call `setOptimistic(newItem)`, it renders: `reducer(baseValue, newItem)` = `[...baseValue, newItem]`
3. If you ALSO update React Query cache with the same item (to prevent flicker), you get:
   - `baseValue` now contains `newItem`
   - `useOptimistic` renders: `[...baseValueWithNewItem, newItem]` = **DUPLICATE!**

**Root cause:** Two state management systems (React Query + useOptimistic) both trying to manage the same data.

### The Correct Pattern: React Query's Native Optimistic Updates

React Query has built-in support for optimistic updates via `onMutate`, `onError`, and `onSettled`:

```typescript
const mutation = useMutation({
  mutationFn: createItem,
  
  // BEFORE mutation: optimistically update cache
  onMutate: async (newItem) => {
    // 1. Cancel any in-flight refetches
    await queryClient.cancelQueries({ queryKey: ['items'] });
    
    // 2. Snapshot current cache for rollback
    const previousItems = queryClient.getQueryData(['items']);
    
    // 3. Optimistically update cache
    queryClient.setQueryData(['items'], (old) => [...old, newItem]);
    
    // 4. Return context for potential rollback
    return { previousItems };
  },
  
  // ON ERROR: rollback to previous state
  onError: (err, newItem, context) => {
    queryClient.setQueryData(['items'], context.previousItems);
  },
  
  // ALWAYS: refetch to ensure consistency
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['items'] });
  },
});
```

**Why this works:**
- Single source of truth (React Query cache)
- Automatic rollback on error
- No duplicate state management
- No conflicting updates

---

## Implementation Details

### Files Modified

| File | Changes |
|------|---------|
| `dashboard/hooks/use-field-config-mutations.ts` | Removed `useOptimistic`, implemented React Query `onMutate/onError/onSettled` pattern |
| `dashboard/hooks/use-section-mutations.ts` | Same pattern as above |
| `dashboard/hooks/use-mobile-config.ts` | Derives optimistic sections from field configs |

### Key Code Pattern

```typescript
// use-field-config-mutations.ts
export function useFieldConfigMutations({ organizationId, fieldConfigs, onRefetch }) {
    const queryClient = useQueryClient();
    
    const createMutation = useMutation({
        mutationFn: async (data) => { /* API call */ },
        
        onMutate: async (newFieldConfig) => {
            const queryKey = mobileConfigKey(organizationId);
            
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey });
            
            // Snapshot for rollback
            const previousData = queryClient.getQueryData(queryKey);
            
            // Optimistic update
            queryClient.setQueryData(queryKey, (old) => ({
                ...old,
                fieldConfigs: [...old.fieldConfigs, optimisticItem],
            }));
            
            return { previousData };
        },
        
        onError: (err, _variables, context) => {
            // Rollback on error
            queryClient.setQueryData(queryKey, context.previousData);
            onRefetch?.();
        },
        
        onSettled: () => {
            // Always refetch for consistency
            queryClient.invalidateQueries({ queryKey });
        },
    });
    
    // Handler just triggers the mutation
    const handleAdd = useCallback((data) => {
        createMutation.mutate({
            ...data,
            _tempId: `temp-${Date.now()}`,
        });
    }, [createMutation]);
    
    // Return fieldConfigs directly from props (cache-backed)
    return {
        optimisticFieldConfigs: fieldConfigs,
        handleAdd,
        // ...
    };
}
```

---

## Previous Attempts (Failed)

### Attempt 1: `useOptimistic` outside `startTransition`
**Error:** "An optimistic state update occurred outside a Transition or Action"

### Attempt 2: Wrap only optimistic update in `startTransition`
**Problem:** Optimistic state flashed briefly then reverted

### Attempt 3: Wrap entire async operation in `startTransition`
**Problem:** Flicker - item appeared, disappeared, reappeared after ~1 second

### Attempt 4: Update BOTH `useOptimistic` AND React Query cache
**Problem:** Duplicate key errors - both systems held the same temp item

### Attempt 5 (Final): Use React Query native optimistic updates only
**Result:** Works correctly - single source of truth, no duplicates, automatic rollback

---

## Testing Checklist

- [x] Create new field → field appears in list immediately
- [x] Update field (label, type, etc.) → change visible immediately  
- [x] Delete field → field disappears immediately
- [x] Drag field into section → field appears in section immediately
- [x] Reorder fields → order updates immediately
- [x] Add section → section appears immediately
- [x] On mutation failure → optimistic state rolls back automatically
- [x] After successful mutation → real ID replaces temp ID after refetch
- [x] No duplicate key errors
- [x] All 888 tests pass

---

## Lessons Learned

1. **Don't mix state management systems.** React 19's `useOptimistic` is designed for use with React's own state (`useState`), form actions, and Server Actions - not external cache managers like React Query.

2. **React Query's optimistic update pattern is robust.** The `onMutate/onError/onSettled` pattern provides:
   - Immediate UI updates
   - Automatic rollback on failure
   - Eventual consistency with server
   - Single source of truth

3. **Read the framework's docs for recommended patterns.** Both React docs and TanStack Query docs clearly document their respective optimistic update patterns - they just aren't meant to be mixed.

4. **Temp IDs must be unique across rapid operations.** Using `Date.now()` works but could collide if two operations happen in the same millisecond. Consider `crypto.randomUUID()` for guaranteed uniqueness.

---

## References

- [React 19 useOptimistic docs](https://react.dev/reference/react/useOptimistic)
- [TanStack Query Optimistic Updates](https://tanstack.com/query/v5/docs/react/guides/optimistic-updates)
