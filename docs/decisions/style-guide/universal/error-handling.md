# Error Handling

> Universal error handling patterns that apply to all code in this monorepo.

---

## Error Message Guidelines

### User-Facing Messages

Error messages shown to users should be:
- **Clear:** Explain what went wrong
- **Actionable:** Suggest what to do next
- **Non-technical:** Avoid jargon, stack traces, or internal details

```typescript
// ✅ Good: User-friendly messages
setError("Failed to save changes. Please try again.");
setError("Unable to load workers. Check your connection and refresh.");
setError("Session expired. Please log in again.");

// ❌ Bad: Technical messages exposed to users
setError(error.message);  // "NetworkError: fetch failed at line 42"
setError("ECONNREFUSED");
setError(JSON.stringify(error));
```

### Logged Messages

Error messages logged for debugging should be:
- **Detailed:** Include context for debugging
- **Structured:** Use JSON format for searchability
- **Consistent:** Follow logging patterns

```typescript
// ✅ Good: Structured logging
log.error("WorkersService: Failed to fetch workers", {
  organizationId,
  error: err instanceof Error ? err.message : String(err),
  stack: err instanceof Error ? err.stack : undefined,
});
```

---

## Try-Catch Patterns

### Service Layer Pattern

```typescript
export class WorkersService {
  static async list(organizationId: string): Promise<Worker[]> {
    try {
      log.debug("WorkersService: Fetching workers", { organizationId });

      const { data, error } = await supabase.functions.invoke(
        "list-workers",
        { body: { organization_id: organizationId } }
      );

      if (error) throw error;
      if (!data?.success) throw new Error("Failed to fetch workers");

      log.info("WorkersService: Success", { count: data.workers.length });
      return data.workers;

    } catch (err) {
      log.error("WorkersService: Failed", {
        organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;  // Always rethrow - let caller handle
    }
  }
}
```

### Hook Pattern

```typescript
export function useWorkers(): UseWorkersResult {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      setError(null);  // Reset error before fetch
      
      const data = await WorkersService.list(organizationId);
      setWorkers(data);
      
    } catch (err) {
      // Convert to user-friendly message
      setError(
        err instanceof Error 
          ? err.message 
          : "Failed to load workers"
      );
      setWorkers([]);  // Reset data on error
      
    } finally {
      setLoading(false);  // Always runs
    }
  };

  return { workers, loading, error, refetch: fetchWorkers };
}
```

---

## Error Types

### Custom Error Classes

Define custom error classes for specific error types:

```typescript
// lib/errors.ts
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

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

// Usage
if (error instanceof EdgeFunctionError) {
  if (error.status === 403) {
    // Handle unauthorized
  }
}
```

### Error Type Checking

```typescript
// ✅ Good: Type-safe error handling
try {
  await doSomething();
} catch (err) {
  if (err instanceof EdgeFunctionError) {
    // Handle specific error type
    handleEdgeFunctionError(err);
  } else if (err instanceof Error) {
    // Handle generic Error
    log.error("Unexpected error", { message: err.message });
  } else {
    // Handle non-Error throws
    log.error("Unknown error", { error: String(err) });
  }
}
```

---

## Async Error Handling

### Promises

```typescript
// ✅ Good: async/await with try-catch
async function fetchData() {
  try {
    const result = await api.getData();
    return result;
  } catch (err) {
    handleError(err);
    throw err;
  }
}

// ✅ Good: Promise.catch for one-off handling
api.getData()
  .then(handleSuccess)
  .catch(handleError);

// ❌ Avoid: Unhandled promise rejection
api.getData().then(handleSuccess);  // No error handling!
```

### Parallel Operations

```typescript
// ✅ Good: Promise.allSettled for independent operations
const results = await Promise.allSettled([
  fetchWorkers(),
  fetchJobs(),
  fetchInvoices(),
]);

results.forEach((result, index) => {
  if (result.status === "rejected") {
    log.error(`Operation ${index} failed`, { error: result.reason });
  }
});

// ✅ Good: Promise.all when all must succeed
try {
  const [workers, jobs] = await Promise.all([
    fetchWorkers(),
    fetchJobs(),
  ]);
} catch (err) {
  // Any failure rejects all
  handleError(err);
}
```

---

## Validation Errors

### Zod Validation

```typescript
import { z } from "zod";

const workerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().optional(),
});

function validateWorker(data: unknown) {
  const result = workerSchema.safeParse(data);
  
  if (!result.success) {
    // Format errors for display
    const errors = result.error.errors.map(e => ({
      field: e.path.join("."),
      message: e.message,
    }));
    
    throw new ValidationError("Invalid worker data", errors);
  }
  
  return result.data;
}
```

---

## Error Boundaries (React)

### Component Error Boundary

```typescript
// components/error-boundary.tsx
"use client";

import { Component, ReactNode } from "react";
import { ErrorState } from "@/components/ui/error-state";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    log.error("React Error Boundary caught error", {
      error: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <ErrorState
          message="Something went wrong"
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}
```

---

## Logging Errors

### Structured Logging Pattern

```typescript
// ✅ Good: Structured, contextual logging
log.error("InvoiceService: Failed to create invoice", {
  organizationId,
  jobIds,
  error: err instanceof Error ? err.message : String(err),
  stack: err instanceof Error ? err.stack : undefined,
});

// ❌ Bad: Unstructured logging
console.error("Error:", err);
console.log("Failed to create invoice for", organizationId);
```

### Log Levels

| Level | Use Case |
|-------|----------|
| `debug` | Detailed info for debugging (not in production) |
| `info` | Normal operations (successful requests, etc.) |
| `warn` | Unexpected but handled situations |
| `error` | Failures that need attention |

```typescript
log.debug("Starting invoice calculation", { jobIds });
log.info("Invoice created successfully", { invoiceId });
log.warn("Retry attempt", { attempt: 2, maxAttempts: 3 });
log.error("Invoice creation failed", { error: err.message });
```

---

## Never Swallow Errors

```typescript
// ❌ Bad: Error swallowed silently
try {
  await doSomething();
} catch (err) {
  // Empty catch - error disappears!
}

// ❌ Bad: Error logged but not handled
try {
  await doSomething();
} catch (err) {
  console.log(err);
  // Continues as if nothing happened
}

// ✅ Good: Error handled or rethrown
try {
  await doSomething();
} catch (err) {
  log.error("Operation failed", { error: err });
  throw err;  // Rethrow if caller should handle
}

// ✅ Good: Error handled with fallback
try {
  const data = await fetchData();
  return data;
} catch (err) {
  log.warn("Fetch failed, using cached data", { error: err });
  return cachedData;  // Explicit fallback
}
```

---

## Rules Summary

| Rule | Description |
|------|-------------|
| User messages | Clear, actionable, non-technical |
| Logged messages | Detailed, structured, consistent |
| Always rethrow in services | Let caller decide how to handle |
| Reset state on error | Clear data, set error message |
| Use `finally` | For cleanup that must run |
| Custom error classes | For specific error types |
| Type-check errors | Use `instanceof` checks |
| Never swallow | Always log or rethrow |
| Structured logging | JSON format with context |
