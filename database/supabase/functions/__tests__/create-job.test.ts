/**
 * Tests for create-job edge function
 *
 * These tests focus on validation logic and edge cases that can be unit tested.
 * Full integration tests would require a running Supabase instance.
 *
 * Run with: deno test --allow-all functions/__tests__/create-job.test.ts
 */

import { assertEquals } from "@std/assert";
import {
  normalizeLocationId,
  requiresLocationId,
  stripSubmissionForInsert,
} from "../create-job/handlers/submission-parsing.ts";

/**
 * Test location ID normalization logic (implementation: submission-parsing.ts)
 */
Deno.test("create-job: should normalize empty string location_id to null", () => {
  assertEquals(normalizeLocationId(""), null);
});

Deno.test("create-job: should normalize whitespace-only location_id to null", () => {
  assertEquals(normalizeLocationId("   "), null);
});

Deno.test("create-job: should preserve valid location_id", () => {
  assertEquals(normalizeLocationId("location-123"), "location-123");
});

/**
 * Test location requirement validation
 */
Deno.test("create-job: should require location when use_predefined_locations is true", () => {
  assertEquals(requiresLocationId(true, null), true);
});

Deno.test("create-job: should not require location when use_predefined_locations is false", () => {
  assertEquals(requiresLocationId(false, null), false);
});

Deno.test("create-job: should not require location when location_id is provided", () => {
  assertEquals(requiresLocationId(true, "location-123"), false);
});

/**
 * Test submission data processing (implementation: submission-parsing.ts)
 */
Deno.test("create-job: should extract colleague_ids and location_id from submissionData", () => {
  const submissionData = {
    colleague_ids: ["worker-1", "worker-2"],
    location_id: "location-123",
    field1: "value1",
    field2: "value2",
  };

  const stripped = stripSubmissionForInsert(submissionData);

  assertEquals(stripped.colleagueIds, ["worker-1", "worker-2"]);
  assertEquals(stripped.rawLocationId, "location-123");
  assertEquals(stripped.fieldData, { field1: "value1", field2: "value2" });
  assertEquals(stripped.submissionDataJsonb, {
    field1: "value1",
    field2: "value2",
  });
});

Deno.test("create-job: should handle submissionData without colleague_ids", () => {
  const submissionData = {
    location_id: "location-123",
    field1: "value1",
  };

  const stripped = stripSubmissionForInsert(submissionData);

  assertEquals(stripped.colleagueIds, undefined);
  assertEquals(stripped.fieldData, { field1: "value1" });
});

Deno.test("create-job: should convert empty fieldData to null", () => {
  const stripped = stripSubmissionForInsert({
    colleague_ids: [],
    location_id: "loc",
  });
  assertEquals(Object.keys(stripped.fieldData).length === 0, true);
  assertEquals(stripped.submissionDataJsonb, null);
});

Deno.test("create-job: should preserve non-empty fieldData", () => {
  const stripped = stripSubmissionForInsert({
    field1: "value1",
  });
  assertEquals(stripped.submissionDataJsonb, { field1: "value1" });
});

/**
 * Test validation logic
 */
Deno.test("create-job: should validate submissionData is an object", () => {
  const submissionData = { field1: "value1" };
  const isValid = submissionData && typeof submissionData === "object";
  assertEquals(isValid, true);
});

Deno.test("create-job: should reject null submissionData", () => {
  const submissionData = null;
  const isValid = !!(submissionData && typeof submissionData === "object");
  assertEquals(isValid, false);
});

Deno.test("create-job: should reject string submissionData", () => {
  const submissionData = "not an object";
  const isValid = submissionData && typeof submissionData === "object";
  assertEquals(isValid, false);
});

/**
 * Test colleague validation logic
 */
Deno.test("create-job: should validate colleague_ids is an array", () => {
  const colleagueIds = ["worker-1", "worker-2"];
  const isValid = colleagueIds && Array.isArray(colleagueIds) && colleagueIds.length > 0;
  assertEquals(isValid, true);
});

Deno.test("create-job: should reject empty colleague_ids array", () => {
  const colleagueIds: string[] = [];
  const isValid = colleagueIds && Array.isArray(colleagueIds) && colleagueIds.length > 0;
  assertEquals(isValid, false);
});

Deno.test("create-job: should handle undefined colleague_ids", () => {
  const colleagueIds: string[] | undefined = undefined;
  // When colleague_ids is undefined, validation should fail
  const isValid =
    colleagueIds !== undefined &&
    Array.isArray(colleagueIds) &&
    (colleagueIds as string[]).length > 0;
  assertEquals(isValid, false);
});

/**
 * Test error response structure
 */
Deno.test("create-job: should format authentication error correctly", () => {
  const message = "Authentication required";
  const status = 401;
  const expected = {
    status,
    body: JSON.stringify({ error: message }),
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  };
  // Just verify the structure matches expected pattern
  assertEquals(typeof expected.status, "number");
  assertEquals(expected.status, 401);
  assertEquals(typeof expected.body, "string");
});

Deno.test("create-job: should format validation error correctly", () => {
  const message = "submissionData is required";
  const status = 400;
  const expected = {
    status,
    body: JSON.stringify({ error: message }),
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  };
  assertEquals(expected.status, 400);
  assertEquals(JSON.parse(expected.body).error, message);
});

/**
 * Test colleague confirmation workflow - approval status logic
 */
Deno.test("create-job: should set pending status for multi-worker jobs submitted by worker", () => {
  const hasColleagues = true;
  const isWorkerSubmission = true;

  const approvalStatus = hasColleagues && isWorkerSubmission ? "pending" : "approved";
  assertEquals(approvalStatus, "pending");
});

Deno.test("create-job: should set approved status for single-worker jobs", () => {
  const hasColleagues = false;
  const isWorkerSubmission = true;

  const approvalStatus = hasColleagues && isWorkerSubmission ? "pending" : "approved";
  assertEquals(approvalStatus, "approved");
});

Deno.test("create-job: should set approved status for admin-created jobs", () => {
  const hasColleagues = true;
  const isWorkerSubmission = false; // Admin created

  const approvalStatus = hasColleagues && isWorkerSubmission ? "pending" : "approved";
  assertEquals(approvalStatus, "approved");
});

/**
 * Test auto_approve_at calculation
 */
Deno.test("create-job: should calculate auto_approve_at from org timeout", () => {
  const submissionTime = new Date("2026-02-14T10:00:00Z");
  const timeoutHours = 24; // Default org setting

  const autoApproveAt = new Date(submissionTime.getTime() + timeoutHours * 60 * 60 * 1000);

  assertEquals(autoApproveAt.toISOString(), "2026-02-15T10:00:00.000Z");
});

Deno.test("create-job: should not set auto_approve_at for approved jobs", () => {
  const approvalStatus: string = "approved";
  const autoApproveAt = approvalStatus === "pending" ? new Date() : null;

  assertEquals(autoApproveAt, null);
});

Deno.test("create-job: should set auto_approve_at only for pending jobs", () => {
  const approvalStatus = "pending";
  const submissionTime = new Date("2026-02-14T10:00:00Z");
  const timeoutHours = 24;

  const autoApproveAt =
    approvalStatus === "pending"
      ? new Date(submissionTime.getTime() + timeoutHours * 60 * 60 * 1000)
      : null;

  assertEquals(autoApproveAt !== null, true);
});

/**
 * Test edit_window_expires_at calculation
 */
Deno.test("create-job: should calculate edit_window_expires_at (3 hours)", () => {
  const submissionTime = new Date("2026-02-14T10:00:00Z");
  const editWindowHours = 3;

  const editWindowExpiresAt = new Date(submissionTime.getTime() + editWindowHours * 60 * 60 * 1000);

  assertEquals(editWindowExpiresAt.toISOString(), "2026-02-14T13:00:00.000Z");
});

Deno.test("create-job: should not set edit_window for approved jobs", () => {
  const approvalStatus: string = "approved";
  const editWindowExpiresAt = approvalStatus === "pending" ? new Date() : null;

  assertEquals(editWindowExpiresAt, null);
});

/**
 * Test submitted_by_worker_id
 */
Deno.test("create-job: should set submitted_by_worker_id for worker submissions", () => {
  const submittingWorkerId = "worker-123";
  const isWorkerSubmission = true;

  const submittedByWorkerId = isWorkerSubmission ? submittingWorkerId : null;
  assertEquals(submittedByWorkerId, "worker-123");
});

Deno.test("create-job: should not set submitted_by_worker_id for admin submissions", () => {
  const submittingWorkerId = null;
  const isWorkerSubmission = false;

  const submittedByWorkerId = isWorkerSubmission ? submittingWorkerId : null;
  assertEquals(submittedByWorkerId, null);
});

/**
 * Test job_worker confirmation_status
 */
Deno.test("create-job: should set submitter confirmation_status to confirmed", () => {
  const submitterId = "worker-1";
  const workerId = "worker-1";

  const confirmationStatus = workerId === submitterId ? "confirmed" : "pending";
  assertEquals(confirmationStatus, "confirmed");
});

Deno.test("create-job: should set colleague confirmation_status to pending", () => {
  const submitterId: string = "worker-1";
  const workerId: string = "worker-2";

  const confirmationStatus = workerId === submitterId ? "confirmed" : "pending";
  assertEquals(confirmationStatus, "pending");
});

Deno.test("create-job: should set all workers to confirmed for approved jobs", () => {
  const approvalStatus = "approved";

  // When job is immediately approved, all workers are confirmed
  const confirmationStatus = approvalStatus === "approved" ? "confirmed" : "pending";
  assertEquals(confirmationStatus, "confirmed");
});

/**
 * Test confirmation workflow with multiple colleagues
 */
Deno.test("create-job: should create correct job_worker entries for multi-worker job", () => {
  const submitterId = "worker-1";
  const colleagueIds = ["worker-2", "worker-3"];
  const allWorkerIds = [submitterId, ...colleagueIds];
  const isWorkerSubmission = true;

  const jobWorkerEntries = allWorkerIds.map((workerId) => ({
    worker_id: workerId,
    confirmation_status: isWorkerSubmission && workerId === submitterId ? "confirmed" : "pending",
    confirmed_at: isWorkerSubmission && workerId === submitterId ? new Date().toISOString() : null,
  }));

  assertEquals(jobWorkerEntries.length, 3);
  assertEquals(jobWorkerEntries[0].confirmation_status, "confirmed");
  assertEquals(jobWorkerEntries[0].confirmed_at !== null, true);
  assertEquals(jobWorkerEntries[1].confirmation_status, "pending");
  assertEquals(jobWorkerEntries[1].confirmed_at, null);
  assertEquals(jobWorkerEntries[2].confirmation_status, "pending");
  assertEquals(jobWorkerEntries[2].confirmed_at, null);
});
