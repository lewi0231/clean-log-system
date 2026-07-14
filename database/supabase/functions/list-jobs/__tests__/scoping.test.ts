import { assertEquals } from "@std/assert";
import { mergeParticipatingJobIds, resolveListJobsWorkerScope } from "../scoping.ts";

Deno.test(
  "resolveListJobsWorkerScope: mine uses caller worker id and ignores client worker_id",
  () => {
    const result = resolveListJobsWorkerScope({
      mine: true,
      workerId: "other-worker",
      callerWorkerId: "caller-worker",
    });
    assertEquals(result, { ok: true, effectiveWorkerId: "caller-worker" });
  }
);

Deno.test("resolveListJobsWorkerScope: mine with no caller worker returns null scope", () => {
  const result = resolveListJobsWorkerScope({
    mine: true,
    callerWorkerId: null,
  });
  assertEquals(result, { ok: true, effectiveWorkerId: null });
});

Deno.test("list-jobs policy: mine without worker profile should return empty list", () => {
  const scope = resolveListJobsWorkerScope({ mine: true, callerWorkerId: null });
  assertEquals(scope.ok && scope.effectiveWorkerId === null, true);
});

Deno.test("resolveListJobsWorkerScope: explicit worker_id must match caller", () => {
  const allowed = resolveListJobsWorkerScope({
    workerId: "worker-1",
    callerWorkerId: "worker-1",
  });
  assertEquals(allowed, { ok: true, effectiveWorkerId: "worker-1" });

  const denied = resolveListJobsWorkerScope({
    workerId: "worker-2",
    callerWorkerId: "worker-1",
  });
  assertEquals(denied, {
    ok: false,
    status: 403,
    message: "You can only list jobs for your own worker profile",
  });
});

Deno.test("resolveListJobsWorkerScope: no mine or worker_id means org-wide list", () => {
  const result = resolveListJobsWorkerScope({
    callerWorkerId: "worker-1",
  });
  assertEquals(result, { ok: true, effectiveWorkerId: null });
});

Deno.test("mergeParticipatingJobIds: unions and deduplicates job ids", () => {
  assertEquals(mergeParticipatingJobIds(["job-a", "job-b", "job-a"], ["job-b", "job-c"]), [
    "job-a",
    "job-b",
    "job-c",
  ]);
});

Deno.test("mergeParticipatingJobIds: handles empty inputs", () => {
  assertEquals(mergeParticipatingJobIds([], []), []);
});
