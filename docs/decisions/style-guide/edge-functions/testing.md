# Edge Function Testing

> Deno test patterns for Supabase Edge Functions.

Pure helpers co-located with **`handlers/`** modules should be covered by **`pnpm test:edge-unit`** where practical — see [split-handlers.md](./split-handlers.md).

---

## Test Setup

### Running Tests

```bash
# From database directory
cd database

# Run all edge function tests
deno test --allow-env --allow-net supabase/functions/__tests__/

# Run specific test file
deno test --allow-env --allow-net supabase/functions/__tests__/create-worker.test.ts

# With watch mode
deno test --allow-env --allow-net --watch supabase/functions/__tests__/
```

### Deno Permissions

| Permission     | Purpose                      |
| -------------- | ---------------------------- |
| `--allow-env`  | Access environment variables |
| `--allow-net`  | Make HTTP requests           |
| `--allow-read` | Read files (if needed)       |

---

## Test Structure

### Basic Test File

```typescript
// supabase/functions/__tests__/create-worker.test.ts
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { afterAll, beforeAll, describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";

const FUNCTION_URL = "http://localhost:54321/functions/v1/create-worker";

describe("create-worker", () => {
  let authToken: string;
  let testOrgId: string;

  beforeAll(async () => {
    // Setup: Get auth token and create test organization
    authToken = await getTestAuthToken();
    testOrgId = await createTestOrganization();
  });

  afterAll(async () => {
    // Cleanup: Remove test data
    await cleanupTestOrganization(testOrgId);
  });

  it("should create a worker with valid data", async () => {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        organization_id: testOrgId,
        name: "John Doe",
        email: "john@example.com",
        phone: "1234567890",
      }),
    });

    assertEquals(response.status, 200);

    const data = await response.json();
    assertEquals(data.success, true);
    assertExists(data.worker);
    assertEquals(data.worker.name, "John Doe");
  });

  it("should return 400 for invalid data", async () => {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        organization_id: testOrgId,
        // Missing required name
        email: "invalid-email", // Invalid format
      }),
    });

    assertEquals(response.status, 400);

    const data = await response.json();
    assertEquals(data.success, false);
    assertExists(data.error);
  });

  it("should return 403 for unauthorized organization", async () => {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        organization_id: "00000000-0000-0000-0000-000000000000", // Not a member
        name: "John Doe",
        email: "john@example.com",
      }),
    });

    assertEquals(response.status, 403);
  });

  it("should return 401 without auth token", async () => {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // No Authorization header
      },
      body: JSON.stringify({
        organization_id: testOrgId,
        name: "John Doe",
        email: "john@example.com",
      }),
    });

    assertEquals(response.status, 401);
  });
});
```

---

## Test Helpers

### Auth Helper

```typescript
// supabase/functions/__tests__/helpers/auth.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://localhost:54321";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

export async function getTestAuthToken(): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: "test@example.com",
    password: "testpassword123",
  });

  if (error) throw error;
  if (!data.session?.access_token) throw new Error("No access token");

  return data.session.access_token;
}
```

### Database Helper

```typescript
// supabase/functions/__tests__/helpers/database.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://localhost:54321";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export async function createTestOrganization(): Promise<string> {
  const { data, error } = await supabase
    .from("organization")
    .insert({
      name: `Test Org ${Date.now()}`,
      org_code: `TEST${Date.now()}`,
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

export async function cleanupTestOrganization(orgId: string): Promise<void> {
  // Delete in order due to foreign keys
  await supabase.from("worker").delete().eq("organization_id", orgId);
  await supabase.from("organization_user").delete().eq("organization_id", orgId);
  await supabase.from("organization").delete().eq("id", orgId);
}
```

---

## Testing Webhooks

### Stripe Webhook Test

```typescript
// supabase/functions/__tests__/stripe-webhook.test.ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import Stripe from "npm:stripe@^14";

const FUNCTION_URL = "http://localhost:54321/functions/v1/stripe-webhook";
const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

describe("stripe-webhook", () => {
  it("should process checkout.session.completed", async () => {
    const stripe = new Stripe(STRIPE_SECRET);

    // Create mock event payload
    const payload = JSON.stringify({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          metadata: {
            invoice_id: "test-invoice-id",
          },
        },
      },
    });

    // Generate valid signature
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
      timestamp,
    });

    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": signature,
      },
      body: payload,
    });

    assertEquals(response.status, 200);
    const data = await response.json();
    assertEquals(data.received, true);
  });

  it("should reject invalid signature", async () => {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": "invalid_signature",
      },
      body: JSON.stringify({ type: "test" }),
    });

    assertEquals(response.status, 400);
  });
});
```

---

## Unit Testing Utilities

### Testing Zod Schemas

```typescript
// supabase/functions/__tests__/utils/zod-schemas.test.ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { createWorkerSchema } from "../../_utils/zod-schemas.ts";

describe("createWorkerSchema", () => {
  it("should validate correct data", () => {
    const result = createWorkerSchema.safeParse({
      organization_id: "550e8400-e29b-41d4-a716-446655440000",
      name: "John Doe",
      email: "john@example.com",
      phone: "1234567890",
    });

    assertEquals(result.success, true);
  });

  it("should reject missing name", () => {
    const result = createWorkerSchema.safeParse({
      organization_id: "550e8400-e29b-41d4-a716-446655440000",
      email: "john@example.com",
    });

    assertEquals(result.success, false);
  });

  it("should reject invalid email", () => {
    const result = createWorkerSchema.safeParse({
      organization_id: "550e8400-e29b-41d4-a716-446655440000",
      name: "John Doe",
      email: "not-an-email",
    });

    assertEquals(result.success, false);
  });
});
```

---

## Local Development Testing

### Prerequisites

```bash
# Start local Supabase
cd database
supabase start

# Serve functions locally
supabase functions serve

# In another terminal, run tests
deno test --allow-env --allow-net supabase/functions/__tests__/
```

### Environment Variables

```bash
# Set for local testing
export SUPABASE_URL="http://localhost:54321"
export SUPABASE_ANON_KEY="your-local-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-local-service-key"
```

---

## Rules Summary

| Rule              | Description                             |
| ----------------- | --------------------------------------- |
| Integration tests | Test against running functions          |
| Setup/teardown    | Create and clean test data              |
| Test all paths    | Success, validation errors, auth errors |
| Mock webhooks     | Use proper signature generation         |
| Unit test utils   | Test schemas and helpers separately     |
| Local Supabase    | Required for integration tests          |
