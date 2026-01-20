# Testing Principles

> Universal testing principles that apply to all code in this monorepo.

---

## Test Organization

### Directory Structure

Tests are placed in `__tests__/` directories that mirror the source structure:

```
lib/
├── services/
│   ├── workers.service.ts
│   └── jobs.service.ts
└── __tests__/
    └── services/
        ├── workers.service.test.ts
        └── jobs.service.test.ts

hooks/
├── use-workers.ts
└── __tests__/
    └── use-workers.test.tsx

components/
├── workers/
│   ├── worker-card.tsx
│   └── __tests__/
│       └── worker-card.test.tsx
```

### Test File Naming

```
✅ Correct:
workers.service.test.ts
use-workers.test.tsx
worker-card.test.tsx

❌ Incorrect:
workers.service.spec.ts
workersServiceTest.ts
test-workers.ts
```

---

## AAA Pattern

All tests should follow the **Arrange-Act-Assert** pattern:

```typescript
it("should return workers on success", async () => {
  // Arrange: Setup mocks and data
  const mockWorkers = [createMockWorker()];
  vi.mocked(supabase.functions.invoke).mockResolvedValue({
    data: { success: true, workers: mockWorkers },
    error: null,
  });

  // Act: Execute the code under test
  const result = await WorkersService.list("org-1");

  // Assert: Verify the outcome
  expect(result).toEqual(mockWorkers);
  expect(supabase.functions.invoke).toHaveBeenCalledWith(
    "list-workers",
    { body: { organization_id: "org-1" } }
  );
});
```

---

## Test Fixtures

### Use Factory Functions

Create consistent test data with factory functions:

```typescript
// __tests__/lib/fixtures.ts
export function createMockWorker(overrides?: Partial<Worker>): Worker {
  return {
    id: "worker-1",
    name: "John Doe",
    email: "john@example.com",
    phone: "1234567890",
    auth_user_id: null,
    active: true,
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createMockJob(overrides?: Partial<Job>): Job {
  return {
    id: "job-1",
    organization_id: "org-1",
    location_id: "location-1",
    submission_data: {},
    completed_at: "2024-01-15T10:00:00Z",
    created_at: "2024-01-15T10:00:00Z",
    ...overrides,
  };
}
```

### Using Fixtures

```typescript
// ✅ Good: Use fixtures with overrides
const worker = createMockWorker();
const workerWithEmail = createMockWorker({ email: "custom@example.com" });
const inactiveWorker = createMockWorker({ active: false });

// ❌ Bad: Inline test data
const worker = {
  id: "1",
  name: "John",
  email: "john@example.com",
  // ... 20 more fields
};
```

**Benefits:**
- Defaults provide valid data
- Overrides customize for specific tests
- Type-safe with TypeScript
- Single place to update when schema changes

---

## Mock Strategies

### Mock at Boundaries

Mock external dependencies, not internal functions:

```typescript
// ✅ Good: Mock external API (Supabase)
vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
  },
}));

// Test the service layer directly
const result = await WorkersService.list("org-1");

// ❌ Bad: Mock internal service when testing hook
vi.mock("@/lib/services/workers.service", () => ({
  WorkersService: { list: vi.fn() },
}));
// Now you're not testing the service integration
```

### Mock Response Helpers

```typescript
export function createMockSupabaseSuccess<T>(data: T) {
  return {
    data,
    error: null,
  };
}

export function createMockSupabaseError(message: string) {
  return {
    data: null,
    error: { message, status: 500 },
  };
}

// Usage
vi.mocked(supabase.functions.invoke).mockResolvedValue(
  createMockSupabaseSuccess({ success: true, workers: mockWorkers })
);
```

### Clean Up Mocks

```typescript
describe("WorkersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();  // Reset mock call history
  });

  afterEach(() => {
    vi.restoreAllMocks();  // Restore original implementations
  });

  it("test 1", () => { /* ... */ });
  it("test 2", () => { /* ... */ });
});
```

---

## Test Coverage

### Coverage Targets

| Metric | Target |
|--------|--------|
| Lines | 80% |
| Functions | 80% |
| Branches | 75% |
| Statements | 80% |

### High-Risk Code (90%+ Coverage)

Critical business logic requires higher coverage:
- Payment processing
- Pricing calculations
- Invoice generation
- Authentication/authorization
- Data mutations

### Test All Code Paths

```typescript
describe("method", () => {
  it("should handle success", () => {});
  it("should handle API error", () => {});
  it("should handle missing data", () => {});
  it("should handle null response", () => {});
  it("should handle empty array", () => {});
});
```

---

## Test Descriptions

### Use Clear, Behavior-Focused Descriptions

```typescript
// ✅ Good: Describes behavior
it("should return workers when organization exists", () => {});
it("should throw error when organization not found", () => {});
it("should filter inactive workers by default", () => {});

// ❌ Bad: Vague or implementation-focused
it("works", () => {});
it("calls the API", () => {});
it("returns data", () => {});
it("test case 1", () => {});
```

### Organize with `describe` Blocks

```typescript
describe("WorkersService", () => {
  describe("list", () => {
    it("should return workers on success", () => {});
    it("should throw on API error", () => {});
  });

  describe("create", () => {
    it("should create worker with valid data", () => {});
    it("should throw on duplicate email", () => {});
  });
});
```

---

## Async Testing

### Use `async/await`

```typescript
// ✅ Good: async/await
it("should fetch workers", async () => {
  const result = await WorkersService.list("org-1");
  expect(result).toHaveLength(2);
});

// ✅ Good: Testing rejections
it("should throw on error", async () => {
  await expect(WorkersService.list("bad-id")).rejects.toThrow("Not found");
});
```

### Use `waitFor` for React State Updates

```typescript
import { waitFor } from "@testing-library/react";

it("should load workers", async () => {
  const { result } = renderHook(() => useWorkers());

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.workers).toHaveLength(2);
});
```

---

## Testing React Hooks

### QueryClient Wrapper

```typescript
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
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

// Usage
const { result } = renderHook(() => useWorkers(), {
  wrapper: createWrapper(),
});
```

### Test All States

```typescript
describe("useWorkers", () => {
  it("should handle loading state", async () => {
    vi.mocked(WorkersService.list).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    const { result } = renderHook(() => useWorkers(), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);
  });

  it("should handle success state", async () => {
    vi.mocked(WorkersService.list).mockResolvedValue(mockWorkers);

    const { result } = renderHook(() => useWorkers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workers).toEqual(mockWorkers);
    expect(result.current.error).toBeNull();
  });

  it("should handle error state", async () => {
    vi.mocked(WorkersService.list).mockRejectedValue(new Error("Failed"));

    const { result } = renderHook(() => useWorkers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.workers).toEqual([]);
  });
});
```

---

## Testing Components

### Test User Behavior, Not Implementation

```typescript
// ✅ Good: Test what user sees
it("should display worker name", () => {
  render(<WorkerCard worker={mockWorker} />);
  expect(screen.getByText("John Doe")).toBeInTheDocument();
});

// ✅ Good: Test user interactions
it("should call onEdit when edit button clicked", async () => {
  const onEdit = vi.fn();
  render(<WorkerCard worker={mockWorker} onEdit={onEdit} />);

  await userEvent.click(screen.getByRole("button", { name: /edit/i }));
  expect(onEdit).toHaveBeenCalledWith(mockWorker.id);
});

// ❌ Bad: Testing implementation details
it("should set state correctly", () => {
  // Testing internal state instead of behavior
});
```

### Use Semantic Queries

```typescript
// ✅ Preferred: Semantic queries (order of preference)
screen.getByRole("button", { name: /submit/i });
screen.getByLabelText("Email");
screen.getByPlaceholderText("Enter email");
screen.getByText("Submit");

// ⚠️ Use sparingly: Test IDs
screen.getByTestId("submit-button");

// ❌ Avoid: Implementation-coupled queries
screen.getByClassName("btn-primary");
document.querySelector(".submit-btn");
```

---

## Deterministic Tests

### Mock Time

```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

it("should format date correctly", () => {
  const result = formatDate(new Date());
  expect(result).toBe("January 15, 2024");
});
```

### Avoid Random Data

```typescript
// ❌ Bad: Non-deterministic
const id = Math.random().toString();

// ✅ Good: Fixed test data
const id = "test-id-123";

// ✅ Good: If random needed, seed it
import { faker } from "@faker-js/faker";
faker.seed(12345);  // Same "random" data every run
```

---

## Running Tests

```bash
# Unit tests (default - no external dependencies)
pnpm test                    # Run unit tests
pnpm test -- --watch         # Watch mode
pnpm test:coverage           # With coverage report

# Integration tests (requires local Supabase)
cd database && supabase start  # Start Supabase first
pnpm test:integration          # Run integration tests

# E2E tests (Playwright)
pnpm test:e2e               # Run E2E tests
```

---

## Rules Summary

| Rule | Description |
|------|-------------|
| `__tests__/` directories | Mirror source structure |
| `.test.{ts,tsx}` extension | Consistent naming |
| AAA pattern | Arrange, Act, Assert |
| Use fixtures | Factory functions for test data |
| Mock at boundaries | External deps, not internal functions |
| Clear descriptions | Behavior-focused test names |
| `waitFor` for async | React state updates |
| Semantic queries | Role, label, text over test IDs |
| Deterministic | Mock time, avoid random |
| 80% coverage | Higher for critical code |
