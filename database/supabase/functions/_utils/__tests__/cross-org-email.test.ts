import { assertEquals } from "@std/assert";
import {
  findCrossOrganizationEmailConflict,
  findWorkerAuthUserInOtherOrganization,
  formatCrossOrgEmailError,
  formatWorkerAuthUserConflictError,
  normalizeLookupEmail,
} from "../cross-org-email.ts";

Deno.test("normalizeLookupEmail trims and lowercases", () => {
  assertEquals(normalizeLookupEmail("  Worker@Example.COM  "), "worker@example.com");
});

Deno.test("formatCrossOrgEmailError describes admin membership", () => {
  const message = formatCrossOrgEmailError({
    email: "worker@example.com",
    requestedOrganizationId: "org-b",
    existingOrganizationId: "org-a",
    existingOrganizationName: "Franks Spaceship Cleaning",
    existingAs: ["admin"],
  });

  assertEquals(
    message,
    "This email is already registered as a dashboard user in Franks Spaceship Cleaning. Each email can only belong to one organization."
  );
});

Deno.test("formatCrossOrgEmailError describes combined memberships", () => {
  const message = formatCrossOrgEmailError({
    email: "worker@example.com",
    requestedOrganizationId: "org-b",
    existingOrganizationId: "org-a",
    existingOrganizationName: null,
    existingAs: ["admin", "worker"],
  });

  assertEquals(
    message,
    "This email is already registered as a dashboard user and a worker in another organization. Each email can only belong to one organization."
  );
});

Deno.test("formatWorkerAuthUserConflictError names the other organization", () => {
  const message = formatWorkerAuthUserConflictError({
    authUserId: "auth-1",
    requestedOrganizationId: "org-b",
    existingOrganizationId: "org-a",
    existingOrganizationName: "Franks Spaceship Cleaning",
  });

  assertEquals(
    message,
    "This account is already a worker in Franks Spaceship Cleaning. Each email can only belong to one organization. Remove the worker record there first, or use a different email."
  );
});

type CrossOrgStubData = {
  orgUsers: Array<{ organization_id: string }>;
  workers: Array<{ organization_id: string }>;
  workerByAuthUserId: { organization_id: string } | null;
  organizationNames: Record<string, string>;
};

function createCrossOrgSupabaseStub(data: CrossOrgStubData) {
  return {
    from: (table: string) => {
      if (table === "organization_user") {
        return {
          select: () => ({
            ilike: () => ({
              neq: () => ({
                limit: async () => ({ data: data.orgUsers, error: null }),
              }),
            }),
          }),
        };
      }

      if (table === "worker") {
        return {
          select: () => ({
            ilike: (_column: string, _email: string) => ({
              neq: () => ({
                limit: async () => ({ data: data.workers, error: null }),
              }),
            }),
            eq: () => ({
              neq: () => ({
                maybeSingle: async () => ({
                  data: data.workerByAuthUserId,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "organization") {
        return {
          select: () => ({
            eq: (_column: string, orgId: string) => ({
              single: async () => ({
                data: { name: data.organizationNames[orgId] ?? "Unknown Org" },
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as Parameters<typeof findCrossOrganizationEmailConflict>[0];
}

Deno.test("findCrossOrganizationEmailConflict returns null for same-org only usage", async () => {
  const supabase = createCrossOrgSupabaseStub({
    orgUsers: [],
    workers: [],
    workerByAuthUserId: null,
    organizationNames: {},
  });

  const conflict = await findCrossOrganizationEmailConflict(
    supabase,
    "worker@example.com",
    "org-a"
  );

  assertEquals(conflict, null);
});

Deno.test("findCrossOrganizationEmailConflict detects worker in another org", async () => {
  const supabase = createCrossOrgSupabaseStub({
    orgUsers: [],
    workers: [{ organization_id: "org-a" }],
    workerByAuthUserId: null,
    organizationNames: { "org-a": "Franks Spaceship Cleaning" },
  });

  const conflict = await findCrossOrganizationEmailConflict(
    supabase,
    "worker@example.com",
    "org-b"
  );

  assertEquals(conflict?.existingOrganizationId, "org-a");
  assertEquals(conflict?.existingAs, ["worker"]);
  assertEquals(conflict?.existingOrganizationName, "Franks Spaceship Cleaning");
});

Deno.test("findWorkerAuthUserInOtherOrganization detects linked worker elsewhere", async () => {
  const supabase = createCrossOrgSupabaseStub({
    orgUsers: [],
    workers: [],
    workerByAuthUserId: { organization_id: "org-a" },
    organizationNames: { "org-a": "Franks Spaceship Cleaning" },
  });

  const conflict = await findWorkerAuthUserInOtherOrganization(supabase, "auth-1", "org-b");

  assertEquals(conflict?.existingOrganizationId, "org-a");
  assertEquals(conflict?.existingOrganizationName, "Franks Spaceship Cleaning");
});
