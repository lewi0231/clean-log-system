# Supabase Edge Function Testing Guide

## Overview

Supabase Edge Functions run in Deno, not Node.js. Therefore, we need to use Deno's built-in test runner instead of vitest.

## Test Setup

### 1. Deno Test Runner

Deno has a built-in test runner that we should use:

```typescript
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

Deno.test("test name", async () => {
  assertEquals(actual, expected);
});
```

### 2. Running Tests

```bash
# Run all tests in a directory
deno test --allow-all database/supabase/functions/_utils/__tests__/

# Run a specific test file
deno test --allow-all database/supabase/functions/_utils/__tests__/invoice-email.test.ts

# Run with watch mode
deno test --allow-all --watch database/supabase/functions/_utils/__tests__/
```

### 3. Test Structure

Tests should be organized in `__tests__/` directories within the function or utils directories:

```
database/supabase/functions/
├── _utils/
│   ├── invoice-email.ts
│   └── __tests__/
│       └── invoice-email.test.ts
├── auto-send-invoices/
│   ├── index.ts
│   └── __tests__/
│       └── auto-send-invoices.test.ts
```

### 4. Mocking Supabase Client

Since Edge Functions use Supabase clients, we need to mock them:

```typescript
const createMockSupabase = () => {
  let mockResponse: { data: unknown; error: unknown } | null = null;

  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => mockResponse || { data: null, error: null },
        }),
      }),
    }),
    _setMockResponse: (response: { data: unknown; error: unknown }) => {
      mockResponse = response;
    },
  } as unknown as SupabaseClient;
};
```

### 5. Test Organization

Use `Deno.test` for individual tests. Group related tests with descriptive names:

```typescript
Deno.test("Feature - should do something", async () => {
  // Test implementation
});

Deno.test("Feature - should handle edge case", async () => {
  // Test implementation
});
```

## Migration from Vitest

If you have existing vitest tests, convert them:

### Before (Vitest):

```typescript
import { describe, it, expect } from "vitest";

describe("Feature", () => {
  it("should work", () => {
    expect(result).toBe(expected);
  });
});
```

### After (Deno):

```typescript
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

Deno.test("Feature - should work", async () => {
  assertEquals(result, expected);
});
```

## Common Assertions

Deno's standard library provides these assertions:

```typescript
import {
  assertEquals,
  assertNotEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.208.0/assert/mod.ts";

// Equality
assertEquals(actual, expected);

// Existence
assertExists(value);

// Exceptions
await assertRejects(async () => {
  await someAsyncFunction();
}, Error);

assertThrows(() => {
  someFunction();
}, Error);
```

## Best Practices

1. **Use descriptive test names**: Include the feature and expected behavior
2. **Mock external dependencies**: Mock Supabase clients, HTTP requests, etc.
3. **Clean up after tests**: Reset mocks between tests
4. **Test edge cases**: Include null, undefined, empty values
5. **Group related tests**: Use consistent naming patterns

## Example Test File

```typescript
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { myFunction } from "../my-function.ts";

Deno.test("myFunction - should return correct value", async () => {
  const result = await myFunction("input");
  assertEquals(result, "expected");
});

Deno.test("myFunction - should handle null input", async () => {
  const result = await myFunction(null);
  assertEquals(result, null);
});
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Test Edge Functions
  run: |
    deno test --allow-all database/supabase/functions/**/__tests__/*.test.ts
```

## Resources

- [Deno Testing Documentation](https://deno.land/manual/basics/testing)
- [Supabase Edge Functions Testing](https://supabase.com/docs/guides/functions/unit-test)
