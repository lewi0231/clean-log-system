# Edge Function Tests

## Running Tests

These tests use Deno's built-in test runner (not vitest, since Edge Functions run in Deno).

```bash
# Run all tests in this directory
deno test --allow-all _utils/__tests__/

# Run a specific test file
deno test --allow-all _utils/__tests__/invoice-email.test.ts

# Run with watch mode
deno test --allow-all --watch _utils/__tests__/
```

## Test Structure

Tests are written using Deno's test API:

```typescript
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

Deno.test("test name", async () => {
  assertEquals(actual, expected);
});
```

## Mocking

Since Edge Functions interact with Supabase, we need to mock the Supabase client. See the test files for examples of how to create mock Supabase clients.

## Note

The existing `invoice-email.test.ts` file was originally written for vitest but needs to be converted to Deno's test runner. This is a work in progress.
