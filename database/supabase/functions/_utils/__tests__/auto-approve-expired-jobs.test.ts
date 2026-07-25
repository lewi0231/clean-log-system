import { assertEquals } from "@std/assert";
import { filterActivePendingConfirmations } from "../auto-approve-expired-jobs.ts";

Deno.test("filterActivePendingConfirmations: drops past-deadline rows", () => {
  const now = new Date("2026-07-25T12:00:00.000Z");
  const items = [
    { job_id: "a", auto_approve_at: "2026-07-25T11:00:00.000Z" }, // past
    { job_id: "b", auto_approve_at: "2026-07-25T13:00:00.000Z" }, // future
    { job_id: "c", auto_approve_at: null }, // keep (no deadline)
  ];
  const kept = filterActivePendingConfirmations(items, now);
  assertEquals(
    kept.map((i) => i.job_id),
    ["b", "c"]
  );
});

Deno.test("filterActivePendingConfirmations: keeps row exactly at boundary as expired", () => {
  const now = new Date("2026-07-25T12:00:00.000Z");
  const items = [{ job_id: "exact", auto_approve_at: "2026-07-25T12:00:00.000Z" }];
  const kept = filterActivePendingConfirmations(items, now);
  assertEquals(kept.length, 0);
});
