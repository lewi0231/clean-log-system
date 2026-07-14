# Edge Function Structure

> Standard structure and organization for Supabase Edge Functions.

Oversized handlers: extract orchestration under **`<function>/handlers/`** per [split-handlers.md](./split-handlers.md).

---

## Function Template

Every edge function follows this structure:

```typescript
// create-worker/index.ts
import { serve } from "server";
import { handleCors, jsonResponse, errorResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { createLogger } from "../_utils/logger.ts";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import { validateRequest } from "../_utils/validation.ts";
import { createWorkerSchema } from "../_utils/zod-schemas.ts";

serve(async (req) => {
  // 1. CORS preflight handling
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // 2. Create logger with function context
  const logger = createLogger(req, { functionName: "create-worker" });

  try {
    // 3. Parse and validate request body
    const body = await req.json();
    const validation = validateRequest(createWorkerSchema, body);
    if (!validation.success) {
      return errorResponse(validation.error, 400);
    }

    // 4. Create Supabase client and verify authorization
    const supabase = createServiceRoleClient();
    const isAuthorized = await verifyOrganizationMembershipFromRequest(
      req,
      validation.data.organization_id,
      supabase,
      body
    );

    if (!isAuthorized) {
      return errorResponse("Unauthorized: Not a member of this organization", 403);
    }

    // 5. Execute business logic
    const { data, error } = await supabase
      .from("worker")
      .insert({
        organization_id: validation.data.organization_id,
        name: validation.data.name,
        email: validation.data.email,
        phone: validation.data.phone,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info("Worker created", { workerId: data.id });

    // 6. Return success response
    return jsonResponse({
      success: true,
      worker: data,
    });
  } catch (error) {
    logger.error("Failed to create worker", error);
    return errorResponse(error);
  }
});
```

---

## Execution Order

The order of operations in an edge function is critical:

1. **CORS Handling** - Must be first to handle preflight requests
2. **Logger Setup** - Create logger for request tracking
3. **Request Validation** - Validate body with Zod before any processing
4. **Authentication** - Verify organization membership
5. **Business Logic** - Perform the actual operation
6. **Response** - Return structured JSON response

---

## Per-Function Dependencies

Each function has its own `deno.json` for dependency management:

```json
// create-worker/deno.json
{
  "imports": {
    "server": "jsr:@supabase/functions-js/server",
    "@supabase/supabase-js": "jsr:@supabase/supabase-js@2",
    "zod": "npm:zod@^3.23.8"
  }
}
```

### Required Dependencies

| Import                  | Source                              | Purpose         |
| ----------------------- | ----------------------------------- | --------------- |
| `server`                | `jsr:@supabase/functions-js/server` | HTTP server     |
| `@supabase/supabase-js` | `jsr:@supabase/supabase-js@2`       | Database client |
| `zod`                   | `npm:zod@^3.23.8`                   | Validation      |

---

## Shared Utilities (`_utils/`)

### HTTP Utilities

```typescript
// _utils/http.ts

/**
 * Handle CORS preflight requests
 */
export function handleCors(req: Request): Response | null {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return null;
}

/**
 * Create a JSON success response
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * Create an error response
 */
export function errorResponse(error: unknown, status = 500): Response {
  const message = error instanceof Error ? error.message : String(error);

  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
```

### Supabase Client

```typescript
// _utils/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Create a Supabase client with service role key
 * This bypasses RLS for admin operations
 */
export function createServiceRoleClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
```

### Logger

```typescript
// _utils/logger.ts

interface LogContext {
  functionName: string;
  requestId?: string;
}

export function createLogger(req: Request, context: LogContext) {
  const requestId = crypto.randomUUID();

  const log = (level: string, message: string, data?: unknown) => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        functionName: context.functionName,
        requestId,
        message,
        ...(data && { data }),
      })
    );
  };

  return {
    debug: (msg: string, data?: unknown) => log("DEBUG", msg, data),
    info: (msg: string, data?: unknown) => log("INFO", msg, data),
    warn: (msg: string, data?: unknown) => log("WARN", msg, data),
    error: (msg: string, data?: unknown) => log("ERROR", msg, data),
  };
}
```

---

## Function Naming

### Directory Naming

Functions use kebab-case directory names matching the operation:

```
create-worker/
update-worker/
delete-worker/
list-workers/
get-worker-details/
calculate-invoice/
send-invoice-email/
```

### Function Categories

| Category      | Examples                                                          |
| ------------- | ----------------------------------------------------------------- |
| **CRUD**      | `create-worker`, `update-worker`, `delete-worker`, `list-workers` |
| **Actions**   | `send-invoice-email`, `calculate-invoice`, `process-payment`      |
| **Webhooks**  | `stripe-webhook`, `resend-webhook`                                |
| **Utilities** | `generate-report`, `validate-org-code`                            |

---

## Response Format

### Success Response

```typescript
return jsonResponse({
  success: true,
  worker: data, // Single entity
  // OR
  workers: data, // Collection
  pagination: {
    // Optional pagination
    total: 100,
    page: 1,
    pageSize: 20,
  },
});
```

### Error Response

```typescript
return errorResponse("Validation failed: name is required", 400);
// Results in:
// { "success": false, "error": "Validation failed: name is required" }
```

---

## Environment Variables

Access via `Deno.env.get()`:

```typescript
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
```

**Available in Supabase:**

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Custom (set in Supabase dashboard):**

- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`
- etc.

---

## Rules Summary

| Rule                   | Description                         |
| ---------------------- | ----------------------------------- |
| CORS first             | Always handle before other logic    |
| Per-function deno.json | Each function specifies its deps    |
| Service role client    | For database operations             |
| Structured logging     | JSON format with context            |
| Consistent responses   | `{ success, data/error }` format    |
| kebab-case names       | `create-worker`, not `createWorker` |
