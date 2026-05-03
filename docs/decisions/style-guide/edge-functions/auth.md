# Edge Function Authentication

> Authorization patterns for organization-based access control.

---

## Authentication Flow

1. **Extract JWT** from Authorization header
2. **Verify user** exists in Supabase auth
3. **Check organization membership** in database
4. **Authorize** or reject request

---

## Auth Utility

```typescript
// _utils/auth.ts
import { SupabaseClient } from "@supabase/supabase-js";

interface AuthResult {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * Extract and verify the user from the request JWT
 */
async function verifyUser(req: Request, supabase: SupabaseClient): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return { success: false, error: "Missing authorization header" };
  }

  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { success: false, error: "Invalid or expired token" };
  }

  return { success: true, userId: user.id };
}

/**
 * Verify that a user is a member of an organization
 */
async function verifyOrganizationMembership(
  userId: string,
  organizationId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase
    .from("organization_user")
    .select("id")
    .eq("auth_user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("Error checking organization membership:", error);
    return false;
  }

  return data !== null;
}

/**
 * Combined helper: verify user and organization membership
 */
export async function verifyOrganizationMembershipFromRequest(
  req: Request,
  organizationId: string,
  supabase: SupabaseClient,
  _body: unknown // For potential future use
): Promise<boolean> {
  // 1. Verify user
  const authResult = await verifyUser(req, supabase);
  if (!authResult.success || !authResult.userId) {
    return false;
  }

  // 2. Verify organization membership
  return verifyOrganizationMembership(authResult.userId, organizationId, supabase);
}
```

---

## JWT + organization gate (`gateOrganizationRequest`)

For handlers that must prove **JWT-present membership** in an organization before touching tenant data (Tier 3 invoice flows and similar), use the shared wrapper instead of calling `verifyOrganizationMembershipFromRequest` directly:

- **Module:** `database/supabase/functions/_utils/gate-organization-request.ts`
- **Behavior:** builds a service-role client, runs `requireAuthenticatedOrgMember(req, organizationId, supabase)`, returns `{ ok: false, response }` on failure (401/403), otherwise `{ ok: true, ctx }` with `ctx.supabase`, `ctx.userId`, `ctx.userEmail`.
- **Logging:** logs `Unauthorized organization access attempt` when membership fails with 403.

After validation (including `organization_id` in the body where applicable), gate **before** any query that reads or mutates org-scoped rows. Keep queries constrained with `.eq("organization_id", organization_id)` even after the gate so accidental drift cannot widen scope.

When adding a **new** Edge Function directory with `index.ts`, register it in **`database/supabase/functions/functions-inventory.yaml`** (`secured` unless it matches §2.3–§2.5 in S1). CI runs **`pnpm validate:functions-inventory`** — missing rows fail the build.

---

## Usage in Functions

### Standard Protected Function

```typescript
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "update-worker" });

  try {
    const body = await req.json();
    const validation = validateRequest(updateWorkerSchema, body);
    if (!validation.success) {
      return errorResponse(validation.error, 400);
    }

    const supabase = createServiceRoleClient();

    // Verify authorization
    const isAuthorized = await verifyOrganizationMembershipFromRequest(
      req,
      validation.data.organization_id,
      supabase,
      body
    );

    if (!isAuthorized) {
      logger.warn("Unauthorized access attempt");
      return errorResponse("Unauthorized: Not a member of this organization", 403);
    }

    // Proceed with authorized operation
    const { data, error } = await supabase
      .from("worker")
      .update(validation.data)
      .eq("id", validation.data.id)
      .eq("organization_id", validation.data.organization_id)
      .select()
      .single();

    if (error) throw error;

    return jsonResponse({ success: true, worker: data });
  } catch (error) {
    logger.error("Request failed", error);
    return errorResponse(error);
  }
});
```

---

## Public vs Protected Functions

### Public Functions (No Auth)

Some functions don't require authentication:

```typescript
// validate-org-code/index.ts - Public function
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { org_code } = await req.json();

    // No auth check - anyone can validate an org code
    const supabase = createServiceRoleClient();

    const { data } = await supabase
      .from("organization")
      .select("id, name")
      .eq("org_code", org_code)
      .single();

    return jsonResponse({
      success: true,
      valid: data !== null,
      organization: data ? { id: data.id, name: data.name } : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
```

### Protected Functions (Require Auth)

Most business operations require auth:

- Creating/updating/deleting workers
- Creating/updating invoices
- Viewing organization data
- Managing settings

---

## Webhook Authentication

Webhooks from external services use different auth:

```typescript
// stripe-webhook/index.ts
import Stripe from "stripe";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return errorResponse("Missing signature", 400);
    }

    // Verify webhook signature
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      return errorResponse("Invalid signature", 400);
    }

    // Handle verified event
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutComplete(event.data.object);
        break;
      // ... other event types
    }

    return jsonResponse({ received: true });
  } catch (error) {
    return errorResponse(error);
  }
});
```

---

## Role-Based Authorization

For functions requiring specific roles:

```typescript
async function verifyAdminRole(
  userId: string,
  organizationId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase
    .from("organization_user")
    .select("role")
    .eq("auth_user_id", userId)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) return false;

  return data.role === "admin" || data.role === "owner";
}

// In function
const isAdmin = await verifyAdminRole(userId, organizationId, supabase);
if (!isAdmin) {
  return errorResponse("Admin access required", 403);
}
```

---

## Error Responses

### Standard Auth Errors

```typescript
// Missing or invalid token
return errorResponse("Unauthorized", 401);

// Valid user but not member of organization
return errorResponse("Unauthorized: Not a member of this organization", 403);

// Valid member but insufficient permissions
return errorResponse("Forbidden: Admin access required", 403);

// Invalid webhook signature
return errorResponse("Invalid signature", 400);
```

---

## Rules Summary

| Rule                         | Description                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| Always verify org membership | For any organization-scoped operation                                                                   |
| Service role client          | For database queries in auth                                                                            |
| 401 vs 403                   | 401 = no auth, 403 = auth but no access                                                                 |
| Webhook signatures           | Always verify external webhooks                                                                         |
| Log auth failures            | For security auditing                                                                                   |
| Handler pipeline             | Prefer **`serveJsonHandler`** for `secured` / `public` JSON — [handler-pipeline](./handler-pipeline.md) |
