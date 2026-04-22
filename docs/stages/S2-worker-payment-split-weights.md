# S2 — Features & Functions / High-Level Plan: Worker split weights (`hours × weight`)

| Field                  | Value                                                                        |
| ---------------------- | ---------------------------------------------------------------------------- |
| **Stage**              | S2 — Features & Functions (scope lock before S3 DAP / ticket breakdown)      |
| **From S1**            | [`S1-worker-payment-split-weights.md`](./S1-worker-payment-split-weights.md) |
| **Created**            | 2026-04-22                                                                   |
| **Gold review (S2)**   | 2026-04-22 — **section 10** (codebase cross-check vs S1 inheritance)         |
| **Adversarial review** | 2026-04-22 — **section 11**                                                  |
| **Product**            | Tally Runner                                                                 |

---

## 1. S1 recap (locked for this delivery)

- **Base split:** `effective_i = hours_i × split_weight_i` when **every** worker on the job has **positive** duration from `start_time` / `end_time`.
- **Default weight:** **1.0** when no active **`split_weight`** rate card.
- **No times for anyone:** **weights-only** (`effective_i = split_weight_i`); all weights **1.0** ⇒ equal split.
- **Mixed times:** **weights-only** + **`calculation_warnings`** entry (no partial hours in v1).
- **Storage:** new **`modifier_type`:** **`split_weight`**; **`modifier_value`** &gt; 0.
- **Blocker (G1):** Replace **single** `rateCardMap` per worker with **multi-card** lookup so **`split_weight` + `per_unit`** (etc.) can coexist.
- **Order:** base split → **`multiplier`** → **`per_unit`** → **`flat`** → **`team_percentage`** → **`final_payment`** (team % uses others’ **`time_share`** after multiplier — S1 G2).
- **Allocations fetch:** **remove** from `calculate-worker-payment` in v1 (restore when overrides exist).
- **Response:** optional **`calculation_warnings`** (job-level or aggregated — DAP picks shape).
- **v1.1 (separate track):** rate card **audit**, **expiry** notifications, optional **`display_label`**.

---

## 2. Product boundaries

| In scope (v1 MVP)                                        | Out of scope (v1)                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| **`split_weight`** rate cards + **multi-card** fetch fix | Wiring **`worker_payment_allocation`** (§7)                              |
| **`hours × weight`** + fallbacks per S1 §2.2             | Org timezone for **`effective_*`** (document UTC “today”)                |
| **`calculation_warnings`** on calculate API              | Persisting warnings in **`save-worker-payment`** payload (optional v1.1) |
| Dashboard: modifier option, glossary, **AU disclaimer**  | **STP** / payroll export                                                 |
| Deno **unit tests** for split util + regression          | Rate card **audit** table (v1.1)                                         |

---

## 3. Personas & user stories

| Persona            | Story                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Org admin**      | As an admin, I want to set a **trainee** to a **lower split weight** (e.g. 0.6) so the **same job pool** divides fairly without a separate invoice total. |
| **Org admin**      | I want **staggered start times** to reduce a worker’s share automatically via **hours × weight**.                                                         |
| **Org admin**      | I want **warnings** when time data is **mixed** so I can fix clocks before paying.                                                                        |
| **Org admin (AU)** | I see a **short disclaimer** that splits are **allocation only** and do not replace **award / minimum** obligations.                                      |
| **Finance / ops**  | I need **per_unit** (or other modifiers) to still apply for a worker who **also** has **`split_weight`** (G1 fix).                                        |

---

## 4. Rate card & modifier matrix (build inventory)

**Rule:** At most **one active row** per **`(worker_id, modifier_type)`** overlap window (DB EXCLUDE). A worker may have **many modifier types** simultaneously.

| `modifier_type`       | Used in base split?     | After base?                                             | `field_config_ids`                                                   |
| --------------------- | ----------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| **`split_weight`**    | **Yes** (resolve `w_i`) | No                                                      | **Not allowed** (reject on create/update like `flat` / `multiplier`) |
| **`multiplier`**      | No                      | **Yes** (on `time_share`)                               | No                                                                   |
| **`per_unit`**        | No                      | **Yes** (additive)                                      | **Required** when type is `per_unit` (Zod + Edge validation today)   |
| **`flat`**            | No                      | **Yes**                                                 | No                                                                   |
| **`team_percentage`** | No                      | **Yes** (% of others’ **`time_share`** post-multiplier) | No                                                                   |

**DAP must** implement lookups **by type**, not “first card wins.”

**`allocation_type` strings (v1):** Extend or reuse existing values so saved splits remain explainable — e.g. keep **`time_based`** when **hours × weight** path used; add **`weights_only`** / **`weights_only_mixed_times`** (exact names in DAP) for fallbacks. Document in UI tooltip.

---

## 5. Calculation pipeline (code exactly — adversarial clarity)

For each job, after **`total_worker_payment`** (= **base pool** from pricing only — the amount to split before per-worker modifiers) is computed from **`calculateWorkerPayment(...)`**:

| Step  | Action                                                                                                                                                                                                        | Notes                                                                                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Load **all** active rate cards for org (existing query + **multi-map** build).                                                                                                                                | No `ORDER BY` dependency for correctness. If two rows share same `(worker_id, modifier_type)` (DB violation), **last insert wins** in map — **log error** (see §11).                                              |
| **2** | For each `job_worker`, compute **`hours_i`** (existing duration logic).                                                                                                                                       |                                                                                                                                                                                                                   |
| **3** | Read **`split_weight`** card if any → **`w_i`**; else **1.0**.                                                                                                                                                |                                                                                                                                                                                                                   |
| **4** | Compute **`effective[]`** per S1 §2.2; append to **`calculation_warnings`** for mixed times.                                                                                                                  |                                                                                                                                                                                                                   |
| **5** | **`base_share_i`** = normalized pool assignment + **rounding reconcile**.                                                                                                                                     | Assign into **`time_share`** in JSON for **backward compatibility**.                                                                                                                                              |
| **6** | **`multiplier`** card: adjust **`time_share`** + **`multiplier_adjustment`**.                                                                                                                                 |                                                                                                                                                                                                                   |
| **7** | **`per_unit`**, **`flat`**, **`team_percentage`** in **existing** order.                                                                                                                                      | Team % sums **others’ `time_share`** after step 6.                                                                                                                                                                |
| **8** | **`final_payment`** = `time_share + per_unit_bonus + flat_bonus + team_percentage_bonus` (unchanged formula).                                                                                                 |                                                                                                                                                                                                                   |
| **9** | **Job row total:** `calculation.total_worker_payment += sum(per_unit_bonus + flat_bonus + multiplier_adjustment + team_percentage_bonus)` across splits (**existing reducer** in `calculate-worker-payment`). | **Gold-verified:** This keeps **aggregated** `total_worker_payment` equal to **sum of `final_payment`** for that job after the increment. **DAP:** after refactor, assert invariant with a unit/integration test. |

**Single-worker jobs:** **100%** of base pool to sole worker for **`time_share`** before step 6; steps 6–8 unchanged.

---

## 6. Features (v1)

### 6.1 Database

- **Migration:** `ALTER` **`worker_rate_card_modifier_type_check`** to include **`split_weight`**.
- **Optional in v1:** **`display_label TEXT NULL`** on **`worker_rate_card`** (if not deferred to v1.1 per S1).
- **No** change to **`worker_payment_allocation`** in v1.

### 6.2 Shared module: `worker-payment-split` (name TBD)

- **Location:** e.g. `database/supabase/functions/_utils/worker-payment-split.ts`.
- **Exports (suggested):**
  - `computeEffectiveCredits(hours[], weights[], policy)` → `{ effectives, warnings, allocationTag }`
  - `splitPoolByCredits(pool, effectives)` → `number[]` with **reconcile** to 2 decimal places
- **Pure functions** only — no Supabase client.
- **Deno tests** colocated e.g. `__tests__/worker-payment-split.test.ts`.

### 6.3 Edge: `calculate-worker-payment`

- Build **`Map<worker_id, Map<modifier_type, WorkerRateCard>>`** (or equivalent) from fetch results.
- Replace inline split block with **util**; attach **`calculation_warnings: string[]`** to each **`WorkerPaymentCalculation`** (recommended) **or** top-level aggregate — **pick one** and mirror in **`WorkerPaymentService`** TypeScript types.
- **Remove** `worker_payment_allocation` query and `allocationsByJob` wiring.
- **Comment block** at top of split section listing **§5** order.

### 6.4 Edge: `manage-worker-rate-card`

- **`ModifierType`** + create/update validation: **`split_weight`**; **reject** `field_config_ids` when type is **`split_weight`** (mirror **`multiplier`** / **`flat`** rules).

### 6.5 Edge: `zod-schemas.ts`

- Add **`split_weight`** to **`modifierTypeSchema`**.
- Optional **S1 G8:** `refine` on create/update — if `modifier_type === 'split_weight'`, cap **`modifier_value`** (e.g. ≤ 10).

### 6.6 Dashboard

- **`rate-card-manager.tsx`:** Select option **Split weight (pool share)**; help text: **hours × weight**; link to glossary.
- **`ModifierType`** in **`worker-rate-card.service.ts`**, **`use-worker-rate-cards.ts`**, tests.
- **`worker-payment.service.ts`:** extend **`WorkerPaymentCalculation`** with optional **`calculation_warnings?: string[]`**; surface in **preview** UI (Alert/banner).
- **Disclaimer** component or copy block on **`worker-payments`** page and/or rate card card (AU + Fair Work link).

### 6.7 Documentation

- Update **`docs/research/worker-payment-split-strategies.md`** with a short “**Implemented**” pointer to this S2 + release behavior.
- **Admin release note:** UTC **effective** dates; multi-card fix **may change** historical preview if org had multiple modifier rows and wrong card “won” before.

### 6.8 Save path & persisted details (gold finding)

- **`save-worker-payment`** persists **`calculation`** from the **request body** (`calculation_data` on batch + per-worker rows). It does **not** re-run **`calculate-worker-payment`** server-side today.
- **Product / security implication:** Saved amounts **trust** the client payload. Normal flow: dashboard calls **calculate** then **save** with that payload. A **modified client** could submit fabricated splits. **DAP options:** (a) document as **accepted risk** for v1; (b) **v1.1:** re-invoke calculate inside **save** and compare totals (or replace payload). See **§11.2**.
- **Data completeness:** `calculation_details.worker_split` today omits **`team_percentage_bonus`** while **`WorkerPaymentSplit`** includes it. **DAP:** add **`team_percentage_bonus`** to persisted JSON for audit parity (small, safe addition).

---

## 7. Deferred backlog (post-v1.1)

| Item                                   | Notes                                                   |
| -------------------------------------- | ------------------------------------------------------- |
| **`worker_payment_allocation`**        | Override base split only; validate sum 100% or weights. |
| **`worker_rate_card_audit`**           | Mirror **`pricing_rule_audit`**.                        |
| **Expiry notifications**               | Scheduled job + in-app (and optional email).            |
| **Org timezone** for “today”           | Reduces AU edge case (S1 G3).                           |
| **Persist warnings** on saved payments | If payroll / disputes need immutable snapshot.          |
| **Server-side recalc on save**         | Optional hardening (§11.2).                             |
| **Deprecate `multiplier`**             | Product decision after `split_weight` adoption.         |

---

## 8. Non-functional requirements

| NFR                        | Target                                                                                                                                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Correctness**            | **Σ** base shares = pool within **$0.01** after reconcile; **Σ `final_payment`** = job **`total_worker_payment`** after bonus increment; tests enforce.                                                                                                                    |
| **Backward compatibility** | Jobs with **no** `split_weight` cards and **only** time split → **same** base shares as pre-change (all weights 1.0).                                                                                                                                                      |
| **Observability**          | Structured log when **weights-only** or **mixed-times** path used (`job_id`, warning codes).                                                                                                                                                                               |
| **Security**               | **`calculate-worker-payment`** verifies org membership via **`verifyOrganizationMembershipFromRequest`** (service role + JWT). **`save-worker-payment`** uses same pattern for batch create — **does not** cryptographically bind save payload to prior calculate (§11.2). |
| **Performance**            | Removing allocation query reduces one round-trip per calculate call.                                                                                                                                                                                                       |

---

## 9. Testing strategy (S3 / QA preview)

| Layer           | Cases                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Unit (Deno)** | S1 §6 acceptance + **G5** single worker; **G8** cap if implemented; rounding edge (pool $0.01).                                                                                                        |
| **Unit**        | **Multi-card:** worker A has **`split_weight` 0.6** + **`per_unit`** — both apply.                                                                                                                     |
| **Regression**  | Golden fixture: 3 workers, hours only, no weight cards → matches **pre-refactor** numbers.                                                                                                             |
| **Integration** | Update **`dashboard/__tests__/integration/worker-payment-time-splits.test.ts`** (and any Edge tests under **`database/supabase/functions/**tests**/**`) when **`allocation_type`\*\* or totals change. |
| **Dashboard**   | Create **`split_weight`** card; list/filter; modifier labels; **warnings** visible when API returns them.                                                                                              |
| **Manual**      | Mixed times job → warning visible in preview.                                                                                                                                                          |
| **Invariant**   | One test: **`sum(final_payment) === jobCalc.total_worker_payment`** per job after calculation loop.                                                                                                    |

---

## 10. Gold review (S2 — codebase cross-check, 2026-04-22)

Pass over **this S2** against the **current** repo (not only S1). Goal: ensure the plan is **implementable without hidden contradictions**.

| #         | Finding                                                                                                                                                                                                               | Severity                 | Action taken in this doc                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **S2-G1** | **`total_worker_payment` mutation** after splits: existing code adds **`per_unit + flat + multiplier_adjustment + team_percentage`** to the **pre-split** job total. **§5 step 9** must stay aligned or totals drift. | **High**                 | **§5 step 9** documents the **existing reducer**; **§8** + **§9** require **sum(final) === job total** test. |
| **S2-G2** | **`save-worker-payment`** trusts **client-supplied** `calculation`; no server recalc.                                                                                                                                 | **Medium** (trust model) | **§6.8** + **§11.2**; **§7** defers optional server recalc.                                                  |
| **S2-G3** | **`calculation_details.worker_split`** omits **`team_percentage_bonus`** while the split object includes it.                                                                                                          | **Low** (audit gap)      | **§6.8** — DAP adds field.                                                                                   |
| **S2-G4** | **`calculate-worker-payment`** already enforces **org membership** (JWT + service role). S2 previously implied “no new security” only — now explicit.                                                                 | **Info**                 | **§8** updated.                                                                                              |
| **S2-G5** | **`WorkerPaymentCalculation`** in dashboard has no **`calculation_warnings`** — types would lie after API change.                                                                                                     | **Medium**               | **§6.6** mandates TS update.                                                                                 |
| **S2-G6** | **`allocation_type`** taxonomy: new split paths need distinct labels for support.                                                                                                                                     | **Low**                  | **§4** paragraph added.                                                                                      |
| **S2-G7** | S1 **§8 G7** already fixed; S2 **§9** testing row must mention **integration** file path.                                                                                                                             | **Low**                  | **§9** lists **`worker-payment-time-splits.test.ts`**.                                                       |

**Verdict:** S2 is **consistent** with code **if** §5 step 9 and multi-map (G1) are implemented together with **invariant tests**. **No** change to locked product formula.

---

## 11. Adversarial review (red team, 2026-04-22)

### 11.1 Attacker / failure model

| Actor                             | Capability                | Concern                                                                     |
| --------------------------------- | ------------------------- | --------------------------------------------------------------------------- |
| **Malicious authenticated admin** | Custom HTTP client        | Submit **save-worker-payment** with **inflated** `calculation` (bypass UI). |
| **Compromised browser extension** | Mutate fetch responses    | Unlikely; same as any SPA.                                                  |
| **Honest admin + bad data**       | Mixed times, wrong clocks | **Warnings** + incorrect pay if ignored.                                    |

### 11.2 Mitigations and residual risk

| Topic                             | Mitigation in design                                                                                                                                                                   | Residual                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Forged save payload**           | **v1:** Rely on **auth** + **org scoping**; document that save is **not** cryptographically bound to calculate. **v1.1 (§7):** optional **server recalculate** and reject on mismatch. | Until (b), **insider with API access** could post arbitrary splits. |
| **Duplicate rate cards (DB bug)** | **Multi-map:** last row wins per type; **log** duplicate `(worker_id, modifier_type)` when building map.                                                                               | Rare if EXCLUDE constraint holds.                                   |
| **Extreme `split_weight`**        | Zod **max** + UI hints (§6.5).                                                                                                                                                         | Edge orgs could still use legally valid but odd weights below cap.  |
| **Rounding attack**               | **Reconcile** pennies in one defined direction; test **sum** invariant.                                                                                                                | None if invariant test passes.                                      |
| **UTC `effective_to` midnight**   | Document for AU admins (S1 G3).                                                                                                                                                        | Off-by-one card day until timezone S2 item ships.                   |

### 11.3 Abuse cases explicitly **not** in v1 scope

- **Cross-org job_id** in save: mitigated by **job** query filtered by **`organization_id`** before insert (existing save path) — **DAP** re-verify when touching save.
- **Rate limit** on calculate/save: not required for v1; optional **per-org** throttle later if needed.

---

## 12. Post–S2 gate (quality checklist)

- [ ] **§5** pipeline order is **one** place in code (comment + implementation match).
- [ ] **Multi-map** replaces single `rateCardMap` — **no** remaining `set(worker_id, …)` overwrite.
- [ ] **`split_weight`** appears in **every** `ModifierType` / Zod enum surface (S1 G6 checklist).
- [ ] **Allocations** query **removed** per S1.
- [ ] **Warnings** shape locked (**per job** recommended) and **dashboard** + **TS types** updated.
- [ ] **AU disclaimer** visible to admins only.
- [ ] **`sum(final_payment) === total_worker_payment`** test per job (**§9**).
- [ ] **§6.8** save/trust model acknowledged (docs or ticket for server recalc).
- [ ] **Docs** cross-link S0 → S1 → S2.

---

## 13. Handoff to S3 (DAP)

Suggested DAP sections:

1. **Migration** file(s) + `schema.sql` regen if repo practice requires.
2. **`_utils/worker-payment-split.ts`** + tests.
3. **`calculate-worker-payment/index.ts`** refactor diff (multi-map, split util, warnings, remove allocation fetch, **§5 comment**).
4. **`manage-worker-rate-card`** + **`zod-schemas`**.
5. **Dashboard:** `rate-card-manager`, **`worker-payment.service.ts`** types, preview UI for warnings, disclaimer.
6. **`save-worker-payment`:** add **`team_percentage_bonus`** to **`calculation_details.worker_split`**; document or ticket **server recalc** (optional).
7. **Integration:** `worker-payment-time-splits.test.ts` + Deno tests.
8. **Manual QA script** (happy path, trainee late start, mixed times, multi-card per_unit).

---

## 14. References

- [S0 — Worker payment split weights](./S0-worker-payment-split-weights.md)
- [S1 — Triage](./S1-worker-payment-split-weights.md)
- [Fair Work — Piece rates and commission](https://www.fairwork.gov.au/pay-and-wages/minimum-wages/piece-rates-and-commission-payments)
- Code: `database/supabase/functions/calculate-worker-payment/index.ts`, `save-worker-payment/index.ts`, `manage-worker-rate-card/index.ts`, `database/supabase/functions/_utils/zod-schemas.ts`, `dashboard/components/worker-payments/rate-card-manager.tsx`, `dashboard/lib/services/worker-payment.service.ts`, `dashboard/__tests__/integration/worker-payment-time-splits.test.ts`

---

_End of S2 — gold- and adversarial-reviewed. **Next:** [S3 — Detailed Action Plan](./S3-worker-payment-split-weights.md)._
