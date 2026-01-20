# Dashboard Services

> Service layer patterns for Edge Function integration in the dashboard.

---

## Service Layer Architecture

```
Component → Hook → Service → Edge Function → Database
```

**Benefits:**
- Consistent error handling and logging
- Type-safe API contracts
- Easy to mock in tests
- Centralized API call configuration

---

## Service Structure

### Standard Service Template

```typescript
// lib/services/workers.service.ts
import { log } from "@/lib/logger";
import { invokeEdgeFunction } from "@/lib/supabase/invoke-edge-function";
import type {
  CreateWorkerRequest,
  CreateWorkerResponse,
  ListWorkersResponse,
} from "@/lib/types/api";
import type { Worker } from "@clean-log/shared";

export class WorkersService {
  /**
   * List workers for an organization
   */
  static async list(organizationId: string): Promise<Worker[]> {
    try {
      log.debug("WorkersService: Fetching workers", { organizationId });

      const data = await invokeEdgeFunction<ListWorkersResponse>(
        "list-workers",
        { organization_id: organizationId }
      );

      if (!data?.workers) {
        throw new Error("Failed to fetch workers");
      }

      log.info("WorkersService: Success", { count: data.workers.length });
      return data.workers;

    } catch (err) {
      log.error("WorkersService: Failed to fetch workers", {
        organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Create a new worker
   */
  static async create(request: CreateWorkerRequest): Promise<Worker> {
    try {
      log.debug("WorkersService: Creating worker", {
        organizationId: request.organization_id,
        name: request.name,
      });

      const data = await invokeEdgeFunction<CreateWorkerResponse>(
        "create-worker",
        request
      );

      if (!data?.worker) {
        throw new Error("Failed to create worker");
      }

      log.info("WorkersService: Worker created", { workerId: data.worker.id });
      return data.worker;

    } catch (err) {
      log.error("WorkersService: Failed to create worker", {
        organizationId: request.organization_id,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Update a worker
   */
  static async update(
    id: string,
    request: UpdateWorkerRequest
  ): Promise<Worker> {
    try {
      log.debug("WorkersService: Updating worker", { id });

      const data = await invokeEdgeFunction<UpdateWorkerResponse>(
        "update-worker",
        { id, ...request }
      );

      if (!data?.worker) {
        throw new Error("Failed to update worker");
      }

      log.info("WorkersService: Worker updated", { workerId: id });
      return data.worker;

    } catch (err) {
      log.error("WorkersService: Failed to update worker", {
        id,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Delete a worker
   */
  static async delete(id: string): Promise<void> {
    try {
      log.debug("WorkersService: Deleting worker", { id });

      await invokeEdgeFunction("delete-worker", { id });

      log.info("WorkersService: Worker deleted", { workerId: id });

    } catch (err) {
      log.error("WorkersService: Failed to delete worker", {
        id,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
```

---

## Invoking Edge Functions

### The `invokeEdgeFunction` Utility

```typescript
// lib/supabase/invoke-edge-function.ts
import { supabase } from "@/lib/supabase";
import { log } from "@/lib/logger";

export class EdgeFunctionError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = "EdgeFunctionError";
  }
}

export async function invokeEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    throw new EdgeFunctionError(
      error.message || "Edge function call failed",
      error.code || "UNKNOWN",
      error.status || 500
    );
  }

  if (!data?.success) {
    throw new EdgeFunctionError(
      data?.error || "Operation failed",
      "OPERATION_FAILED",
      400
    );
  }

  return data as T;
}
```

---

## Type Definitions

### API Request/Response Types

```typescript
// lib/types/api.ts

// Request types
export interface CreateWorkerRequest {
  organization_id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface UpdateWorkerRequest {
  name?: string;
  email?: string;
  phone?: string;
  active?: boolean;
}

export interface ListWorkersRequest {
  organization_id: string;
  include_inactive?: boolean;
}

// Response types
export interface ListWorkersResponse {
  success: boolean;
  workers: Worker[];
}

export interface CreateWorkerResponse {
  success: boolean;
  worker: Worker;
}

export interface UpdateWorkerResponse {
  success: boolean;
  worker: Worker;
}
```

---

## Barrel Exports

```typescript
// lib/services/index.ts
export { FeedbackService } from "./feedback.service";
export { FieldConfigsService } from "./field-configs.service";
export { InvoiceService } from "./invoice.service";
export { InvoiceTemplateService } from "./invoice-template.service";
export { JobsService } from "./jobs.service";
export { LocationsService } from "./locations.service";
export { NotificationService } from "./notification.service";
export { OrganizationUsersService } from "./organization-users.service";
export { PaymentService } from "./payment.service";
export { PricingService } from "./pricing.service";
export { WorkerPaymentService } from "./worker-payment.service";
export { WorkerRateCardService } from "./worker-rate-card.service";
export { WorkersService } from "./workers.service";

// Usage
import { WorkersService, JobsService } from "@/lib/services";
```

---

## Logging Pattern

### Always Log Operations

```typescript
// ✅ Good: Comprehensive logging
static async list(organizationId: string): Promise<Worker[]> {
  try {
    log.debug("WorkersService: Fetching workers", { organizationId });

    const data = await invokeEdgeFunction<ListWorkersResponse>(/*...*/);

    log.info("WorkersService: Success", { 
      organizationId,
      count: data.workers.length 
    });
    return data.workers;

  } catch (err) {
    log.error("WorkersService: Failed", {
      organizationId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
```

### Log Levels

| Level | Use Case |
|-------|----------|
| `debug` | Operation start, parameters |
| `info` | Successful completion |
| `warn` | Unexpected but handled |
| `error` | Failures |

---

## Error Handling

### Always Rethrow Errors

Services should always rethrow errors after logging - let the caller (hook/component) decide how to handle:

```typescript
// ✅ Good: Log and rethrow
catch (err) {
  log.error("WorkersService: Failed", { error: err });
  throw err;  // Caller handles user feedback
}

// ❌ Bad: Swallow error
catch (err) {
  log.error("WorkersService: Failed", { error: err });
  return [];  // Hides error from caller
}
```

### Validate Response Data

```typescript
const data = await invokeEdgeFunction<ListWorkersResponse>(/*...*/);

// ✅ Good: Validate response structure
if (!data?.workers) {
  throw new Error("Failed to fetch workers");
}

// ❌ Bad: Assume response is correct
return data.workers;  // May be undefined
```

---

## Testing Services

```typescript
// __tests__/lib/services/workers.service.test.ts
import { WorkersService } from "@/lib/services/workers.service";
import { supabase } from "@/lib/supabase";
import { createMockWorker } from "../fixtures";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("WorkersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should return workers on success", async () => {
      const mockWorkers = [createMockWorker()];
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true, workers: mockWorkers },
        error: null,
      });

      const result = await WorkersService.list("org-1");

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

    it("should throw when workers missing", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await expect(WorkersService.list("org-1"))
        .rejects.toThrow("Failed to fetch workers");
    });
  });
});
```

---

## Rules Summary

| Rule | Description |
|------|-------------|
| Static methods | Services use static methods, no instances |
| CRUD naming | `list`, `get`, `create`, `update`, `delete` |
| Log all operations | debug on start, info on success, error on failure |
| Always rethrow | Let caller handle errors |
| Validate responses | Check for expected data properties |
| Type responses | Use explicit response types |
| Barrel exports | Export from `index.ts` |
