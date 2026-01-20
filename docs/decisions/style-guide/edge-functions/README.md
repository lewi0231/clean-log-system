# Edge Functions Style Guide

> Supabase Edge Functions patterns using Deno runtime.

**Tech Stack:**
- Deno runtime
- TypeScript (strict mode)
- Supabase client libraries
- Zod for validation

---

## Documents

| Document | Description |
|----------|-------------|
| [Structure](./structure.md) | Function structure, dependencies, imports |
| [Validation](./validation.md) | Zod schemas, request validation |
| [Auth](./auth.md) | Organization membership, authorization |
| [Testing](./testing.md) | Deno test patterns |

---

## Quick Reference

### Function Structure

```typescript
import { serve } from "server";
import { handleCors, jsonResponse, errorResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { createLogger } from "../_utils/logger.ts";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import { validateRequest, workerSchema } from "../_utils/zod-schemas.ts";

serve(async (req) => {
  // 1. CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "create-worker" });

  try {
    // 2. Validate request
    const body = await req.json();
    const validation = validateRequest(workerSchema, body);
    if (!validation.success) {
      return errorResponse(validation.error, 400);
    }

    // 3. Authenticate
    const supabase = createServiceRoleClient();
    const isAuthorized = await verifyOrganizationMembershipFromRequest(
      req, validation.data.organization_id, supabase, body
    );
    if (!isAuthorized) {
      return errorResponse("Unauthorized", 403);
    }

    // 4. Business logic
    const result = await createWorker(supabase, validation.data);

    // 5. Response
    return jsonResponse({ success: true, worker: result });

  } catch (error) {
    logger.error("Request failed", error);
    return errorResponse(error);
  }
});
```

---

## Directory Structure

```
database/supabase/functions/
├── _utils/                    # Shared utilities
│   ├── auth.ts               # Authentication helpers
│   ├── http.ts               # CORS, responses
│   ├── logger.ts             # Structured logging
│   ├── supabase.ts           # Supabase client
│   └── zod-schemas.ts        # Validation schemas
├── __tests__/                # Function tests
├── create-worker/
│   ├── index.ts              # Function entry point
│   └── deno.json             # Per-function dependencies
├── list-workers/
│   ├── index.ts
│   └── deno.json
└── [function-name]/
    ├── index.ts
    └── deno.json
```

---

## Key Patterns

| Pattern | Description |
|---------|-------------|
| CORS first | Always handle CORS before other logic |
| Zod validation | Validate all request bodies |
| Organization auth | Verify membership before data access |
| Structured logging | JSON logs with context |
| Error responses | Consistent error format |
