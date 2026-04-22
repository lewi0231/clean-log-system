# S0 — Idea Intake: Relative split weights for multi-worker pay (pool-preserving) + payment subsystem hardening

| Field        | Value                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| **Stage**    | S0 — Idea capture (not triage; no build commitment)                                                   |
| **Captured** | 2026-04-22                                                                                            |
| **Updated**  | 2026-04-22 (section 4.4 patterns; section 5.2 decisions, edge-case example, AU compliance, audit/ops) |
| **Product**  | Clean Log (organization / worker job logging, pricing, worker payments)                               |
| **Source**   | Product owner — operational pay fairness (trainee vs experienced on same job)                         |

---

## 1. Idea (submitter language)

When **several workers** share one job, the **total worker payment** from pricing should be split so that:

- **By default**, everyone is treated the same: **relative weight 100%** (equivalently **1.0**), which means **no extra configuration** (no rate card required) and an **even** distribution **when that is the chosen basis** (see section 5.2).
- If someone is **less “deserving” of a full share** (e.g. a new starter), an admin can set their **relative weight lower** (e.g. **0.6** = 60% of a full slot). **Two workers at 1.0 and one at 0.6** on a **$260** pool should pay **$100 / $100 / $60** — the **full pool is preserved**; only the **proportions** change.

This is **not** the same as arbitrary **additive** bonuses only: it is an explicit **equity / experience factor** on **how the shared pool is divided**.

---

## 2. Problem / opportunity (why this matters)

- **Fairness:** Same shift length and same job does **not** always mean each person should get an **identical** share; employers often pay trainees or juniors a **smaller slice of the crew pool** while keeping the **customer / pricing** worker total unchanged.
- **Gap today:** `calculate-worker-payment` splits the base pool primarily by **time on job** (or **equal** split if times are missing). **Rate card `multiplier`** scales a worker’s **time-based** share and interacts with **total adjustments** in ways that do **not** match a clean **“weights sum to pool”** mental model. There is **no** first-class **relative weight** with **implicit 1.0**.
- **Latent capability:** `worker_payment_allocation` exists in the database and is **loaded** by the calculator but **not applied** in `calculateWorkerSplits` — a source of confusion and missed job-level overrides.
- **Maintainability:** Split logic, additive modifiers, and naming (`time_share`, etc.) are **easy to misread** and **risky to change** without tests and a clearer **strategy** boundary.

---

## 3. Success (what “good” looks like — draft)

- **Default:** Workers without a configured weight behave as **weight = 1.0** for pool splitting (no rate card required for “normal” crew).
- **Configured:** A worker can have an explicit **relative weight** (e.g. 0.6–1.0+ if product allows) such that **sum of distributed base shares equals the pricing-derived worker pool** (within a documented **rounding** rule).
- **Clarity:** Admins can distinguish **“share of team pool” (weight)** from **per-unit bonuses, flat bonuses, team-percentage add-ons**, and any legacy **multiplier** behavior — via **UI copy** and **docs**.
- **Optional job overrides:** (Phase to confirm in S1.) Job-level **allocations** can **override** defaults for edge cases.
- **Robustness:** **Unit-tested** pure split functions, **explicit** split strategy, and **invariants** (e.g. totals reconcile after rounding).

_(Exact KPIs, acceptance tests, and migration rules belong in S1/S2.)_

---

## 4. Research summary (landscape — not a decision yet)

### 4.1 External context (brief)

- **Piece rates and teams:** Public guidance (e.g. U.S. DOL piecework / regular-rate material; industry articles on piece rates) emphasizes that **team production** makes **per-unit attribution** difficult; employers often rely on **agreed allocation rules**, **hours**, or **internal shares**. A **fixed-pool proportional split** is a standard **mathematical** pattern; it does **not** by itself satisfy **minimum wage / overtime** obligations — **compliance remains the employer’s responsibility** (S1 may add a one-line product disclaimer for admins).
- **Weighted averages:** HR/payroll material discusses **weighted** allocation when multiple rates or buckets apply — analogous to needing a **clear definition** of `effective_i` (weight only vs **hours × weight**).

### 4.2 Current codebase (facts for S1)

| Area                                                                | Notes                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`database/supabase/functions/calculate-worker-payment/index.ts`** | Large edge function; **`calculateWorkerSplits`** applies **time-based** (or equal) base split, then **`multiplier`**, **`per_unit`**, **`flat`**, **`team_percentage`**. **`allocations`** passed as **`_allocations`** — **unused** (“reserved for future”).                                                                           |
| **`worker_rate_card`**                                              | Evolved from hourly model to **`modifier_type` / `modifier_value`** (see migrations `20260119000003_refactor_worker_rate_card_modifiers.sql`, `20260120000001_add_team_percentage_modifier_type.sql`). Overlap constraint is per **`(worker_id, modifier_type)`** date range — **different** modifier types can coexist for one worker. |
| **`per_unit` modifiers**                                            | Use **job-level** `submission_data` for **all** workers on the job — suitable for **bonuses tied to job totals**, **not** “units completed by worker A vs B” unless data model evolves.                                                                                                                                                 |
| **`docs/research/worker-payment-split-strategies.md`**              | Older research; describes rate cards, **`worker_payment_allocation`**, and phased strategy — **implementation partially diverged** (allocations not wired). S1 should **reconcile** this doc with any new design.                                                                                                                       |
| **Dashboard**                                                       | `dashboard/components/worker-payments/rate-card-manager.tsx` — manages modifiers; will need **clear labels** if **split weight** becomes a modifier or a separate field.                                                                                                                                                                |

### 4.3 Design options (for S1 triage — not decided in S0)

| Option                                                             | Description                                                             | Tradeoffs                                                                                                                               |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **A. New `modifier_type`** (e.g. `split_weight` / `equity_weight`) | `modifier_value` = relative weight; **no card** ⇒ implicit **1.0**.     | Fits existing **effective dating** and rate-card UI; **conflates** “pool split” with “bonus modifiers” unless copy and docs are strong. |
| **B. Dedicated column or profile table**                           | e.g. `default_split_weight` on worker or `worker_compensation_profile`. | **Cleaner domain** separation; more **schema + UI** surface.                                                                            |
| **C. Job-level only**                                              | Use **`worker_payment_allocation`** with weights or percentages.        | Good for **one-off** jobs; **heavy** for “trainee is always 0.6 until promoted.”                                                        |

**Formula (conceptual):**  
`payment_i = pool × (effective_i / Σ effective_j)` where **`effective_i = h_i × w_i`** when **time on job** is available (**stakeholder decision 2026-04-22** — see section 5.2). If hours are **missing or zero** for everyone, fall back to **equal split** or **weights-only** normalization per org policy (S1 to lock fallback order).

**Order of operations (recommended direction for S1):**

1. Compute **base worker pool** from pricing (unchanged).
2. Apply **pool split** (equal / time / **weighted** / future allocation override) → **base share per worker**; **preserve pool** (after rounding policy).
3. Apply **additive** modifiers (`per_unit`, `flat`, `team_percentage`, and any **explicit** legacy **`multiplier`** semantics) with **documented** rules (e.g. what “team %” applies to).

### 4.4 Common business patterns for adjusting pay on shared work (popular options)

The following summarizes **frequently used** approaches in operations, team incentives, and pooled pay (e.g. hospitality), informed by general HR/industry summaries and tip-pooling guides. It is **not** legal advice; jurisdictions differ (especially tips, minimum wage, and who may participate in a pool).

| Pattern                                  | What businesses often do                                                                                                           | Clean Log today (approx.)                                                                                       | Gap / product note                                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Equal split**                          | Everyone gets **1/N** of the crew pool                                                                                             | **Yes** when there are **no** usable time ranges on `job_worker` (equal fallback)                               | Org-level default is reasonable; document when it applies.                                                                |
| **Hours-only proportional**              | Pool split **∝ hours worked** (common in tip pools)                                                                                | **Yes** — primary path when `start_time` / `end_time` exist                                                     | Matches “$ per hour in pool” mental models.                                                                               |
| **Weighted / credited hours**            | Each hour counts **partially** by role/seniority (e.g. 10h at 100% + 10h at 50% **credited** as 10 + 5); pool ∝ **credited hours** | **Partial** — hours exist; **no** equity weight on hours yet (**this S0**)                                      | **`hours × split_weight`** is the direct analog (popular in restaurant “weighted hours” explanations).                    |
| **Fixed equity weights (no hours)**      | Same shift; **trainee 0.6**, full rate **1.0**; pool ∝ weights                                                                     | **Not** first-class; **`multiplier`** is not the same as **pool-normalized weights**                            | **Proposed `split_weight`** (or equivalent).                                                                              |
| **Job-level percentages**                | Manager sets **40 / 35 / 25** for this job only                                                                                    | **Schema** (`worker_payment_allocation`) **exists**; **not applied** in split math                              | Wire + validate **sum ≈ 100%** (or weights).                                                                              |
| **Role / title buckets**                 | e.g. “servers 60%, bartenders 25%, bussers 15%” then sub-split                                                                     | **No** first-class roles on the split                                                                           | Often maps to **per-worker weight** or **allocation** if roles are stable.                                                |
| **Attributed output (piece per person)** | Pay **∝ units** each worker produced on the job                                                                                    | **No** in base split; **`per_unit`** uses **job-level** `submission_data` (same total for each eligible worker) | Needs **per-worker counts** (or line-item attribution) to avoid double-counting.                                          |
| **Flat role / shift premium**            | Fixed **$X** extra for lead, opener, or trainee stipend                                                                            | **`flat`** modifier (additive)                                                                                  | Already additive; clarify it does **not** solve pool redistribution by itself.                                            |
| **“Lead” % of others’ shares**           | Supervisor earns **% of team base** (not necessarily additive to customer total)                                                   | **`team_percentage`** (implemented as **additive** on top of others’ time-shares)                               | Align docs with customer **total worker payment** expectations (additive vs redistributive).                              |
| **Multiplier on own share**              | “**1.2×** my piece of the pool”                                                                                                    | **`multiplier`** on time-share                                                                                  | Changes individual shares; **pool preservation** differs from **normalized weights** — S1 should separate concepts in UI. |
| **Wage-rate–weighted split**             | Implicit **hourly rate × hours** drives share of a fixed pool (different hourly “weights”)                                         | **Not** aligned with current schema (rate cards are **modifiers**, not a wage column for split)                 | Optional future: **`effective_i = hours × hourly_weight`** from a profile.                                                |
| **Tip-out / revenue pass-through**       | **% of sales** (or category) routed to a role (e.g. bar, host)                                                                     | **Not** modeled                                                                                                 | Niche for some field-service orgs; likely **out of scope** unless tied to pricing line items.                             |
| **Tournament / top-performer bonus**     | Discretionary **bonus to MVP**                                                                                                     | **Not** modeled                                                                                                 | Usually **outside** automated job pool; manual adjustment or separate bonus workflow.                                     |
| **Profit / gain sharing**                | Pool tied to **org or site P&L** vs baseline                                                                                       | **Out of scope** for per-job calculator                                                                         | Different layer (reporting, periodic true-up).                                                                            |

**Synthesis (for S1):**

- The **proposed relative weight** (default **1.0**, pool-preserving) is the standard way to express **seniority / trainee / “credited hour”** style fairness **without** changing the priced worker total — it aligns with **weighted-hours** explanations used in pooled pay operations.
- **Hours-only**, **equal**, **weights**, and **job-level %** cover a **large share** of small-business crew scenarios; **per-person output** is the next common ask once **attribution data** exists.
- Patterns we **do not** need to match in v1 for most cleaning/field orgs: **tournament** awards, **profit sharing**, **complex tip-out matrices** — note as **future / out of scope** unless a customer segment demands them.

**Recommended additions to the roadmap (from this scan):**

1. **`hours × split_weight`** as the **default** when both exist — matches popular **weighted-hours** pool logic.
2. **Explicit job-level allocation** — completes the **manager override** story already in the schema.
3. **Per-worker output** (optional field or submission shape) — unlocks **piece-rate-by-person** without abusing job-total **`per_unit`**.
4. **Glossary in admin UI:** “**Weight** (share of pool)” vs “**Bonus** ($/unit, flat, % of team)” vs “**Multiplier** (legacy / adjust share)” — reduces misconfiguration.

### 4.5 Refactoring opportunities (beneficial regardless of exact product choice)

1. **Extract pure split + bonus math** into a **small testable module** (e.g. under `database/supabase/functions/_utils/`) consumed by the edge function — reduce **monolith** risk in `calculate-worker-payment/index.ts`.
2. **Introduce an explicit split strategy** (enum or discriminated union): e.g. `time_proportional | equal | weighted | allocation_override` — avoid **implicit** ordering bugs.
3. **Rounding contract:** Define **cent rounding** and optional **last-worker adjustment** so **`Σ final_payment`** matches **`total_worker_payment`** within **tolerance**; encode in tests.
4. **Naming:** Consider renaming or aliasing **`time_share`** in API payloads when the split is **not** time-based (e.g. **`base_pool_share`**).
5. **`worker_payment_allocation`:** **Implement** validation + application in splits, or **stop fetching** until implemented — reduce **dead code** confusion.
6. **`per_unit` documentation / guards:** Document **double-count risk** when multiple workers share a **job-level** count; consider future **per-worker** attribution fields if product needs true output-based split.
7. **Schema validation:** `modifier_value > 0` today; weights like **0.6** are valid; S1 may add **upper bound** (e.g. ≤ 10) to catch typos.

---

## 5. Stakeholder preferences (captured) vs open questions (S1)

### 5.1 Captured preferences (product direction)

| Topic                | Preference                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| **Default**          | **No rate card** ⇒ treat worker as **100% / 1.0** relative weight for the split.                         |
| **Trainee / junior** | Lower **relative weight** (e.g. **0.6**) so **full-rate** workers are **1.0**; **pool total unchanged**. |
| **Mental model**     | **Proportional weights** (example: **$260** → **$100 / $100 / $60** for weights **1, 1, 0.6**).          |

### 5.2 Decisions, edge cases, and recommendations (2026-04-22)

#### Trainee starts later — how does **`hours × split_weight`** behave?

**Recommendation:** Use **credited hours** per worker from their **`job_worker`** time range, then:

`effective_i = hours_i × split_weight_i` (implicit **`split_weight = 1.0`** if no active weight card).

A **late start** means **fewer `hours_i`**, so the trainee’s share drops **before** applying the trainee **weight**. The **weight** then further reduces (or increases) their **per-hour equity** versus full-rate workers.

**Worked example (pool preserved, $184):**

| Worker                     | Time on job | `split_weight` | Credited (`h × w`) | Share of pool |
| -------------------------- | ----------- | -------------- | ------------------ | ------------- |
| A (experienced)            | 8 h         | 1.0            | 8.0                | 8.0 / 18.4    |
| B (experienced)            | 8 h         | 1.0            | 8.0                | 8.0 / 18.4    |
| C (trainee, started later) | 4 h         | 0.6            | 2.4                | 2.4 / 18.4    |

Sum of credits = **18.4**. Payments: **A = $80**, **B = $80**, **C = $24** (check: 80 + 80 + 24 = 184).

So: **less time** and **lower weight** compound in a predictable, standard “weighted hours” way.

**If hours are wrong or missing:** S1 should define a **fallback chain** (e.g. treat missing times as **equal hours** vs **reject calculation** vs **weights-only**). Document clearly in UI so admins know when equal-split fallback applies.

---

#### Mapping to prior “open questions” list

| #     | Topic                                           | Resolution / recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Hours vs weights**                            | **Adopt `hours × split_weight`** when valid time ranges exist (see example above).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **2** | **Storage (`modifier_type` vs column)**         | **Still S1 triage.** Pragmatic path: add **`split_weight`** as a **`modifier_type`** for speed and effective dating; revisit a dedicated profile table if the domain grows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **3** | **Legacy `multiplier`**                         | **Keep for now**; document how it interacts with **`split_weight`** once implemented. Can **deprecate or narrow** later if it confuses admins.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **4** | **Job overrides (`worker_payment_allocation`)** | **High-level priority (intended end state):** (a) If the job has a **complete** manual allocation (e.g. percentages or weights for every worker on that job, validated to sum correctly), **use that** for the **base pool split** instead of the default formula. (b) Otherwise, use **org defaults**: **`hours × split_weight`** with implicit **1.0** weight. (c) **Additive** modifiers (**`per_unit`**, **`flat`**, **`team_percentage`**, and any retained **`multiplier`** rules) apply **after** the base split unless product explicitly chooses otherwise — **S1** must write the single ordered recipe so totals stay explainable. **Why this matters:** overrides are for exceptions (“this job only”); defaults handle trainees and staggered starts day to day.                                                                                                                                                                                                                                                                                                                         |
| **5** | **Expiry, labels, notifications, roles, audit** | **Expiry:** Rate cards must **not** apply outside **`effective_from` / `effective_to`** (and **`is_active`**); the calculator already filters active cards by date — S1 should confirm **inclusive/exclusive end date** behavior and document it. **Badge / label:** Add an optional **admin-visible label** (e.g. **`display_label`** or clarified use of **`role_title`**) for UI, exports, and notifications (“Trainee rate”, “FY26 weight”). **Notifications:** Notify **org admins** when a card **reaches end of effectiveness** (daily job or scheduled check; in-app and/or email — channel in S1). **Roles:** **Org admins** (same cohort as rate card management today). **Auditing:** Today the app has **`pricing_rule_audit` / `pricing_condition_audit`** (triggers on pricing tables) and **`job_edits`** (job change history). There is **no dedicated `worker_rate_card` audit table** in the migrations reviewed for this S0 — **recommend** the **same trigger + append-only audit pattern** for **`worker_rate_card`** (and related junction rows) so pay disputes can be traced. |
| **6** | **Compliance (Australia)**                      | **Not legal advice.** In Australia, pay is governed by the **Fair Work Act**, **National Employment Standards**, and any **modern award** or **enterprise agreement** that applies. **Piece rates / commission** have specific rules; see the **Fair Work Ombudsman** — [Piece rates and commission payments](https://www.fairwork.gov.au/pay-and-wages/minimum-wages/piece-rates-and-commission-payments). A **fixed pool split** between workers is an **internal allocation** of amounts the employer already owes; it does **not** by itself remove **minimum pay**, **allowance**, **record-keeping**, or **payslip** obligations. **Product recommendation:** (1) **Short admin disclaimer** in worker-payment settings (e.g. splits are for allocation only; employer responsible for award/minimum compliance). (2) Ensure **exported / saved payment breakdowns** are **transparent** (weights, hours, effective dates) to support payroll and disputes. (3) **S1:** optional **locale** copy for **en-AU** (org default already supports AUD in schema).                                    |

---

### 5.3 Remaining items for S1 (short)

- **Fallback** when some workers have times and others do not (same job).
- **Inclusive vs exclusive `effective_to`** and timezone (Australia / org locale).
- **Notification** implementation detail (cron, edge function, email provider).
- **Whether `worker_payment_allocation`** remains in scope for v1 or stays schema-only slightly longer (stakeholder leaning **keep schema**, wire when ready).

---

## 6. Out of scope for S0 (explicit)

- Final schema migrations and Edge Function contracts.
- Exact dashboard UX and copy.
- Rewriting **invoice** / **customer** pricing logic (unless S1 discovers a **must-fix** inconsistency with worker totals).
- Legal review beyond a **generic** “employer responsibility” reminder.

---

## 7. Post–gate check (S0 quality)

> If someone reads this idea in 6 months with no other context, will they understand what was meant?

**Reader should take away:** Clean Log should support **relative split weights** so multi-worker jobs can divide a **fixed worker pool** with **implicit 1.0** for everyone by default and **lower weights** (e.g. trainees) without inventing a new total; **implementation** should integrate cleanly with (or replace the misuse of) **multiplier**, **wire or drop unused allocations**, and **refactor** split math into **tested, explicit strategies** for long-term robustness.

---

## 8. References

### External (illustrative — S1 may deepen)

- U.S. eCFR — [29 CFR § 778.111 — Pieceworker](https://www.law.cornell.edu/cfr/text/29/778.111) (context: team piece rates and regular rate — **not** prescriptive for product math).
- AccountingTools — [Piece rate pay calculation](https://www.accountingtools.com/articles/piece-rate-pay-calculation) (general industry framing).
- The Ohio State University — [Designing Effective Pay-for-performance Systems — Team Incentive Plans](https://u.osu.edu/ohioagmanager/2006/10/01/designing-effective-pay-for-performance-systems-for-employees-and-suppliers-part-v-team-incentive-plans/) (team incentives, equal vs contribution-based tradeoffs).
- Elevate — [Team based incentive plans: types and methods](https://www.elevate.so/blog/types-of-team-incentives-plan/) (gain sharing, profit sharing, team bonuses — **org-level** patterns).
- Kickfin — [Restaurant tip pooling / split structures](https://kickfin.com/blog/how-to-calculate-and-split-tips-for-employees/) (hours-based, role-based %, weighted-hour style examples).
- Homebase — [Tip pooling and splitting guide](https://joinhomebase.com/blog/tip-pooling) (pooling models, compliance note that **rules vary by jurisdiction**).
- Fair Work Ombudsman (Australia) — [Piece rates and commission payments](https://www.fairwork.gov.au/pay-and-wages/minimum-wages/piece-rates-and-commission-payments) (award/agreement context; minimum pay; **not** specific to internal team splits).
- Fair Work Ombudsman — [Home page](https://www.fairwork.gov.au/) (awards, NES, record-keeping).

### Internal (codebase)

- `database/supabase/functions/calculate-worker-payment/index.ts` — **`calculateWorkerSplits`**, allocation fetch, rate cards.
- `database/supabase/migrations/20260119000002_create_worker_rate_card_tables.sql` — **`worker_rate_card`**, **`worker_payment_allocation`**.
- `database/supabase/migrations/20260119000003_refactor_worker_rate_card_modifiers.sql` — modifier model.
- `docs/research/worker-payment-split-strategies.md` — historical proposals vs current behavior.
- `dashboard/components/worker-payments/rate-card-manager.tsx` — admin UI for modifiers.
- `database/supabase/migrations/20251202004000_add_pricing_audit.sql` — **`pricing_rule_audit`**, **`pricing_condition_audit`** (pattern to mirror for rate cards if desired).
- `database/supabase/migrations/20251210152912_add_job_edits_audit.sql` — **`job_edits`** audit trail for job updates.

---

_End of S0. **Next:** [S1 — Triage](./S1-worker-payment-split-weights.md) (phased scope, locked decisions, acceptance criteria)._
