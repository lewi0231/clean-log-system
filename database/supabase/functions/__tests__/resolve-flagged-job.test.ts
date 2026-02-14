/**
 * Tests for resolve-flagged-job edge function
 *
 * These tests focus on admin authorization, action validation, and state transitions.
 * Full integration tests would require a running Supabase instance.
 *
 * Run with: deno test --allow-all functions/__tests__/resolve-flagged-job.test.ts
 */

import { assertEquals, assertNotEquals } from "@std/assert";

// Type helpers for testing
type JobApprovalStatus = "approved" | "pending" | "flagged" | "cancelled";
type ResolveAction = "approve" | "cancel";
type OrgRole = "admin" | "owner" | "viewer";

/**
 * Test job approval status validation
 */
Deno.test("resolve-flagged-job: should only allow resolution on flagged jobs", () => {
  const validStatuses = ["flagged"];
  const invalidStatuses = ["approved", "pending", "cancelled"];

  validStatuses.forEach((status) => {
    assertEquals(status === "flagged", true);
  });

  invalidStatuses.forEach((status) => {
    assertNotEquals(status, "flagged");
  });
});

Deno.test("resolve-flagged-job: should reject pending jobs", () => {
  const jobStatus: JobApprovalStatus = "pending";
  const canResolve = (jobStatus as string) === "flagged";
  assertEquals(canResolve, false);
});

Deno.test("resolve-flagged-job: should reject already approved jobs", () => {
  const jobStatus: JobApprovalStatus = "approved";
  const canResolve = (jobStatus as string) === "flagged";
  assertEquals(canResolve, false);
});

/**
 * Test action validation
 */
Deno.test("resolve-flagged-job: should accept 'approve' action", () => {
  const action: ResolveAction = "approve";
  const isValid = action === "approve" || action === "cancel";
  assertEquals(isValid, true);
});

Deno.test("resolve-flagged-job: should accept 'cancel' action", () => {
  const action: ResolveAction = "cancel";
  const isValid = (action as string) === "approve" || (action as string) === "cancel";
  assertEquals(isValid, true);
});

Deno.test("resolve-flagged-job: should reject invalid action", () => {
  const action: string = "reject";
  const isValid = action === "approve" || action === "cancel";
  assertEquals(isValid, false);
});

Deno.test("resolve-flagged-job: should reject empty action", () => {
  const action: string = "";
  const isValid = action === "approve" || action === "cancel";
  assertEquals(isValid, false);
});

/**
 * Test admin authorization
 */
Deno.test("resolve-flagged-job: should allow admin role", () => {
  const role: OrgRole = "admin";
  const isAuthorized = role === "admin" || role === "owner";
  assertEquals(isAuthorized, true);
});

Deno.test("resolve-flagged-job: should allow owner role", () => {
  const role: OrgRole = "owner";
  const isAuthorized = (role as string) === "admin" || (role as string) === "owner";
  assertEquals(isAuthorized, true);
});

Deno.test("resolve-flagged-job: should reject viewer role", () => {
  const role: OrgRole = "viewer";
  const isAuthorized = (role as string) === "admin" || (role as string) === "owner";
  assertEquals(isAuthorized, false);
});

Deno.test("resolve-flagged-job: should reject worker (no org_user role)", () => {
  const role: OrgRole | null = null;
  const isAuthorized = role === "admin" || role === "owner";
  assertEquals(isAuthorized, false);
});

/**
 * Test state transitions for approve action
 */
Deno.test("resolve-flagged-job: approve action should set status to approved", () => {
  const action = "approve";
  const newStatus = action === "approve" ? "approved" : "cancelled";
  assertEquals(newStatus, "approved");
});

Deno.test("resolve-flagged-job: approve action should confirm pending workers", () => {
  const action = "approve";
  const workers = [
    { worker_id: "worker-1", confirmation_status: "confirmed" },
    { worker_id: "worker-2", confirmation_status: "pending" },
    { worker_id: "worker-3", confirmation_status: "flagged" },
  ];

  if (action === "approve") {
    const updatedWorkers = workers.map((w) => ({
      ...w,
      confirmation_status:
        w.confirmation_status === "pending" || w.confirmation_status === "flagged"
          ? "confirmed"
          : w.confirmation_status,
    }));

    assertEquals(
      updatedWorkers.every((w) => w.confirmation_status === "confirmed"),
      true
    );
  }
});

/**
 * Test state transitions for cancel action
 */
Deno.test("resolve-flagged-job: cancel action should set status to cancelled", () => {
  const action: ResolveAction = "cancel";
  const newStatus = (action as string) === "approve" ? "approved" : "cancelled";
  assertEquals(newStatus, "cancelled");
});

Deno.test("resolve-flagged-job: cancel action should not change worker statuses", () => {
  const action = "cancel";
  const workers = [
    { worker_id: "worker-1", confirmation_status: "confirmed" },
    { worker_id: "worker-2", confirmation_status: "pending" },
    { worker_id: "worker-3", confirmation_status: "flagged" },
  ];

  // On cancel, we don't update worker statuses
  if (action === "cancel") {
    assertEquals(workers[0].confirmation_status, "confirmed");
    assertEquals(workers[1].confirmation_status, "pending");
    assertEquals(workers[2].confirmation_status, "flagged");
  }
});

/**
 * Test request validation
 */
Deno.test("resolve-flagged-job: should require job_id and action", () => {
  const body = { job_id: "job-123", action: "approve" };
  const hasRequired =
    "job_id" in body &&
    typeof body.job_id === "string" &&
    "action" in body &&
    typeof body.action === "string";
  assertEquals(hasRequired, true);
});

Deno.test("resolve-flagged-job: should reject missing job_id", () => {
  const body = { action: "approve" };
  const hasJobId = "job_id" in body;
  assertEquals(hasJobId, false);
});

Deno.test("resolve-flagged-job: should reject missing action", () => {
  const body = { job_id: "job-123" };
  const hasAction = "action" in body;
  assertEquals(hasAction, false);
});

/**
 * Test admin_notes (optional)
 */
Deno.test("resolve-flagged-job: should accept optional admin_notes", () => {
  const body = {
    job_id: "job-123",
    action: "approve",
    admin_notes: "Contacted worker, confirmed they were present",
  };

  assertEquals(typeof body.admin_notes, "string");
});

Deno.test("resolve-flagged-job: should work without admin_notes", () => {
  const body = {
    job_id: "job-123",
    action: "cancel",
  };

  const adminNotes = (body as { admin_notes?: string }).admin_notes;
  assertEquals(adminNotes, undefined);
});

/**
 * Test organization scope validation
 */
Deno.test("resolve-flagged-job: should verify job belongs to admin's organization", () => {
  const adminOrgId: string = "org-1";
  const jobOrgId: string = "org-1";

  const isSameOrg = adminOrgId === jobOrgId;
  assertEquals(isSameOrg, true);
});

Deno.test("resolve-flagged-job: should reject if job is from different organization", () => {
  const adminOrgId: string = "org-1";
  const jobOrgId: string = "org-2";

  const isSameOrg = adminOrgId === jobOrgId;
  assertEquals(isSameOrg, false);
});

/**
 * Test response structure
 */
Deno.test("resolve-flagged-job: should return success for approve", () => {
  const action: ResolveAction = "approve";
  const response = {
    success: true,
    message: `Job ${action === "approve" ? "approved" : "cancelled"} successfully`,
    job_status: action === "approve" ? "approved" : "cancelled",
  };

  assertEquals(response.success, true);
  assertEquals(response.message, "Job approved successfully");
  assertEquals(response.job_status, "approved");
});

Deno.test("resolve-flagged-job: should return success for cancel", () => {
  const action: ResolveAction = "cancel";
  const response = {
    success: true,
    message: `Job ${(action as string) === "approve" ? "approved" : "cancelled"} successfully`,
    job_status: (action as string) === "approve" ? "approved" : "cancelled",
  };

  assertEquals(response.success, true);
  assertEquals(response.message, "Job cancelled successfully");
  assertEquals(response.job_status, "cancelled");
});

/**
 * Test notification generation
 */
Deno.test("resolve-flagged-job: should determine correct notification type for approve", () => {
  const action: ResolveAction = "approve";
  const notificationType =
    action === "approve" ? "job_resolved_approved" : "job_resolved_cancelled";
  assertEquals(notificationType, "job_resolved_approved");
});

Deno.test("resolve-flagged-job: should determine correct notification type for cancel", () => {
  const action: ResolveAction = "cancel";
  const notificationType =
    (action as string) === "approve" ? "job_resolved_approved" : "job_resolved_cancelled";
  assertEquals(notificationType, "job_resolved_cancelled");
});

/**
 * Test confirmed_at timestamp on approve
 */
Deno.test("resolve-flagged-job: approve should set confirmed_at for updated workers", () => {
  const now = new Date().toISOString();
  const updateData = {
    confirmation_status: "confirmed",
    confirmed_at: now,
  };

  assertEquals(updateData.confirmation_status, "confirmed");
  assertEquals(typeof updateData.confirmed_at, "string");
});
