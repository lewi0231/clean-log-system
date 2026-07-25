/**
 * Run from database/:
 * deno test --allow-all supabase/functions/calculate-worker-payment/handlers/__tests__/worker-splits-times.test.ts
 */

import { assertEquals } from "@std/assert";
import { calculateWorkerSplits } from "../calculation-engine.ts";
import type { JobWorker, WorkerRateCard } from "../types.ts";

function worker(id: string, name: string, start: string | null, end: string | null): JobWorker {
  const [first_name, last_name] = name.split(" ");
  return {
    job_id: "job-1",
    worker_id: id,
    start_time: start,
    end_time: end,
    worker: { id, first_name: first_name ?? name, last_name: last_name ?? "" },
  };
}

Deno.test("calculateWorkerSplits: uses submission worker_times when job_worker clocks null", () => {
  const paul = "worker-paul";
  const bob = "worker-bob";
  const rateCardMap = new Map<string, Map<string, WorkerRateCard>>();
  const supervisorCard: WorkerRateCard = {
    id: "rc-supervisor",
    worker_id: paul,
    modifier_type: "team_percentage",
    modifier_value: 10,
    currency: "AUD",
    role_title: "Supervisor",
    effective_from: "2026-01-01",
    effective_to: null,
    is_active: true,
  };
  rateCardMap.set(paul, new Map([["team_percentage", supervisorCard]]));

  const { splits, warnings } = calculateWorkerSplits({
    baseWorkerPayment: 281.7,
    workers: [worker(paul, "Paul Lewis", null, null), worker(bob, "Bob Franko", null, null)],
    rateCardMap: rateCardMap as never,
    submissionData: {
      worker_times: [
        {
          worker_id: paul,
          start_time: "2026-07-20T03:56:00.000Z",
          finish_time: "2026-07-20T05:56:00.000Z",
        },
        {
          worker_id: bob,
          start_time: "2026-07-20T02:56:00.000Z",
          finish_time: "2026-07-20T05:56:00.000Z",
        },
      ],
    },
    fieldConfigMap: new Map(),
  });

  assertEquals(warnings.length, 0);
  assertEquals(splits[0]?.allocation_type, "time_based");
  assertEquals(splits[0]?.hours_worked, 2);
  assertEquals(splits[1]?.hours_worked, 3);
  // 2/5 and 3/5 of 281.70
  assertEquals(splits[0]?.time_share, 112.68);
  assertEquals(splits[1]?.time_share, 169.02);
  // 10% of Bob's time_share
  assertEquals(splits[0]?.team_percentage_bonus, 16.9);
  assertEquals(splits[0]?.final_payment, 129.58);
  assertEquals(splits[1]?.final_payment, 169.02);
});

Deno.test("calculateWorkerSplits: prefers job_worker columns over submission_data", () => {
  const paul = "worker-paul";
  const bob = "worker-bob";

  const { splits } = calculateWorkerSplits({
    baseWorkerPayment: 100,
    workers: [
      worker(paul, "Paul Lewis", "2026-07-20T01:00:00.000Z", "2026-07-20T02:00:00.000Z"),
      worker(bob, "Bob Franko", "2026-07-20T01:00:00.000Z", "2026-07-20T03:00:00.000Z"),
    ],
    rateCardMap: new Map(),
    submissionData: {
      // Would be 4h/4h if used — must be ignored when job_worker has times
      worker_times: [
        {
          worker_id: paul,
          start_time: "2026-07-20T01:00:00.000Z",
          finish_time: "2026-07-20T05:00:00.000Z",
        },
        {
          worker_id: bob,
          start_time: "2026-07-20T01:00:00.000Z",
          finish_time: "2026-07-20T05:00:00.000Z",
        },
      ],
    },
    fieldConfigMap: new Map(),
  });

  assertEquals(splits[0]?.hours_worked, 1);
  assertEquals(splits[1]?.hours_worked, 2);
  assertEquals(splits[0]?.time_share, 33.33);
  assertEquals(splits[1]?.time_share, 66.67);
});

Deno.test("calculateWorkerSplits: invalid job_worker range falls back to submission_data", () => {
  const paul = "worker-paul";
  const bob = "worker-bob";

  const { splits, warnings } = calculateWorkerSplits({
    baseWorkerPayment: 100,
    workers: [
      // end before start → ignore columns, use submission
      worker(paul, "Paul Lewis", "2026-07-20T05:00:00.000Z", "2026-07-20T04:00:00.000Z"),
      worker(bob, "Bob Franko", "2026-07-20T05:00:00.000Z", "2026-07-20T04:00:00.000Z"),
    ],
    rateCardMap: new Map(),
    submissionData: {
      worker_times: [
        {
          worker_id: paul,
          start_time: "2026-07-20T01:00:00.000Z",
          finish_time: "2026-07-20T03:00:00.000Z",
        },
        {
          worker_id: bob,
          start_time: "2026-07-20T01:00:00.000Z",
          finish_time: "2026-07-20T04:00:00.000Z",
        },
      ],
    },
    fieldConfigMap: new Map(),
  });

  assertEquals(warnings.length, 0);
  assertEquals(splits[0]?.hours_worked, 2);
  assertEquals(splits[1]?.hours_worked, 3);
  assertEquals(splits[0]?.allocation_type, "time_based");
  assertEquals(splits[0]?.time_share, 40);
  assertEquals(splits[1]?.time_share, 60);
});
