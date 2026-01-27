# Dashboard Hooks

> Custom React hooks patterns for the Next.js dashboard.

---

## Hook Categories

| Category | Count | Purpose | Examples |
|----------|-------|---------|----------|
| Data Fetching | 18 | Fetch and cache data | `useWorkers`, `useInvoices` |
| Mutations | 6 | Create/update/delete | `useFieldConfigMutations` |
| UI State | 8 | Local UI state | `useSidebar`, `useMediaQuery` |
| Auth/Context | 4 | App-wide state | `useOrganization`, `useAuth` |

---

## Preferred Use of Hooks

### When to Use Hooks vs. Props

**Prefer props over context hooks in reusable and leaf components** (dialogs, modals, forms, cards). This keeps components testable, flexible, and explicit about dependencies.

| Situation | Use | Rationale |
|-----------|-----|-----------|
| Dialog, modal, or form used in multiple places | **Props** (e.g. `organizationId`, `onSuccess`) | No provider mocks in tests; can be used in any parent |
| Page, layout, or top-level route component | **Context hooks** (`useOrganization`, `useAuth`) | Guaranteed to be inside providers |
| Component that owns data-fetching for its subtree | **Data-fetching hooks** (`useWorkers`, `useInvoices`) | Encapsulates fetch + cache |
| Child component when parent already has the data | **Props** | Avoid duplicate fetches and extra provider requirements |

### Context hooks (useOrganization, useAuth)

- **Use at:** Page/layout level or in components that are direct children of the provider.
- **Avoid in:** Dialogs, modals, reusable forms, and shared UI that may be rendered outside the provider or need to be tested in isolation.

```typescript
// ❌ Avoid: context hook inside a reusable dialog
function MarkPaymentPaidDialog({ open, onOpenChange, batchId }: Props) {
  const { organizationId } = useOrganization();  // Tight coupling, harder to test
  // ...
}

// ✅ Prefer: accept organizationId as a prop from the parent
interface MarkPaymentPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  organizationId: string | null;  // Parent (page) provides this
  onSuccess?: () => void;
}
function MarkPaymentPaidDialog({ organizationId, ... }: MarkPaymentPaidDialogProps) {
  if (!organizationId) {
    toast.error("Organization ID is required");
    return;
  }
  // ...
}
```

The **page** calls `useOrganization()` and passes `organizationId` into the dialog:

```typescript
// Page/layout: use the context hook here
function WorkerPaymentsPage() {
  const { organizationId } = useOrganization();
  return (
    <>
      {/* ... */}
      <MarkPaymentPaidDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        batchId={selectedBatchId}
        organizationId={organizationId}
        onSuccess={refetch}
      />
    </>
  );
}
```

### Data-fetching hooks

- **Use when:** The component is responsible for fetching and owns the cache for that data.
- **Prefer props when:** A parent already has the data (e.g. from `useWorkers()`) — pass it down instead of calling the hook again in the child.

### Summary

| Question | Answer |
|----------|--------|
| Dialog or reusable form needs `organizationId`? | Pass as prop from parent; parent uses `useOrganization()` |
| Page or layout needs org/auth? | Use `useOrganization()` or `useAuth()` |
| Component needs to fetch and cache list data? | Use a data-fetching hook |
| Parent already has the data? | Pass as props, don’t call the hook in the child |

---

## Standard Hook Structure

### Return Type Interface

All hooks MUST define and return an explicit result interface:

```typescript
interface UseWorkersResult {
  workers: Worker[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWorkers(): UseWorkersResult {
  // Implementation
  return { workers, loading, error, refetch };
}
```

### Full Example

```typescript
import { useQuery } from "@tanstack/react-query";
import { WorkersService } from "@/lib/services";
import useOrganization from "@/hooks/useOrganization";
import type { Worker } from "@clean-log/shared";

interface UseWorkersResult {
  workers: Worker[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWorkers(): UseWorkersResult {
  const { organizationId } = useOrganization();

  const query = useQuery({
    queryKey: ["workers", organizationId],
    queryFn: () => WorkersService.list(organizationId!),
    enabled: !!organizationId,
  });

  return {
    workers: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: async () => {
      await query.refetch();
    },
  };
}
```

---

## TanStack Query Patterns

### Query Keys

Use consistent, hierarchical query keys:

```typescript
// Query key factory pattern
const workerKeys = {
  all: ["workers"] as const,
  lists: () => [...workerKeys.all, "list"] as const,
  list: (orgId: string) => [...workerKeys.lists(), orgId] as const,
  details: () => [...workerKeys.all, "detail"] as const,
  detail: (id: string) => [...workerKeys.details(), id] as const,
};

// Usage
useQuery({
  queryKey: workerKeys.list(organizationId),
  queryFn: () => WorkersService.list(organizationId),
});
```

### Query Options

```typescript
const query = useQuery({
  queryKey: ["workers", organizationId],
  queryFn: () => WorkersService.list(organizationId),
  
  // Only fetch when we have an org ID
  enabled: !!organizationId,
  
  // Cache for 5 minutes
  staleTime: 5 * 60 * 1000,
  
  // Keep in cache for 10 minutes
  gcTime: 10 * 60 * 1000,
  
  // Refetch on window focus (default: true)
  refetchOnWindowFocus: true,
  
  // Don't retry on error
  retry: false,
});
```

### Mutations

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateWorker() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: (data: CreateWorkerRequest) =>
      WorkersService.create({ ...data, organization_id: organizationId }),

    onSuccess: () => {
      // Invalidate and refetch workers list
      queryClient.invalidateQueries({
        queryKey: ["workers", organizationId],
      });
    },

    onError: (error) => {
      log.error("Failed to create worker", { error });
    },
  });
}

// Usage
const { mutate, isPending } = useCreateWorker();

const handleSubmit = (data: CreateWorkerRequest) => {
  mutate(data, {
    onSuccess: () => {
      toast.success("Worker created");
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
};
```

---

## Optimistic Updates

Use React 19's `useOptimistic` for instant UI feedback:

```typescript
import { useOptimistic } from "react";

export function useFieldConfigMutations({
  organizationId,
  fieldConfigs,
  refetch,
}: UseFieldConfigMutationsOptions) {
  const [optimisticFieldConfigs, updateOptimisticFieldConfigs] = useOptimistic(
    fieldConfigs,
    (state, action: OptimisticAction<FieldConfig>) => {
      switch (action.type) {
        case "add":
          return [...state, action.item];
        case "update":
          return state.map((item) =>
            item.id === action.item.id ? action.item : item
          );
        case "delete":
          return state.filter((item) => item.id !== action.id);
        default:
          return state;
      }
    }
  );

  const createMutation = useMutation({
    mutationFn: async (data: CreateFieldConfigRequest) => {
      // Optimistic update
      const tempId = `temp-${Date.now()}`;
      const optimisticItem = { ...data, id: tempId } as FieldConfig;
      updateOptimisticFieldConfigs({ type: "add", item: optimisticItem });

      // Actual API call
      const result = await FieldConfigsService.create(data);
      return result;
    },
    onSuccess: () => {
      refetch();  // Sync with server
    },
  });

  return {
    fieldConfigs: optimisticFieldConfigs,
    createFieldConfig: createMutation.mutate,
    isCreating: createMutation.isPending,
  };
}
```

---

## Hook Composition

### Composing Multiple Hooks

```typescript
export function useDashboardData() {
  const { workers, loading: workersLoading } = useWorkers();
  const { jobs, loading: jobsLoading } = useJobs();
  const { invoices, loading: invoicesLoading } = useInvoices();

  return {
    workers,
    jobs,
    invoices,
    loading: workersLoading || jobsLoading || invoicesLoading,
  };
}
```

### Extracting Logic to Hooks

```typescript
// Before: Logic in component
function WorkerList() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date">("name");
  
  const filteredWorkers = useMemo(() => {
    return workers
      .filter(w => w.name.includes(search))
      .sort((a, b) => /* complex sort logic */);
  }, [workers, search, sortBy]);
  
  // ... more logic
}

// After: Logic in custom hook
function useWorkerFilters(workers: Worker[]) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date">("name");
  
  const filteredWorkers = useMemo(() => {
    return workers
      .filter(w => w.name.includes(search))
      .sort((a, b) => /* complex sort logic */);
  }, [workers, search, sortBy]);
  
  return { filteredWorkers, search, setSearch, sortBy, setSortBy };
}

function WorkerList() {
  const { workers } = useWorkers();
  const { filteredWorkers, search, setSearch } = useWorkerFilters(workers);
  // Cleaner component
}
```

---

## Context Hooks

### Creating Context with Hook

```typescript
// contexts/organization-context.tsx
import { createContext, useContext, useState, ReactNode } from "react";

interface OrganizationContextValue {
  organizationId: string | null;
  setOrganizationId: (id: string) => void;
  loading: boolean;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch organization on mount...

  return (
    <OrganizationContext.Provider value={{ organizationId, setOrganizationId, loading }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error("useOrganization must be used within OrganizationProvider");
  }
  return context;
}
```

---

## Hook Rules

### File Naming

```
✅ Correct:
hooks/use-workers.ts
hooks/use-invoice-details.ts
hooks/use-field-config-mutations.ts

❌ Incorrect:
hooks/useWorkers.ts
hooks/workers.ts
hooks/WorkersHook.ts
```

### Named Exports Only

```typescript
// ✅ Correct
export function useWorkers(): UseWorkersResult {
  // Implementation
}

// ❌ Incorrect
export default function useWorkers(): UseWorkersResult {
  // Implementation
}
```

### Consistent Return Shape

All data-fetching hooks should return:

```typescript
interface UseDataResult<T> {
  data: T;           // The data (with sensible default)
  loading: boolean;  // Is currently fetching
  error: string | null;  // Error message if failed
  refetch: () => Promise<void>;  // Manual refetch function
}
```

---

## Testing Hooks

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe("useWorkers", () => {
  it("should fetch workers", async () => {
    vi.mocked(WorkersService.list).mockResolvedValue(mockWorkers);

    const { result } = renderHook(() => useWorkers(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.loading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workers).toEqual(mockWorkers);
    expect(result.current.error).toBeNull();
  });
});
```

---

## Rules Summary

| Rule | Description |
|------|-------------|
| **Props over context in reusable** | Pass `organizationId` etc. as props in dialogs/modals/forms; use `useOrganization` at page/layout level |
| Return interface | All hooks define `Use[Name]Result` interface |
| Named exports | No default exports |
| kebab-case files | `use-workers.ts` |
| Consistent returns | `{ data, loading, error, refetch }` |
| Query keys | Hierarchical, use factory pattern |
| Optimistic updates | Use `useOptimistic` for instant feedback |
| Context hooks | Throw if used outside provider |
