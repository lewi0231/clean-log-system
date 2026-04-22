# S3 — Detailed Action Plan (DAP): Worker split weights (`split_weight`, `hours × weight`)

| Field       | Value                                                                        |
| ----------- | ---------------------------------------------------------------------------- |
| **Stage**   | S3 — Detailed Action Plan (execute in order; checkboxes for tracking)        |
| **From S2** | [`S2-worker-payment-split-weights.md`](./S2-worker-payment-split-weights.md) |
| **Created** | 2026-04-22                                                                   |
| **Product** | Clean Log                                                                    |

---

## 1. Scope lock (v1 MVP)

Deliver everything in S2 §2 **In scope** for v1. **Do not** wire `worker_payment_allocation`, rate card audit, expiry notifications, or server-side recalc on save unless explicitly pulled into this DAP.

---

## 2. Locked contracts (do not improvise during implementation)

### 2.1 API: `calculation_warnings`

- **Shape:** `calculation_warnings?: string[]` on **each** object in **`calculation.job_calculations[]`** (per job).
- **Empty:** omit the key or use `[]` — dashboard must treat both as “no warnings.”
- **Mixed times:** include at least one stable English string, e.g.  
  `"Some workers are missing a time range; pool split used weights only. Fix job_worker times for accurate hours × weight."`

### 2.2 `allocation_type` (worker split rows)

| Value                          | When                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`single_worker`**            | One worker on job.                                                                                                                                   |
| **`time_based`**               | All workers have positive hours; split used **`hours × split_weight`** (weights may all be 1.0).                                                     |
| **`weights_only`**             | No positive hours on anyone; split normalized by **`split_weight` only**.                                                                            |
| **`weights_only_mixed_times`** | Mixed time coverage; split normalized by weight only + **warning** emitted.                                                                          |
| **`equal_split`**              | **Deprecated path:** reserved if implementation keeps a true equal fallback when `sum(effectives) === 0` (should be rare); document in code if used. |

### 2.3 Multi-card map

- **Type:** `Map<string, Map<ModifierType, WorkerRateCard>>` keyed by **`worker_id`**, inner key **`modifier_type`**.
- **Build:** For each row from the existing rate-card query, **`inner.set(card.modifier_type, card)`**. If key already exists, **overwrite and `logger.warn`** with `worker_id`, `modifier_type` (DB EXCLUDE should prevent this).

---

## 3. Task sequence (dependency order)

### Task A — Database migration

| Step                                                                                      | Action                                                                                                                      |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| A1                                                                                        | Add migration under `database/supabase/migrations/` (timestamp prefix per repo convention).                                 |
| A2                                                                                        | `ALTER TABLE worker_rate_card` **drop** `worker_rate_card_modifier_type_check`; **add** check including **`split_weight`**: |
| `modifier_type IN ('per_unit', 'flat', 'multiplier', 'team_percentage', 'split_weight')`. |
| A3                                                                                        | _(Optional v1)_ Add **`display_label TEXT NULL`** to **`worker_rate_card`**; if skipped, note in PR.                        |
| A4                                                                                        | If repo practice updates `database/schema.sql` from migrations, regenerate or patch accordingly.                            |
| A5                                                                                        | **Verify** migration applies cleanly on local Supabase.                                                                     |

**Done when:** CI / local `supabase db` applies migration; no conflicting constraint name.

---

### Task B — Pure split utility + Deno tests

| Step | Action                                                            |
| ---- | ----------------------------------------------------------------- |
| B1   | Add `database/supabase/functions/_utils/worker-payment-split.ts`. |
| B2   | Implement:                                                        |

- Parse `hours_i` from job_worker (caller may pass precomputed hours array).
- Accept `weights: number[]` (same length as workers; always &gt; 0).
- Implement S1 §2.2 branches → **`effectives[]`** + **`warnings: string[]`** + **`allocation_type`** per §2.2 above. |
  | B3 | Implement **`splitPoolToShares(pool, effectives): number[]`**: normalize, round to 2 dp, **reconcile** remainder so **sum === pool** (document algorithm in file header — e.g. assign delta to largest share or last index). |
  | B4 | Add `database/supabase/functions/_utils/__tests__/worker-payment-split.test.ts` (or project-standard path). |
  | B5 | Tests: S0 §5.2 worked example ($184 → 80/80/24 for 8h@1.0, 8h@1.0, 4h@0.6); all weights 1.0 + all hours positive matches legacy time-only split; no hours + mixed weights; mixed times + warning; `sum(shares) === pool`; single worker not used here (caller handles). |

**Done when:** `deno test` (or repo script) passes for new tests.

---

### Task C — Zod + `manage-worker-rate-card`

| Step | Action                                                                                                                                                                                                                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1   | `database/supabase/functions/_utils/zod-schemas.ts`: add **`split_weight`** to **`modifierTypeSchema`**.                                                                                                                                                                               |
| C2   | _(Optional)_ `.superRefine` / `.refine` on create/update: if `modifier_type === 'split_weight'`, enforce `modifier_value <= 10` (or product cap).                                                                                                                                      |
| C3   | `manage-worker-rate-card/index.ts`: extend **`ModifierType`** union with **`split_weight`**.                                                                                                                                                                                           |
| C4   | **Create path:** If `modifier_type !== 'per_unit'` and `field_config_ids` present with `length > 0`, return **400** with clear message (mirror any existing pattern for `flat`/`multiplier` if present; if no pattern, add for all non-`per_unit` types including **`split_weight`**). |
| C5   | **Update path:** Same rule when `field_config_ids` would attach mappings to a non-`per_unit` card.                                                                                                                                                                                     |
| C6   | **List** response already returns cards; no change beyond new enum surviving round-trip.                                                                                                                                                                                               |

**Done when:** Edge deploy accepts create/update **`split_weight`** without `field_config_ids`; rejects spurious field mappings.

---

### Task D — `calculate-worker-payment` (core)

| Step | Action                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1   | Replace **`rateCardMap`** construction with **`Map<worker_id, Map<modifier_type, WorkerRateCard>>`** per §2.3.                                                                                                |
| D2   | Extend **`WorkerRateCard`** type: add **`split_weight`** to **`modifier_type`** union.                                                                                                                        |
| D3   | **`calculateWorkerSplits`:** Change signature to accept **multi-map** (or build a thin resolver: `getCard(workerId, type)`).                                                                                  |
| D4   | Remove **`worker_payment_allocation`** query, **`allocationsByJob`**, and **`allocations`** argument to **`calculateWorkerSplits`** (delete unused type fields if nothing else references them in this file). |
| D5   | In **`calculateWorkerSplits`:**                                                                                                                                                                               |

- Compute **`hours_worked`** per row (unchanged).
- Resolve **`w_i`** from **`split_weight`** card if present, else **1.0**.
- Call **`worker-payment-split`** helpers to get **effectives**, **warnings**, **allocation_type** for base split.
- Set **`time_share`** from **`splitPoolToShares`**.
- Attach **`calculation_warnings`** to the parent **`WorkerPaymentCalculation`** for this job (accumulate if multiple passes — single pass expected). |
  | D6 | **Steps 2–5 (multiplier, per_unit, flat, team_percentage):** For each worker, read **`rateCardMap.get(worker_id)?.get('multiplier')`** (etc.) — not the whole card. |
  | D7 | **`rate_card_id` on split row:** Prefer the card id of the **modifier that last wrote** `time_share` or bonuses; S2 behavior used single card — **DAP:** set `rate_card_id` from **split_weight** card when present for base split; bonus steps may overwrite with their card id (match current behavior for bonuses). |
  | D8 | Add **comment block** above split logic referencing S2 §5 step table. |
  | D9 | **Invariant:** After full job loop, `Math.abs(sum(final_payment) - jobCalc.total_worker_payment) <= 0.01` (within 1 cent per S1/S2) — add **assertion in tests**, not necessarily runtime throw in production. |
  | D10 | Return JSON unchanged at top level except **`job_calculations[i].calculation_warnings`**. |

**Done when:** Multi-worker scenarios with **`split_weight` + `per_unit`** on same worker pay correctly; legacy time-only jobs unchanged when no **`split_weight`** rows exist.

---

### Task E — `save-worker-payment`

| Step | Action                                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| E1   | In **`calculation_details.worker_split`** object, add **`team_percentage_bonus: split.team_percentage_bonus`**. |
| E2   | Re-verify **`job`** fetch filters **`organization_id`** (no regression).                                        |
| E3   | _(Optional ticket only)_ Document server-side recalc follow-up — **no code** in v1 unless explicitly added.     |

**Done when:** Saved batch records include **team %** in nested split details; existing tests updated.

---

### Task F — Dashboard

| Step | Action                                                                                                                                                                                                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1   | `dashboard/lib/services/worker-rate-card.service.ts`: **`ModifierType`** += **`split_weight`**.                                                                                                            |
| F2   | `dashboard/hooks/use-worker-rate-cards.ts`: re-export if needed.                                                                                                                                           |
| F3   | `dashboard/components/worker-payments/rate-card-manager.tsx`: **SelectItem** + labels + helper text for **Split weight**; **modifier value** hint (e.g. 0.6 = 60% of full share in pool logic with hours). |
| F4   | `dashboard/lib/services/worker-payment.service.ts`: **`WorkerPaymentCalculation`** += **`calculation_warnings?: string[]`**.                                                                               |
| F5   | Worker payments **preview** UI (page or dialog that shows calculate result): if **`calculation_warnings?.length`**, show **`Alert`** (shadcn) at job or batch level.                                       |
| F6   | **AU disclaimer:** Short copy + link to Fair Work piece-rate page on **`worker-payments`** page and/or rate card section (admin-only routes).                                                              |
| F7   | Update **`dashboard/__tests__/lib/services/worker-rate-card.service.test.ts`** and any **`use-worker-rate-cards`** tests for new enum.                                                                     |

**Done when:** Admin can create **`split_weight`** card; preview shows warnings; disclaimer visible.

---

### Task G — Integration + regression tests

| Step | Action                                                                                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1   | `dashboard/__tests__/integration/worker-payment-time-splits.test.ts`: update expected **`allocation_type`** / amounts where **`hours × weight`** replaces pure time split; add case for **multi-card** worker. |
| G2   | Any **`calculate-worker-payment`** Deno integration tests in repo — extend or add.                                                                                                                             |
| G3   | Run **`pnpm`** / **`npm`** test targets for dashboard and database functions per `package.json`.                                                                                                               |

**Done when:** CI green.

---

### Task H — Documentation

| Step | Action                                                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- |
| H1   | `docs/research/worker-payment-split-strategies.md`: short “**Status (2026-04)**” blurb pointing to S0–S3 and **`split_weight`**. |
| H2   | Link **S3** from **S2** footer (after file exists).                                                                              |

**Done when:** Docs PR merged with code or immediately after.

---

## 4. Manual QA script (release)

1. **Org with no `split_weight` cards:** Calculate payment for a multi-worker job with times → **same** split as before (spot-check against historical export if available).
2. **Trainee:** `split_weight` 0.6 + two workers at 1.0; hours 8, 8, 4 → **$80 / $80 / $24** on **$184** pool (± rounding).
3. **Multi-card:** Same trainee row + **`per_unit`** on one worker → both **base** and **per-unit** bonus appear.
4. **Mixed times:** One worker missing `start_time` → **warning** in API + UI; split uses **weights_only_mixed_times**.
5. **Rate card UI:** Create, list, deactivate **`split_weight`**; no `field_config` required.
6. **Save:** After save, DB **`worker_payment_batch.calculation_data`** contains **`calculation_warnings`** on job objects; **`team_percentage_bonus`** present in **`calculation_details.worker_split`** when applicable.

---

## 5. Rollback plan

- **Migration down:** restore previous `modifier_type` check without `split_weight` (only if release reverted before any `split_weight` rows exist in prod; otherwise keep migration and **feature-flag** UI).
- **Code revert:** multi-map + split util can be reverted independently; **data** in `worker_rate_card` with `split_weight` would become **invalid** for old code — coordinate migration and deploy order.

---

## 6. Post-implementation checklist (copy to PR)

- [ ] Task A–H complete
- [ ] §2.1–2.3 contracts respected
- [ ] No `rateCardMap.set(worker_id, …)` single-card pattern remains
- [ ] `worker_payment_allocation` fetch removed from calculate path
- [ ] `pnpm test` / Deno tests pass
- [ ] Manual QA §4 executed

---

## 7. References

- [S0](./S0-worker-payment-split-weights.md) · [S1](./S1-worker-payment-split-weights.md) · [S2](./S2-worker-payment-split-weights.md)
- [Fair Work — Piece rates](https://www.fairwork.gov.au/pay-and-wages/minimum-wages/piece-rates-and-commission-payments)

---

_End of S3 — execute tasks A→H; then close v1 MVP._
