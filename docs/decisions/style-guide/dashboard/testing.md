# Dashboard Testing

> Vitest and React Testing Library patterns for the dashboard.

---

## Test Setup

### Configuration

```typescript
// vitest.config.mts
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
    pool: "threads",
    // Exclude integration tests by default
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/__tests__/integration/**",
    ],
    coverage: {
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

### Global Setup

```typescript
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";

// Mock Supabase globally
vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  },
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
```

---

## Running Tests

```bash
# Unit tests (excludes integration tests)
pnpm test              # Watch mode
pnpm test -- --run     # Single run

# With coverage
pnpm test:coverage

# Specific file
pnpm test workers.service

# Integration tests (requires local Supabase)
cd database && supabase start
pnpm test:integration
```

---

## Testing Services

```typescript
// __tests__/lib/services/workers.service.test.ts
import { WorkersService } from "@/lib/services/workers.service";
import { supabase } from "@/lib/supabase";
import { createMockWorker } from "../fixtures";

vi.mock("@/lib/supabase", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe("WorkersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should return workers on success", async () => {
      // Arrange
      const mockWorkers = [createMockWorker()];
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true, workers: mockWorkers },
        error: null,
      });

      // Act
      const result = await WorkersService.list("org-1");

      // Assert
      expect(result).toEqual(mockWorkers);
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        "list-workers",
        { body: { organization_id: "org-1" } }
      );
    });

    it("should throw on API error", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: "Network error", status: 500 },
      });

      await expect(WorkersService.list("org-1"))
        .rejects.toThrow("Network error");
    });

    it("should throw when data missing", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true },  // No workers property
        error: null,
      });

      await expect(WorkersService.list("org-1"))
        .rejects.toThrow("Failed to fetch workers");
    });
  });
});
```

---

## Testing Hooks

### QueryClient Wrapper

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";

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
```

### Hook Test Example

```typescript
// __tests__/hooks/use-workers.test.tsx
import { renderHook, waitFor } from "@testing-library/react";
import { useWorkers } from "@/hooks/use-workers";
import { WorkersService } from "@/lib/services";
import { createMockWorker } from "../lib/fixtures";

vi.mock("@/lib/services", () => ({
  WorkersService: { list: vi.fn() },
}));

vi.mock("@/hooks/useOrganization", () => ({
  default: () => ({ organizationId: "org-1", loading: false }),
}));

describe("useWorkers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch workers on mount", async () => {
    const mockWorkers = [createMockWorker()];
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

  it("should handle error state", async () => {
    vi.mocked(WorkersService.list).mockRejectedValue(
      new Error("Failed to fetch")
    );

    const { result } = renderHook(() => useWorkers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.workers).toEqual([]);
  });
});
```

---

## Testing Components

### Basic Component Test

```typescript
// __tests__/components/workers/worker-card.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkerCard } from "@/components/workers/worker-card";
import { createMockWorker } from "../../lib/fixtures";

describe("WorkerCard", () => {
  const mockWorker = createMockWorker();

  it("should render worker details", () => {
    render(<WorkerCard worker={mockWorker} />);

    expect(screen.getByText(mockWorker.name)).toBeInTheDocument();
    expect(screen.getByText(mockWorker.email)).toBeInTheDocument();
  });

  it("should call onEdit when edit button clicked", async () => {
    const onEdit = vi.fn();
    render(<WorkerCard worker={mockWorker} onEdit={onEdit} />);

    await userEvent.click(screen.getByRole("button", { name: /edit/i }));

    expect(onEdit).toHaveBeenCalledWith(mockWorker.id);
  });

  it("should render inactive state", () => {
    const inactiveWorker = createMockWorker({ active: false });
    render(<WorkerCard worker={inactiveWorker} />);

    expect(screen.getByText(/inactive/i)).toBeInTheDocument();
  });
});
```

### Testing with Providers

```typescript
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OrganizationProvider>
        {ui}
      </OrganizationProvider>
    </QueryClientProvider>
  );
}

describe("WorkerList", () => {
  it("should render workers", async () => {
    vi.mocked(WorkersService.list).mockResolvedValue([createMockWorker()]);

    renderWithProviders(<WorkerList />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
  });
});
```

---

## Testing State Components

```typescript
describe("WorkerList states", () => {
  it("should show loading state", () => {
    vi.mocked(WorkersService.list).mockImplementation(
      () => new Promise(() => {})  // Never resolves
    );

    renderWithProviders(<WorkerList />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("should show error state", async () => {
    vi.mocked(WorkersService.list).mockRejectedValue(
      new Error("Failed to load")
    );

    renderWithProviders(<WorkerList />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it("should show empty state", async () => {
    vi.mocked(WorkersService.list).mockResolvedValue([]);

    renderWithProviders(<WorkerList />);

    await waitFor(() => {
      expect(screen.getByText(/no workers/i)).toBeInTheDocument();
    });
  });
});
```

---

## Test Fixtures

```typescript
// __tests__/lib/fixtures.ts
import type { Worker, Job, Invoice } from "@clean-log/shared";

export function createMockWorker(overrides?: Partial<Worker>): Worker {
  return {
    id: "worker-1",
    organization_id: "org-1",
    name: "John Doe",
    email: "john@example.com",
    phone: "1234567890",
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

export function createMockInvoice(overrides?: Partial<Invoice>): Invoice {
  return {
    id: "invoice-1",
    organization_id: "org-1",
    invoice_number: "INV-001",
    status: "draft",
    total: 1000,
    currency: "AUD",
    created_at: "2024-01-15T10:00:00Z",
    ...overrides,
  };
}
```

---

## Integration Tests

Integration tests require a running local Supabase instance.

```typescript
// __tests__/integration/payment-flow.test.ts
import { setupTestDatabase, cleanupTestDatabase } from "./test-db-helpers";

describe("Full Payment Flow", () => {
  let testData: TestDataIds;

  beforeAll(async () => {
    testData = await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase(testData);
  });

  it("should complete full payment flow", async () => {
    // Create invoice
    const invoice = await InvoiceService.create({
      organization_id: testData.organizationId,
      job_ids: [testData.jobId],
      due_date: "2024-02-01",
    });

    expect(invoice.status).toBe("draft");

    // Send invoice
    await InvoiceService.updateStatus(invoice.id, "sent");

    // ... test payment webhook, etc.
  });
});
```

### Running Integration Tests

```bash
# Start local Supabase
cd database && supabase start

# Run integration tests
pnpm test:integration

# With Stripe webhook
pnpm test:integration:with-webhook
```

---

## Common Patterns

### Mocking Organization Context

```typescript
const mockUseOrganization = vi.hoisted(() =>
  vi.fn(() => ({
    organizationId: "org-1",
    loading: false,
    error: null,
  }))
);

vi.mock("@/hooks/useOrganization", () => ({
  default: mockUseOrganization,
}));

// Change mock for specific test
it("should handle no organization", () => {
  mockUseOrganization.mockReturnValue({
    organizationId: null,
    loading: false,
    error: null,
  });

  // Test...
});
```

### Testing Async Behavior

```typescript
it("should handle async operation", async () => {
  const user = userEvent.setup();
  render(<AsyncComponent />);

  // Click button that triggers async action
  await user.click(screen.getByRole("button", { name: /save/i }));

  // Wait for success message
  await waitFor(() => {
    expect(screen.getByText(/saved/i)).toBeInTheDocument();
  });
});
```

---

## Rules Summary

| Rule | Description |
|------|-------------|
| `vitest.setup.ts` | Global mocks for Supabase, logger |
| Fixtures | Use factory functions, not inline data |
| AAA pattern | Arrange, Act, Assert |
| `createWrapper()` | QueryClient wrapper for hook tests |
| `waitFor()` | Async state updates |
| Semantic queries | Role, label, text over test IDs |
| Integration tests | Require local Supabase |
| 80% coverage | Target for unit tests |
