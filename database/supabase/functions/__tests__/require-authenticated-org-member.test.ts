/**
 * Tests for requireAuthenticatedOrgMember (JWT + org membership gate).
 *
 * Run: deno test --allow-all database/supabase/functions/__tests__/require-authenticated-org-member.test.ts
 *
 * NOTE: These unit tests cover early-exit paths (missing/invalid token → 401).
 * Full integration tests (valid JWT, membership lookup, 403 for cross-org) require
 * a running Supabase instance with seeded org/user data — see S1 §10.1 for fixtures.
 */

import { assertEquals } from "@std/assert";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthenticatedOrgMember } from "../_utils/require-authenticated-org-member.ts";

const dummyOrgId = "00000000-0000-0000-0000-000000000001";

Deno.test("requireAuthenticatedOrgMember: missing Authorization returns 401", async () => {
  const req = new Request("http://local/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organization_id: dummyOrgId }),
  });

  const result = await requireAuthenticatedOrgMember(req, dummyOrgId, {} as SupabaseClient);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.response.status, 401);
    const body = (await result.response.json()) as { detail?: string };
    assertEquals(body.detail, "Authentication required");
  }
});

Deno.test("requireAuthenticatedOrgMember: empty Bearer token returns 401", async () => {
  const req = new Request("http://local/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer ",
    },
    body: JSON.stringify({ organization_id: dummyOrgId }),
  });

  const result = await requireAuthenticatedOrgMember(req, dummyOrgId, {} as SupabaseClient);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.response.status, 401);
  }
});
