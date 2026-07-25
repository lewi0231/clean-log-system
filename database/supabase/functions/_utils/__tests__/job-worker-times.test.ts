/**
 * Run: deno test --allow-all supabase/functions/_utils/__tests__/job-worker-times.test.ts
 */

import { assertEquals } from "@std/assert";
import {
  hoursFromTimeRange,
  resolveWorkerTimeRange,
  withJobWorkerTimes,
} from "../job-worker-times.ts";

const paul = "worker-paul";
const bob = "worker-bob";

Deno.test("resolveWorkerTimeRange: prefers per-worker worker_times finish_time", () => {
  const range = resolveWorkerTimeRange(paul, {
    start_time: "2026-07-20T02:00:00.000Z",
    finish_time: "2026-07-20T06:00:00.000Z",
    worker_times: [
      {
        worker_id: paul,
        start_time: "2026-07-20T03:56:00.000Z",
        finish_time: "2026-07-20T05:56:11.000Z",
      },
      {
        worker_id: bob,
        start_time: "2026-07-20T02:56:00.000Z",
        finish_time: "2026-07-20T05:56:11.000Z",
      },
    ],
  });
  assertEquals(range?.start_time, "2026-07-20T03:56:00.000Z");
  assertEquals(range?.end_time, "2026-07-20T05:56:11.000Z");
});

Deno.test("resolveWorkerTimeRange: falls back to shared start/finish", () => {
  const range = resolveWorkerTimeRange(paul, {
    start_time: "2026-07-20T01:00:00.000Z",
    finish_time: "2026-07-20T04:00:00.000Z",
  });
  assertEquals(range?.start_time, "2026-07-20T01:00:00.000Z");
  assertEquals(range?.end_time, "2026-07-20T04:00:00.000Z");
});

Deno.test("resolveWorkerTimeRange: accepts end_time alias in worker_times", () => {
  const range = resolveWorkerTimeRange(paul, {
    worker_times: [
      {
        worker_id: paul,
        start_time: "2026-07-20T01:00:00.000Z",
        end_time: "2026-07-20T02:30:00.000Z",
      },
    ],
  });
  assertEquals(range?.end_time, "2026-07-20T02:30:00.000Z");
});

Deno.test("resolveWorkerTimeRange: returns null when times missing", () => {
  assertEquals(resolveWorkerTimeRange(paul, {}), null);
  assertEquals(resolveWorkerTimeRange(paul, null), null);
});

Deno.test("resolveWorkerTimeRange: rejects end ≤ start (avoids mixed-hours trap)", () => {
  assertEquals(
    resolveWorkerTimeRange(paul, {
      worker_times: [
        {
          worker_id: paul,
          start_time: "2026-07-20T05:00:00.000Z",
          finish_time: "2026-07-20T04:00:00.000Z",
        },
      ],
    }),
    null
  );
  assertEquals(
    resolveWorkerTimeRange(paul, {
      start_time: "2026-07-20T05:00:00.000Z",
      finish_time: "2026-07-20T05:00:00.000Z",
    }),
    null
  );
});

Deno.test("hoursFromTimeRange: computes positive hours", () => {
  const hours = hoursFromTimeRange("2026-07-20T03:56:00.000Z", "2026-07-20T05:56:00.000Z");
  assertEquals(hours, 2);
});

Deno.test("hoursFromTimeRange: end before start yields 0", () => {
  assertEquals(hoursFromTimeRange("2026-07-20T05:00:00.000Z", "2026-07-20T04:00:00.000Z"), 0);
});

Deno.test("withJobWorkerTimes: attaches start/end for insert rows", () => {
  const rows = withJobWorkerTimes(
    [
      { job_id: "j1", worker_id: paul },
      { job_id: "j1", worker_id: bob },
    ],
    {
      worker_times: [
        {
          worker_id: paul,
          start_time: "2026-07-20T03:56:00.000Z",
          finish_time: "2026-07-20T05:56:11.000Z",
        },
        {
          worker_id: bob,
          start_time: "2026-07-20T02:56:00.000Z",
          finish_time: "2026-07-20T05:56:11.000Z",
        },
      ],
    }
  );
  assertEquals(rows[0]?.start_time, "2026-07-20T03:56:00.000Z");
  assertEquals(rows[0]?.end_time, "2026-07-20T05:56:11.000Z");
  assertEquals(rows[1]?.start_time, "2026-07-20T02:56:00.000Z");
  assertEquals(rows[1]?.end_time, "2026-07-20T05:56:11.000Z");
});
