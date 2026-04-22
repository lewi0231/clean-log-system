/**
 * Run: deno test --allow-all supabase/functions/_utils/__tests__/worker-payment-split.test.ts
 */

import { assertEquals } from "@std/assert";
import {
  computePoolSplitEffectives,
  POOL_SPLIT_MIXED_TIMES_WARNING,
  splitPoolToShares,
} from "../worker-payment-split.ts";

Deno.test("splitPoolToShares: S0 §5.2 example $184 → 80/80/24", () => {
  const pool = 184;
  const effectives = [8, 8, 2.4];
  const shares = splitPoolToShares(pool, effectives);
  assertEquals(shares.length, 3);
  const sum = shares.reduce((a, b) => a + b, 0);
  assertEquals(Math.round(sum * 100), Math.round(pool * 100));
  assertEquals(shares[0], 80);
  assertEquals(shares[1], 80);
  assertEquals(shares[2], 24);
});

Deno.test("computePoolSplitEffectives: all positive hours uses hours × weight", () => {
  const r = computePoolSplitEffectives([8, 8, 4], [1, 1, 0.6]);
  assertEquals(r.effectives, [8, 8, 2.4]);
  assertEquals(r.warnings.length, 0);
  assertEquals(r.allocationType, "time_based");
});

Deno.test("computePoolSplitEffectives: no hours uses weights only", () => {
  const r = computePoolSplitEffectives([0, 0, 0], [1, 1, 0.6]);
  assertEquals(r.effectives, [1, 1, 0.6]);
  assertEquals(r.allocationType, "weights_only");
});

Deno.test("computePoolSplitEffectives: mixed times uses weights + warning", () => {
  const r = computePoolSplitEffectives([8, 0, 8], [1, 1, 1]);
  assertEquals(r.effectives, [1, 1, 1]);
  assertEquals(r.warnings[0], POOL_SPLIT_MIXED_TIMES_WARNING);
  assertEquals(r.allocationType, "weights_only_mixed_times");
});

Deno.test("splitPoolToShares: equal weights reconciles to pool", () => {
  const shares = splitPoolToShares(100, [1, 1, 1]);
  const sum = shares.reduce((a, b) => a + b, 0);
  assertEquals(Math.round(sum * 100), 10000);
});

Deno.test("splitPoolToShares: zero pool yields zeros", () => {
  assertEquals(splitPoolToShares(0, [1, 2, 3]), [0, 0, 0]);
});
