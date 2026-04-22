/**
 * Pure helpers for splitting the job worker payment pool among workers.
 *
 * Policy (S1 §2.2):
 * - All workers have positive hours → effective_i = hours_i × weight_i ("time_based")
 * - No one has positive hours → effective_i = weight_i ("weights_only")
 * - Mixed hours → effective_i = weight_i + warning ("weights_only_mixed_times")
 *
 * Pool assignment: largest-remainder on cents so Σ shares equals pool after rounding.
 */

export const POOL_SPLIT_MIXED_TIMES_WARNING =
  "Some workers are missing a time range; pool split used weights only. Fix job_worker times for accurate hours × weight.";

export type PoolSplitAllocationTag =
  | "time_based"
  | "weights_only"
  | "weights_only_mixed_times"
  | "equal_split";

/**
 * @param hours — per-worker hours (≥ 0), same length as weights
 * @param weights — per-worker split weights (must be &gt; 0), same length as hours
 */
export function computePoolSplitEffectives(
  hours: number[],
  weights: number[],
): {
  effectives: number[];
  warnings: string[];
  allocationType: PoolSplitAllocationTag;
} {
  const n = hours.length;
  if (n !== weights.length) {
    throw new Error("hours and weights must have the same length");
  }
  if (n === 0) {
    return { effectives: [], warnings: [], allocationType: "equal_split" };
  }

  const positiveHours = hours.map((h) => h > 0);
  const allPositive = positiveHours.every(Boolean);
  const anyPositive = positiveHours.some(Boolean);

  if (allPositive) {
    return {
      effectives: hours.map((h, i) => h * weights[i]),
      warnings: [],
      allocationType: "time_based",
    };
  }

  if (!anyPositive) {
    return {
      effectives: [...weights],
      warnings: [],
      allocationType: "weights_only",
    };
  }

  return {
    effectives: [...weights],
    warnings: [POOL_SPLIT_MIXED_TIMES_WARNING],
    allocationType: "weights_only_mixed_times",
  };
}

/**
 * Split `pool` (currency units, 2 dp) across workers proportionally to `effectives`.
 * Uses largest-remainder on whole cents so the rounded shares sum to `pool`.
 */
export function splitPoolToShares(pool: number, effectives: number[]): number[] {
  const n = effectives.length;
  if (n === 0) return [];

  const targetCents = Math.round(pool * 100 + Number.EPSILON);
  if (targetCents === 0) {
    return Array(n).fill(0);
  }

  const sumEff = effectives.reduce((a, b) => a + b, 0);
  if (sumEff <= 0 || !Number.isFinite(sumEff)) {
    const base = Math.floor(targetCents / n);
    let rem = targetCents - base * n;
    const cents = Array(n).fill(base);
    for (let i = 0; i < rem; i++) cents[i]++;
    return cents.map((c) => c / 100);
  }

  const exactCents = effectives.map((e) => (e / sumEff) * targetCents);
  const baseCents = exactCents.map((x) => Math.floor(x + 1e-9));
  let remainder = targetCents - baseCents.reduce((a, b) => a + b, 0);
  const frac = exactCents
    .map((x, i) => ({ i, f: x - Math.floor(x + 1e-9) }))
    .sort((a, b) => b.f - a.f);
  const outCents = [...baseCents];
  for (let k = 0; k < remainder; k++) {
    outCents[frac[k % n].i]++;
  }
  return outCents.map((c) => c / 100);
}
