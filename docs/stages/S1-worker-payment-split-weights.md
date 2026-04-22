# S1 — Triage: Relative split weights (`hours × weight`) + payment split hardening

| Field           | Value                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------- |
| **Stage**       | S1 — Triage (feasibility, risk, phased scope)                                             |
| **From S0**     | [`S0-worker-payment-split-weights.md`](./S0-worker-payment-split-weights.md) (2026-04-22) |
| **Triaged**     | 2026-04-22                                                                                |
| **Gold review** | 2026-04-22 — findings in **section 8**; mandates in **3.1**                               |
| **Product**     | Clean Log (pricing, worker payments, rate cards)                                          |

---

## 1. S0 recap

Organizations need a **pool-preserving** way to split the **job worker payment** among multiple workers: **implicit weight 1.0** when unconfigured, lower weights for trainees (e.g. **0.6**), and **`hours × split_weight`** when time ranges exist so **late starters** get less time credit automatically. **Additive** modifiers (`per_unit`, `flat`, `team_percentage`) and legacy **`multiplier`** remain in the picture but need a **clear order of operations**. **Job-level `worker_payment_allocation`** exists in the schema but is **not applied**. **Australia:** Fair Work context and admin disclaimers; **audit** for rate cards is missing compared to pricing and job edits.

---

## 2. S1 decisions (resolved here)

### 2.1 Core formula and defaults

| Decision            | Choice                                                                                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Base split**      | `effective_i = hours_i × split_weight_i`; **`split_weight_i = 1.0`** when no active **`split_weight`** rate card applies.                                                                       |
| **Pool assignment** | `base_share_i = round_currency(pool × (effective_i / Σ effective_j))` with documented **rounding + penny reconciliation** so **Σ base_share ≈ pool**.                                           |
| **Storage (v1)**    | New **`modifier_type` value: `split_weight`**; **`modifier_value`** = weight (must be **> 0**, existing check). Revisit a dedicated worker profile column in a later phase if the domain grows. |

### 2.2 Time data: all-or-nothing for weighted split (v1)

| Situation                                                                                   | Behavior (v1)                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Every** worker on the job has **`start_time`**, **`end_time`**, and **positive** duration | Use **`hours × split_weight`**.                                                                                                                                                                                                                                                                                                                                   |
| **No** worker has usable times (same as today’s “no hours”)                                 | **`effective_i = split_weight_i`** (normalize weights). If **all** weights are **1.0**, this is **equal** split — same as today’s equal fallback when no clocks.                                                                                                                                                                                                  |
| **Mixed** (some workers have times, some do not)                                            | **Do not** apply a partial hours model in v1. **Fall back to weights-only:** `effective_i = split_weight_i`. Surface a **`calculation_warnings`** entry (e.g. _“Some workers missing time range; split used weights only.”_) so admins can fix data. If **all** weights are **1.0** and times are mixed, result is **equal** split but **warning still applies**. |

**Rationale:** Avoids silent underpayment of workers with missing clocks while keeping implementation and support predictable. **S2** can add org-level policies (strict block, imputed hours, etc.).

### 2.3 Effective dates and timezone

| Topic              | Choice                                                                                                                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`effective_to`** | **Inclusive** calendar end date, consistent with existing fetch pattern (`effective_to.is.null` OR `effective_to >= today`). Document for admins: “Last day the card applies.”                                                                           |
| **“Today”**        | Use **organization-appropriate** date where possible (default **Australia** orgs: align with existing app patterns — if the calculator uses UTC date only today, **S2** may refine to org timezone; **S1** documents current behavior in release notes). |

### 2.4 Order of operations (single recipe)

Applied **per job** after **`total_worker_payment`** (base pool) is known from pricing:

1. **Resolve** each worker’s **`split_weight`** from active rate card (else **1.0**).
2. **Base pool split** using section **2.2** + **2.1** → **`base_pool_share`** per worker (working name; may still serialize as `time_share` for backward compatibility in v1 — see **4.4**).
3. **Legacy `multiplier`** (if any): apply **per worker** to **that worker’s `base_pool_share`** as implemented today (may change **org total**). **Document** in UI that **`split_weight`** is for **fair pool sharing**, **`multiplier`** is a **separate adjustment**.
4. **`per_unit`**, **`flat`**, **`team_percentage`**: unchanged relative ordering vs today **after** multiplier step, unless implementation review shows a bug — **S1 deliverable** includes a short **comment block + doc** in code listing the exact order.

**Note:** Long term, **`multiplier`** may be deprecated in favor of **weight + bonuses** only; not required for v1.

### 2.5 `worker_payment_allocation`

| Phase         | Scope                                                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v1**        | **Out of scope to wire** (keep DB + fetch or stop fetching — see **4.3**). Focus on **`split_weight`** + fallbacks.                                                                 |
| **v1.1 / S2** | Implement **override** when rows exist for the job: validated **percentages** or **weights**, then **replace** step 2 only; steps 3–4 unchanged unless product specifies otherwise. |

Stakeholder preference was to **keep the table**; S1 explicitly defers wiring to avoid blocking **`split_weight`**.

### 2.6 Ops: label, expiry notification, audit

| Item                                        | Phase                                                                                                                                                                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Optional display label** (“Trainee FY26”) | **Gold review:** Prefer **v1** if migration is already touching `worker_rate_card`; otherwise **v1.1** is acceptable — **do not** leave **`role_title`** ambiguous (repurpose with clear UI copy **or** add **`display_label`**). |
| **Expiry notification to admins**           | **v1.1** — scheduled Edge Function or cron: cards with **`effective_to` = yesterday** (or within N days) → **in-app notification**; email optional.                                                                               |
| **`worker_rate_card` audit**                | **v1.1** — append-only **`worker_rate_card_audit`** mirroring **`pricing_rule_audit`** (trigger on insert/update/delete).                                                                                                         |

### 2.7 Australia / compliance (product)

| Item                  | Choice                                                                                                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Disclaimer**        | **v1:** Short **admin-only** copy on worker payments / rate cards: internal split does not replace **award**, **NES**, or **minimum pay** obligations; employer verifies payroll compliance. Link **Fair Work Ombudsman** piece-rate overview. |
| **Payslip / records** | Product does not replace payroll systems; **transparent breakdown** (hours, weight, effective dates, base share) is the goal for exports and previews.                                                                                         |

---

## 3. Technical feasibility

### 3.1 Touchpoints

| Layer                | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **DB**               | Migration: extend `worker_rate_card_modifier_type_check` to include **`split_weight`**; optional **`display_label`** column (see **section 8** — align with phased table).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Edge**             | **`manage-worker-rate-card`**: allow `split_weight` in **TypeScript `ModifierType`** and **`modifierTypeSchema` (Zod)**; validate no `field_config_ids` required (same as `flat` / `multiplier`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Edge**             | **`calculate-worker-payment`**: replace pure split logic with **`hours × weight`** + fallbacks; **extract** to **`_utils/worker-payment-split.ts`** (or similar) with **Deno tests**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Edge (mandatory)** | **Refactor rate card indexing** — today the function builds `rateCardMap.set(worker_id, card)` in a loop, so **only one row per worker survives** (nondeterministic without `ORDER BY`). The DB allows **one active card per `(worker_id, modifier_type)`** overlap window, so a worker can legally have **`split_weight` + `per_unit`** (etc.) at once. **v1 must** replace this with a structure that preserves **all** active cards per worker (e.g. `Map<worker_id, Map<modifier_type, WorkerRateCard>>` or `Map<`${worker_id}:${modifier_type}`, …>`), then: lookup **`split_weight`** for the base split; lookup **`multiplier` / `per_unit` / …** in existing steps. **This is a gold-review blocker** — adding `split_weight` without fixing the map **silently drops** other modifiers. |
| **Dashboard**        | **`rate-card-manager`**: new modifier option, glossary strings, AU disclaimer snippet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Shared types**     | Dashboard **`ModifierType`** / API types updated wherever `modifier_type` is enumerated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### 3.1.1 Response shape: warnings

- Extend **`calculate-worker-payment`** JSON (per job or aggregated) with an optional **`calculation_warnings: string[]`** (or per-job object) so the dashboard preview can surface **mixed-times** and similar cases without scraping logs.

### 3.2 Pseudocode (base split only)

```
function basePoolShares(pool, workers, rateCardByWorkerId):
  weights = workers.map(w => rateCardByWorkerId[w.id]?.split_weight ?? 1.0)
  hours = workers.map(w => durationHours(w.start, w.end))

  if all(h > 0 for h in hours):
    effectives[i] = hours[i] * weights[i]
  else if not any(h > 0 for h in hours):
    effectives = weights  // no clocks: trainee weight still applies
  else:
    effectives = weights  // mixed times: weights-only + warning
    push_warning("Some workers missing time range; split used weights only.")

  sumEff = sum(effectives)
  if sumEff == 0: equal split pool
  else: shares = roundAndReconcile(pool, effectives / sumEff)
```

Align implementation with **2.2** exactly (including warning payload for mixed-times + equal weights).

### 3.3 Fetching allocations today

**Decision:** Until **`worker_payment_allocation`** is implemented, **remove the DB fetch** from **`calculate-worker-payment`** **or** keep it but **do not pass** to split (dead code). **S1 recommendation:** **Remove fetch** in v1 to reduce confusion and query cost; restore when overrides ship.

### 3.4 Testing

| Test type       | Coverage                                                                                                                                                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit (Deno)** | Single worker; equal weights + hours; trainee lower weight; **late start** (fewer hours); **no hours** → **weights-only**; **mixed times** → weights-only + warning; **multi-card** worker (`split_weight` + `per_unit`) both apply; rounding **sums to pool**. |
| **Regression**  | Snapshot or fixture: existing jobs with **only** `multiplier` / `per_unit` still produce expected totals within tolerance.                                                                                                                                      |

### 3.5 Risks to existing data

- Orgs with **only** time-based split and **no** `split_weight` cards should see **identical base shares** to today (**all weights 1.0**).
- Orgs using **`multiplier`** today: behavior preserved after base split; **document** interaction.

---

## 4. Risk assessment

| Risk                                             | Likelihood | Impact              | Mitigation                                                                                 |
| ------------------------------------------------ | ---------- | ------------------- | ------------------------------------------------------------------------------------------ |
| **Mixed time data** surprises admins             | Medium     | Medium              | **Explicit warning** in calculation response + docs; optional dashboard banner in preview. |
| **`multiplier` + `split_weight`** confuses users | Medium     | Low                 | **UI glossary**, tooltips, examples in Settings.                                           |
| **Rounding** drift vs invoice total              | Low        | Medium              | **Reconcile** last cent; tests; document rule.                                             |
| **Fair Work / award** misunderstanding           | Low        | High (reputational) | **Disclaimer**; no “legal compliance” claims in product.                                   |
| **Large edge function** regression               | Medium     | High                | **Extract** pure functions + tests before wide refactor.                                   |

---

## 5. Phased delivery

| Phase                 | Deliverables                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **v1 (MVP)**          | `split_weight` **modifier**; **`hours × weight`** + **2.2** fallbacks; **multi-card rate lookup** fix (section **3.1**); extracted **tested** split util; **manage-worker-rate-card** + **`zod-schemas`** + **`calculate-worker-payment`**; **`calculation_warnings`** in response; dashboard **rate card** UI + **AU disclaimer**; **remove** unused allocation fetch; **update** `docs/research/worker-payment-split-strategies.md` cross-reference. |
| **v1.1**              | **`worker_rate_card_audit`**; **expiry** notifications; **`display_label`** if not shipped in v1.                                                                                                                                                                                                                                                                                                                                                      |
| **Later (post-v1.1)** | Wire **`worker_payment_allocation`**; org policy for **mixed times**; timezone-aware **effective** dates; consider **deprecating** `multiplier`. Tracked in **`S2-worker-payment-split-weights.md`** §7.                                                                                                                                                                                                                                               |

---

## 6. Acceptance criteria (v1)

1. Worker with **no** `split_weight` card receives **weight 1.0** in the base split.
2. Two workers **8h @ 1.0**, one **4h @ 0.6** on pool **$184** yields **$80 / $80 / $24** (within **$0.01** after rounding).
3. **No** usable times for anyone → **weights-only** split (all weights **1.0** ⇒ **equal**).
4. **Mixed** times → **weights-only** or **equal** per **2.2**, plus **warning** payload key for UI (e.g. `calculation_warnings: string[]`).
5. **Expired** or **inactive** cards do not apply (existing date filter + `is_active`).
6. Admin can **create** and **edit** a `split_weight` card from the dashboard.
7. **Disclaimer** visible to admins on worker payments / rate card area.

---

## 7. Open items for S2 / product (not blocking v1)

- **Per-worker output** fields for true piece-rate-by-person.
- **Wage-rate-weighted** split (`hours × hourly_rate`) as a separate strategy.
- **Tip-out** / revenue-based routing.
- Full **payroll export** format for Australian **STP**-capable systems (if ever in scope).

---

## 8. Gold review (codebase cross-check)

Independent pass against **`calculate-worker-payment`**, **`manage-worker-rate-card`**, and **Zod** enums. Goal: catch **implementation landmines** before build.

### 8.1 Findings and resolutions

| #      | Finding                                                                                                                                                                                                                         | Severity   | Resolution                                                                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **G1** | **`rateCardMap` stores one card per `worker_id`** — last row in the fetch wins; query has **no guaranteed order**. Schema allows **multiple modifier types** per worker (non-overlapping `(worker_id, modifier_type)` windows). | **High**   | **v1 mandatory:** Refactor to **multi-card** lookup (section **3.1**). Add tests where one worker has **`split_weight` + `per_unit`** active.                                              |
| **G2** | **`team_percentage`** uses **`time_share`** of **other** workers **after** **`multiplier`** (current step order). **`per_unit` / `flat`** do not inflate the base used for team %.                                              | **Info**   | **Document** in code comment when implementing **split_weight** so future changes do not reorder steps blindly.                                                                            |
| **G3** | **`todayDate`** uses **`new Date().toISOString().split("T")[0]`** (UTC), not org timezone — aligns with S1 **2.3** “document current behavior”; AU orgs may see **off-by-one** on `effective_*` near midnight UTC.              | **Low**    | **v1:** Document in admin copy / release notes. **S2:** org timezone or “payment calculation date” override.                                                                               |
| **G4** | **`save-worker-payment`** / persisted splits may need to store **warnings** and **allocation_type** refinements (`weighted_hours`, `weights_only_fallback`, etc.) for audits.                                                   | **Low**    | **v1:** Optional — include warnings in API only; **v1.1** with **`worker_rate_card_audit`** can extend persisted payloads if payroll needs them.                                           |
| **G5** | **Single-worker jobs** skip split math today; **`split_weight`** is irrelevant for base **100%** — bonuses still apply.                                                                                                         | **Info**   | Keep behavior; add **unit test** so regression does not force split path.                                                                                                                  |
| **G6** | **Dashboard + Zod** must list **`split_weight`** everywhere **`ModifierType`** / `modifierTypeSchema` is exhaustive — easy to miss one surface and get **400** from Edge.                                                       | **Medium** | Checklist: **`manage-worker-rate-card`**, **`zod-schemas.ts`**, **`worker-rate-card.service.ts`**, **`use-worker-rate-cards`**, **`rate-card-manager.tsx`**, any **shared** package types. |
| **G7** | **S1 doc inconsistency (pre-review):** testing row said “no hours equal split” while **2.2** says **weights-only**.                                                                                                             | **Low**    | **Fixed** in section **3.4**.                                                                                                                                                              |
| **G8** | **`positiveNumberSchema`** for **`modifier_value`** — confirm **`split_weight`** allowed range (e.g. **0.01–10**); today schema may allow very large numbers.                                                                   | **Low**    | **S1 optional:** add **`.max(10)`** (or product cap) in Zod for `split_weight` only (discriminated refine).                                                                                |

### 8.2 Gold verdict

**Ready for S2 / implementation** once **G1 (multi-card map)** is explicitly in the **v1** scope — without it, **`split_weight` would be unsafe** alongside existing modifiers.

---

## 9. References

### Internal

- [S0 — Worker payment split weights](./S0-worker-payment-split-weights.md)
- `database/supabase/functions/calculate-worker-payment/index.ts`
- `database/supabase/functions/manage-worker-rate-card/index.ts`
- `dashboard/components/worker-payments/rate-card-manager.tsx`
- `docs/research/worker-payment-split-strategies.md`

### External (non-exhaustive)

- [Fair Work Ombudsman — Piece rates and commission](https://www.fairwork.gov.au/pay-and-wages/minimum-wages/piece-rates-and-commission-payments)

---

_End of S1 — gold-reviewed. **Next:** [S2 — Features & Functions](./S2-worker-payment-split-weights.md)._
