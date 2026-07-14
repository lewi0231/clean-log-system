/**
 * Unit tests for handler-pipeline (serveJsonHandler / handleJsonRequest).
 *
 * Run from database/: deno test --allow-all supabase/functions/_utils/__tests__/handler-pipeline.test.ts
 *
 * Uses dependency injection for gates and Supabase client so tests run without env vars or network.
 */

import { assertEquals, assertExists } from "@std/assert";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "https://esm.sh/zod@3.23.8";
import type { AuthenticatedOrgMemberResult } from "../require-authenticated-org-member.ts";
import { handleJsonRequest, handleRawRequest, type JsonPipelineDeps } from "../handler-pipeline.ts";
import { errorResponse } from "../http.ts";

const VALID_ORG = "00000000-0000-4000-8000-000000000001";
const OTHER_ORG = "11111111-1111-4111-8111-111111111111";

const securedBodySchema = z.object({
  organization_id: z.string().uuid(),
});

const publicBodySchema = z.object({
  token: z.string().min(1),
});

const mockSupabase = {} as SupabaseClient;

function mockDeps(overrides: Partial<JsonPipelineDeps> = {}): JsonPipelineDeps {
  return {
    createServiceRoleClient: () => mockSupabase,
    requireAuthenticatedOrgMember: async (
      req: Request,
      organizationId: string,
      _supabase: SupabaseClient
    ): Promise<AuthenticatedOrgMemberResult> => {
      const auth = req.headers.get("authorization");
      if (!auth?.startsWith("Bearer ") || auth === "Bearer ") {
        return {
          ok: false,
          response: errorResponse("Authentication required", 401),
        };
      }
      if (auth === "Bearer no-user") {
        return { ok: false, response: errorResponse("User not found", 401) };
      }
      if (auth === "Bearer forbidden") {
        return {
          ok: false,
          response: errorResponse("You do not have permission to access this organization", 403),
        };
      }
      if (organizationId !== VALID_ORG) {
        return {
          ok: false,
          response: errorResponse("You do not have permission to access this organization", 403),
        };
      }
      return {
        ok: true,
        userId: "user-mock-1",
        userEmail: "mock@example.com",
      };
    },
    ...overrides,
  };
}

Deno.test("handleJsonRequest: OPTIONS returns CORS ok", async () => {
  const req = new Request("http://local/list-form-sections", {
    method: "OPTIONS",
  });
  const res = await handleJsonRequest(
    req,
    {
      name: "test",
      schema: securedBodySchema,
      preset: "secured",
      run: async () => new Response("should-not-run"),
    },
    mockDeps()
  );
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "ok");
  assertExists(res.headers.get("Access-Control-Allow-Origin"));
});

Deno.test("handleJsonRequest: disallowed method returns 405", async () => {
  const req = new Request("http://local/x", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organization_id: VALID_ORG }),
  });
  const res = await handleJsonRequest(
    req,
    {
      name: "test",
      schema: securedBodySchema,
      preset: "secured",
      run: async () => new Response("no"),
    },
    mockDeps()
  );
  assertEquals(res.status, 405);
  assertExists(res.headers.get("x-correlation-id"));
});

Deno.test("handleJsonRequest: custom methods allow PATCH when configured", async () => {
  const req = new Request("http://local/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organization_id: VALID_ORG }),
  });
  const res = await handleJsonRequest(
    req,
    {
      name: "test",
      schema: securedBodySchema,
      preset: "public",
      methods: ["PATCH", "POST"],
      run: async ({ body }) =>
        new Response(JSON.stringify({ echoed: body.organization_id }), {
          headers: { "Content-Type": "application/json" },
        }),
    },
    mockDeps()
  );
  assertEquals(res.status, 200);
});

Deno.test("handleJsonRequest: invalid JSON body returns 400", async () => {
  const req = new Request("http://local/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not-json",
  });
  const res = await handleJsonRequest(
    req,
    {
      name: "test",
      schema: securedBodySchema,
      preset: "secured",
      run: async () => new Response("no"),
    },
    mockDeps()
  );
  assertEquals(res.status, 400);
  const j = (await res.json()) as { detail?: string };
  assertExists(j.detail);
  assertExists(res.headers.get("x-correlation-id"));
});

Deno.test("handleJsonRequest: empty body returns 400", async () => {
  const req = new Request("http://local/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const res = await handleJsonRequest(
    req,
    {
      name: "test",
      schema: securedBodySchema,
      preset: "secured",
      run: async () => new Response("no"),
    },
    mockDeps()
  );
  assertEquals(res.status, 400);
});

Deno.test("handleJsonRequest: Zod validation failure returns 400", async () => {
  const req = new Request("http://local/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organization_id: "not-a-uuid" }),
  });
  const res = await handleJsonRequest(
    req,
    {
      name: "test",
      schema: securedBodySchema,
      preset: "secured",
      run: async () => new Response("no"),
    },
    mockDeps()
  );
  assertEquals(res.status, 400);
});

Deno.test("handleJsonRequest: secured missing auth returns 401", async () => {
  const req = new Request("http://local/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organization_id: VALID_ORG }),
  });
  const res = await handleJsonRequest(
    req,
    {
      name: "test",
      schema: securedBodySchema,
      preset: "secured",
      run: async () => new Response("no"),
    },
    mockDeps()
  );
  assertEquals(res.status, 401);
  assertExists(res.headers.get("x-correlation-id"));
});

Deno.test("handleJsonRequest: secured forbidden returns 403", async () => {
  const req = new Request("http://local/x", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer forbidden",
    },
    body: JSON.stringify({ organization_id: VALID_ORG }),
  });
  const res = await handleJsonRequest(
    req,
    {
      name: "test",
      schema: securedBodySchema,
      preset: "secured",
      run: async () => new Response("no"),
    },
    mockDeps()
  );
  assertEquals(res.status, 403);
});

Deno.test("handleJsonRequest: secured wrong organization_id returns 403", async () => {
  const req = new Request("http://local/x", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer good-token",
    },
    body: JSON.stringify({ organization_id: OTHER_ORG }),
  });
  const res = await handleJsonRequest(
    req,
    {
      name: "test",
      schema: securedBodySchema,
      preset: "secured",
      run: async () => new Response("no"),
    },
    mockDeps()
  );
  assertEquals(res.status, 403);
});

Deno.test("handleJsonRequest: secured success runs handler with auth + correlationId", async () => {
  const req = new Request("http://local/x", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer good-token",
      "x-correlation-id": "corr-from-client",
    },
    body: JSON.stringify({ organization_id: VALID_ORG }),
  });
  const deps = mockDeps({
    requireAuthenticatedOrgMember: async (_req, organizationId) => {
      assertEquals(organizationId, VALID_ORG);
      return {
        ok: true,
        userId: "user-99",
        userEmail: "x@y.com",
      };
    },
  });
  let sawAuth: { organizationId: string; userId: string } | null = null;
  const res = await handleJsonRequest(
    req,
    {
      name: "test",
      schema: securedBodySchema,
      preset: "secured",
      run: async ({ auth, correlationId }) => {
        sawAuth = {
          organizationId: auth!.organizationId,
          userId: auth!.userId,
        };
        return new Response(JSON.stringify({ correlationId }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
    deps
  );
  assertEquals(res.status, 200);
  assertEquals(sawAuth, {
    organizationId: VALID_ORG,
    userId: "user-99",
  });
  assertEquals(res.headers.get("x-correlation-id"), "corr-from-client");
});

Deno.test("handleJsonRequest: public preset runs without Authorization", async () => {
  const req = new Request("http://local/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "abc" }),
  });
  let authUndefined = false;
  const res = await handleJsonRequest(
    req,
    {
      name: "pub",
      schema: publicBodySchema,
      preset: "public",
      run: async ({ auth }) => {
        authUndefined = auth === undefined;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
    mockDeps()
  );
  assertEquals(res.status, 200);
  assertEquals(authUndefined, true);
});

Deno.test("handleJsonRequest: public invalid body returns 400 before run", async () => {
  let ran = false;
  const req = new Request("http://local/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "" }),
  });
  const res = await handleJsonRequest(
    req,
    {
      name: "pub",
      schema: publicBodySchema,
      preset: "public",
      run: async () => {
        ran = true;
        return new Response("x");
      },
    },
    mockDeps()
  );
  assertEquals(res.status, 400);
  assertEquals(ran, false);
});

Deno.test("handleJsonRequest: identity preset returns 501", async () => {
  const req = new Request("http://local/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organization_id: VALID_ORG }),
  });
  const res = await handleJsonRequest(
    req,
    {
      name: "id",
      schema: securedBodySchema,
      preset: "identity",
      run: async () => new Response("no"),
    },
    mockDeps()
  );
  assertEquals(res.status, 501);
});

Deno.test("handleJsonRequest: handler throw returns 500 with correlation header", async () => {
  const req = new Request("http://local/x", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer good-token",
    },
    body: JSON.stringify({ organization_id: VALID_ORG }),
  });
  const res = await handleJsonRequest(
    req,
    {
      name: "test",
      schema: securedBodySchema,
      preset: "secured",
      run: async () => {
        throw new Error("boom");
      },
    },
    mockDeps()
  );
  assertEquals(res.status, 500);
  assertExists(res.headers.get("x-correlation-id"));
});

Deno.test(
  "handleJsonRequest: secured gate mode uses injected gateOrganizationRequest",
  async () => {
    const req = new Request("http://local/x", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer gate-ok",
      },
      body: JSON.stringify({ organization_id: VALID_ORG }),
    });
    const deps = mockDeps({
      gateOrganizationRequest: async (_req, organizationId, _logger) => {
        assertEquals(organizationId, VALID_ORG);
        return {
          ok: true,
          ctx: {
            supabase: mockSupabase,
            userId: "g1",
            userEmail: null,
          },
        };
      },
      requireAuthenticatedOrgMember: async () => {
        throw new Error("should use gate mode, not membership");
      },
    });
    const res = await handleJsonRequest(
      req,
      {
        name: "test",
        schema: securedBodySchema,
        preset: "secured",
        securedClientMode: "gate",
        run: async ({ auth }) => {
          return new Response(JSON.stringify({ userId: auth!.userId, org: auth!.organizationId }), {
            headers: { "Content-Type": "application/json" },
          });
        },
      },
      deps
    );
    assertEquals(res.status, 200);
    const body = (await res.json()) as { userId: string; org: string };
    assertEquals(body.userId, "g1");
    assertEquals(body.org, VALID_ORG);
  }
);

Deno.test(
  "handleJsonRequest: secured gate mode failure returns gate response with correlation id",
  async () => {
    const req = new Request("http://local/x", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer x",
      },
      body: JSON.stringify({ organization_id: VALID_ORG }),
    });
    const deps = mockDeps({
      gateOrganizationRequest: async () => ({
        ok: false,
        response: errorResponse("You do not have permission to access this organization", 403),
      }),
    });
    const res = await handleJsonRequest(
      req,
      {
        name: "test",
        schema: securedBodySchema,
        preset: "secured",
        securedClientMode: "gate",
        run: async () => new Response("no"),
      },
      deps
    );
    assertEquals(res.status, 403);
    assertExists(res.headers.get("x-correlation-id"));
  }
);

Deno.test("handleRawRequest: OPTIONS returns CORS", async () => {
  const res = await handleRawRequest(
    new Request("http://local/raw", { method: "OPTIONS" }),
    {
      name: "raw-fn",
      run: async () => new Response("no"),
    },
    { createServiceRoleClient: () => mockSupabase }
  );
  assertEquals(res.status, 200);
});

Deno.test("handleRawRequest: run receives logger and correlationId", async () => {
  let corr = "";
  const res = await handleRawRequest(
    new Request("http://local/raw", {
      method: "POST",
      headers: { "x-correlation-id": "raw-corr-1" },
    }),
    {
      name: "raw-fn",
      run: async ({ correlationId }) => {
        corr = correlationId;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
    { createServiceRoleClient: () => mockSupabase }
  );
  assertEquals(res.status, 200);
  assertEquals(corr, "raw-corr-1");
  assertEquals(res.headers.get("x-correlation-id"), "raw-corr-1");
});

Deno.test("handleRawRequest: withServiceRole supplies supabase when injectable", async () => {
  let sawClient = false;
  await handleRawRequest(
    new Request("http://local/raw", { method: "POST" }),
    {
      name: "raw-fn",
      withServiceRole: true,
      run: async ({ supabase }) => {
        sawClient = supabase === mockSupabase;
        return new Response("ok");
      },
    },
    { createServiceRoleClient: () => mockSupabase }
  );
  assertEquals(sawClient, true);
});

Deno.test(
  "handleRawRequest: cors false skips preflight short-circuit so OPTIONS reaches run",
  async () => {
    const res = await handleRawRequest(
      new Request("http://local/raw", { method: "OPTIONS" }),
      {
        name: "no-cors",
        cors: false,
        run: async () => new Response("handler-ran"),
      },
      { createServiceRoleClient: () => mockSupabase }
    );
    assertEquals(res.status, 200);
    assertEquals(await res.text(), "handler-ran");
  }
);

Deno.test("handleRawRequest: uncaught error returns 500 with correlation header", async () => {
  const req = new Request("http://local/raw", {
    method: "POST",
    headers: { "x-correlation-id": "raw-err-1" },
  });
  const res = await handleRawRequest(
    req,
    {
      name: "boom-raw",
      run: async () => {
        throw new Error("raw boom");
      },
    },
    { createServiceRoleClient: () => mockSupabase }
  );
  assertEquals(res.status, 500);
  assertEquals(res.headers.get("x-correlation-id"), "raw-err-1");
  const j = (await res.json()) as { detail?: string };
  assertEquals(j.detail, "raw boom");
});
