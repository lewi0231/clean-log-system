import { assertEquals } from "@std/assert";
import { resolveOrganizationId } from "../resolve-organization-id.ts";

type LookupResult = {
  adminOrgId: string | null;
  workerOrgId: string | null;
};

function createSupabaseStub(results: LookupResult) {
  return {
    from: () => ({
      select: () => ({
        ilike: () => ({
          maybeSingle: async () => ({
            data: results.adminOrgId ? { organization_id: results.adminOrgId } : null,
            error: null,
          }),
        }),
        eq: () => ({
          maybeSingle: async () => ({
            data: results.workerOrgId ? { organization_id: results.workerOrgId } : null,
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as Parameters<typeof resolveOrganizationId>[0];
}

Deno.test("resolveOrganizationId prefers admin org for dashboard callers", async () => {
  const supabase = createSupabaseStub({
    adminOrgId: "org-admin",
    workerOrgId: "org-worker",
  });

  const organizationId = await resolveOrganizationId(supabase, {
    lookupEmail: "dual@example.com",
    authUserId: "auth-1",
    preferWorker: false,
  });

  assertEquals(organizationId, "org-admin");
});

Deno.test("resolveOrganizationId prefers worker org for mobile callers", async () => {
  const supabase = createSupabaseStub({
    adminOrgId: "org-admin",
    workerOrgId: "org-worker",
  });

  const organizationId = await resolveOrganizationId(supabase, {
    lookupEmail: "dual@example.com",
    authUserId: "auth-1",
    preferWorker: true,
  });

  assertEquals(organizationId, "org-worker");
});

Deno.test("resolveOrganizationId falls back to admin when worker org missing", async () => {
  const supabase = createSupabaseStub({
    adminOrgId: "org-admin",
    workerOrgId: null,
  });

  const organizationId = await resolveOrganizationId(supabase, {
    lookupEmail: "admin@example.com",
    authUserId: "auth-1",
    preferWorker: true,
  });

  assertEquals(organizationId, "org-admin");
});

Deno.test("resolveOrganizationId falls back to worker when admin org missing", async () => {
  const supabase = createSupabaseStub({
    adminOrgId: null,
    workerOrgId: "org-worker",
  });

  const organizationId = await resolveOrganizationId(supabase, {
    lookupEmail: "worker@example.com",
    authUserId: "auth-1",
    preferWorker: false,
  });

  assertEquals(organizationId, "org-worker");
});
