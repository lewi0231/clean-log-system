# S1 — Triage: Pay periods, accrual-on-completion, overview vs history, and information architecture

| Field                     | Value                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Stage**                 | S1 — Triage (feasibility, risk, strategic fit, phased scope)                                                                                                                                                                                                                                                                   |
| **From**                  | Product / UX review (2026-04): accrual preference — **automatic** worker-payment adjustment when jobs complete (not **batch-only**); **org-level** pay period (week / fortnight / month); **IA** cleanup (**History** vs **Overview**; **Approve** → **Paid/Unpaid**); **no double-pay** per job; **job edits** → adjustments. |
| **Parent track**          | Builds on [handoff disbursement S2](./S2-worker-payments-disbursement.md) (saved batches, CSV, M-1) and [calculate-ux S1/S2](./S1-worker-payments-calculate-ux.md) / [S3](./S3-worker-payments-calculate-ux.md) (date presets, per-worker preview). **Does not** revoke non-custodial boundary.                                |
| **Triaged**               | 2026-04-28                                                                                                                                                                                                                                                                                                                     |
| **Product**               | Tally Runner — **Worker Payments** (overview, period, accrual, history, settlement **recording**)                                                                                                                                                                                                                              |
| **Gold review**           | _Pending_ — run before locking **S2**                                                                                                                                                                                                                                                                                          |
| **Diamond / Adversarial** | _Optional_ after Gold                                                                                                                                                                                                                                                                                                          |
| **F&F target (next)**     | [`S2-worker-payments-period-accrual.md`](./S2-worker-payments-period-accrual.md) — **created** 2026-04-27                                                                                                                                                                                                                      |

---

## 1. Context: what the dashboard does today

| Area                 | Current behaviour (summary)                                                                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tabs / sections**  | **Payment Overview**, **Payment History**, **Worker Summary**, **Rate cards** — labels mix **“current insight”** with **“log of saved runs.”**                                                                                                                                |
| **Calculate & Save** | **Batch** model: user selects jobs, previews, saves → **`worker_payment_batch`** + **`worker_payment`** rows. [Calculate-ux](./S2-worker-payments-calculate-ux.md) improved **job period selection** and **per-worker preview** but did **not** change the **accrual** model. |
| **History list**     | Named **Payment History**; includes **Approve** for some statuses and **Mark as Paid** for others. Status badges include **Approved**, **Processing**, etc.                                                                                                                   |
| **Overview**         | Card-based summary; perceived as **low signal** relative to “**this fortnight** / **what’s still owed**.”                                                                                                                                                                     |

**Tension:** Operators think in **pay periods** and **per-worker balances**; the UI still centres **explicit batch runs** and workflow words (**Approve**) that read like **payroll authorisation**, which conflicts with **non-custodial** positioning (Tally **records**; it does **not** move money — see [handoff S2](./S2-worker-payments-disbursement.md) **M-1–M-4**).

---

## 2. Problem / opportunity (locked intent)

### 2.1 Information architecture

1. **“Payment History”** reads like a **journal of past events**, not a place to **approve** work. **Approve** implies **authorisation to pay** or **workflow sign-off** — misaligned with **record-keeping** and with the word **History**.
2. Primary operator question for **past** rows: **Was this run paid out externally (recorded) or not?** → surface **Paid / Unpaid** (or **Paid out (recorded) / Unpaid**) rather than **Approved** as the **dominant** badge, unless a separate **internal** workflow is product-approved.
3. **Overview** should answer: **What matters for the current pay period?** — not only aggregate cards that **do not** tie to **period boundaries** and **open obligations**.

### 2.2 Accrual model (product direction — **automatic**)

**Decision (this triage):** Prefer **accrual-style updates** over **batch-only** as the **primary** mental model for **current period** totals.

- When a **job is completed** and meets the product’s **confirmation rule** (see **§4.3**), **worker payment amounts** for the relevant **period** should **update automatically** — i.e. **line items (jobs)** roll into **per-worker** (and **period**) **balances without requiring a separate “Calculate & Save”** for every incremental completion.
- **Batch save** may remain as **snapshot / lock / export / audit** (see **§3** coexistence), but **Overview** should reflect **running** **period** **state**, not only **last manual batch**.

### 2.3 Org-level pay period

- Operators should configure **pay period grain** at **organisation** level: **week**, **fortnight**, or **month** (and **anchor** rules if needed later, e.g. week ending day).
- This replaces **browser-local presets** as the **canonical** “what is **this** fortnight?” for **Overview** and **accrual** boundaries (MVP presets in [calculate-ux](./S2-worker-payments-calculate-ux.md) remain useful for **job picking** until org settings ship).

### 2.4 Overview content (target)

| Intent                    | Description                                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Current period lens**   | Show the **active** **pay period** (dates from org settings).                                                                                                           |
| **Per-worker roll-up**    | **Running** totals for the period, **updated as jobs complete** (accrual), with **job-level** **line** visibility where useful.                                         |
| **Outstanding**           | Amounts / runs **not yet** marked **paid** (externally settled **record**).                                                                                             |
| **Transition to history** | When **outstanding** items are **marked paid** (existing attestation pattern), they **graduate** into **History** as **past** **settled** **records** (exact UX in S2). |

### 2.5 Integrity: no double payment for the same job

- **Problem:** Today, the same job can appear in **more than one** **saved** payment **batch** — **double counting** if interpreted as “amount owed again.”
- **Direction:** Enforce **domain rules**: **one** **primary** **settlement line** per **job** per **relevant** **period** (or explicit **supersede** / **adjustment** rows), and define behaviour when a **job is edited** after amounts were accrued or saved (**adjustment** / **delta** / **re-open period line** — S2 must choose).

---

## 3. Strategic gates (recommendation)

| Gate                                                                | Outcome (this triage)                                                                                                                                                                                                                                                                        | Notes |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| **G1 — IA: History naming + Paid/Unpaid prominence**                | **GO** — Rename **Payment History** → **History** (or **Past pay runs**); **de-emphasise or remove Approve** from **History**; **badge** priority = **Paid / Unpaid** (exact copy in S2; map legacy statuses).                                                                               |
| **G2 — Org pay period settings (week / fortnight / month)**         | **GO** — Settings + persistence; drive **Overview** period boundaries (and later **accrual** **window**).                                                                                                                                                                                    |
| **G3 — Accrual on job completion (automatic roll-up)**              | **GO (direction)** — **Automatic** updates to **period** **worker** balances / line items when **completion + confirmation** rules pass; **not** batch-only for **current** **period** **truth**. **Requires** new **S2** + likely **schema** / **job** **events** / **idempotency** design. |
| **G4 — Overview redesign (period + outstanding + path to History)** | **GO** — **Overview** = **current** **period** **+** **unpaid** **surface**; **History** = **past**; **mark paid** moves items to **History** per product rules.                                                                                                                             |
| **G5 — Anti–double-pay + job edit adjustments**                     | **GO** — **Unique** **intent** per **job** × **period** (or explicit **adjustment**); **edit** path **must not** silently duplicate **full** pay.                                                                                                                                            |

**Coexistence (explicit):** Until accrual ships, **Calculate & Save** remains the **implemented** path; **G3/G4** may **phase**: e.g. **G1+G2** first, then **accrual** backend, then **Overview** swap.

---

## 4. Product decisions for the next S2

### 4.1 History vs Overview

| Topic                     | S1 choice                                                                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **History section title** | Prefer **History** or **Past pay runs** over **Payment History** (final string in S2).                                                                                                                |
| **Approve**               | **Remove** from **History** row actions **or** replace with a **non-payment** word only if a real **internal** approval workflow exists; default = **remove**.                                        |
| **Badges**                | **Lead** with **Paid / Unpaid** (or **Recorded paid / Unpaid**) for operator **scanning**; map existing DB statuses in S2 (e.g. `paid` → Paid; others → Unpaid or intermediate — **open** in **§9**). |
| **Mark as Paid**          | Keep **batch** (or **run**) **attestation** pattern where it still fits; may **move** entry point toward **Overview** / **Outstanding** when **G4** is built.                                         |

### 4.2 Org pay period

| Topic        | S1 choice                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Settings** | **Organisation** field(s): **period type** (week \| fortnight \| month); optional **anchor** (e.g. first period start, or weekday) — **detail in S2**. |
| **Timezone** | **Prefer** **org** **IANA** **timezone** for **period** **cutoffs** (upgrade from browser-only presets for **canonical** **period**).                  |
| **Display**  | **Overview** shows **current** **period** label (date range) + **link** to **settings** if user has permission.                                        |

### 4.3 Accrual trigger (“completion + confirmation”)

**Submitter intent:** When a **job is completed** and **confirmed by any other worker** (or equivalent), **worker payment** **lines** for the **period** **adjust automatically**.

| Topic                  | S1 choice                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Trigger**            | **Minimum:** job reaches **completed** (and **completed_at** set) **and** **confirmation** conditions defined in S2 (see **§9 O-1**).                                                            |
| **“Any other worker”** | **Treat as hypothesis** until mapped to **existing** **job_worker** / **confirmation** fields in repo; may become “**second** **attestation**” or “**customer** **sign-off**” per org — **O-1**. |
| **What updates**       | **Period-scoped** **per-worker** **totals** and **job** **line** **items** (conceptually **ledger** or **materialised** **view** — **S2** **data** **model**).                                   |
| **Idempotency**        | **Re-entrancy** safe if job completion **events** **fire** more than once; **no duplicate** **full** **payment** for same **job** in same **period**.                                            |

### 4.4 Overview

| Topic              | S1 choice                                                                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cards**          | Replace **low-signal** **cards** with **period header**, **per-worker** **table** or **summary**, **outstanding** **batches** / **lines**, **CTA** to **mark paid** / **export** as applicable. |
| **Job line items** | **Running** **visibility** of **which jobs** **compose** each **worker’s** **period** **total** (drill-down in S2).                                                                             |

### 4.5 Double pay + edits

| Topic                        | S1 choice                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Same job, two batches**    | **Block** or **warn** in UI; **enforce** in **save** path where possible — **S2** **defines** **unique** **constraint** or **application** **rule**.                                              |
| **Job edited after accrual** | **Adjustment** **event** (delta row, supersede, or **recalc** **period** **segment**) — **not** a second **full** **duplicate** **pay** for the **same** **job** **without** **audit** **trail**. |

---

## 5. Relationship to existing artefacts

| Artefact                                                                | Relationship                                                                                                                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [S2-worker-payments-disbursement](./S2-worker-payments-disbursement.md) | **CSV**, **reconciliation**, **list** — remains **relevant** for **exported** **snapshots**; **dateRange** honesty / **payments** shape **still** apply. |
| [S3-worker-payments-disbursement](./S3-worker-payments-disbursement.md) | **Handoff** **rules** **unchanged** unless **this** **track** **amends** **persistence**.                                                                |
| [S2-worker-payments-calculate-ux](./S2-worker-payments-calculate-ux.md) | **Date** **presets** / **per-worker** **preview** — **complementary**; **org** **period** **may** **subsume** **local** **presets** for **Overview**.    |
| [S3-worker-payments-calculate-ux](./S3-worker-payments-calculate-ux.md) | **Implemented** **batch** **UX**; **accrual** **may** **reduce** **reliance** on **manual** **Calculate** for **routine** **period** **work**.           |

---

## 6. Technical feasibility (initial)

| Area            | Notes                                                                                                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Events**      | Need **reliable** **signal** when job becomes **complete** and **confirmed** — **webhook**, **DB trigger**, or **client** **mutation** **after** **last** **step**; **idempotent** **handlers**.                             |
| **Storage**     | Possible **models**: **(a)** **materialised** **period** **balances** table; **(b)** **append-only** **ledger** + **queries**; **(c)** **derive** from **jobs** + **saved** **`worker_payment`** — **trade-offs** in **S2**. |
| **Performance** | **Recalc** **one** **job** vs **full** **period** **rebuild** — **S2** **spike**.                                                                                                                                            |
| **Concurrency** | **Edit** **job** **while** **overview** **open** — **versioning** or **checksum**.                                                                                                                                           |

---

## 7. Risk assessment

| Risk                                                   | Likelihood | Impact                                        | Mitigation                                                                                                               |
| ------------------------------------------------------ | ---------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Accrual** **drift** vs **bank** **reality**          | Medium     | **Disputes**                                  | **Reconciliation** **lines**; **explicit** **“as of”** **time**; **CSV** **still** from **persisted** **truth**.         |
| **Confirmation** **rule** **wrong**                    | Medium     | **Missing** **or** **duplicate** **accruals** | **O-1** **spike** **on** **real** **job** **lifecycle**.                                                                 |
| **Large** **migration** from **batch-first** **users** | Medium     | **Confusion**                                 | **Phased** **rollout**; **tooltips**; **optional** **manual** **batch** **mode** **retained** **during** **transition**. |
| **“Paid”** **badge** vs **DB** **enum** **mismatch**   | Low        | **Wrong** **colour** **state**                | **S2** **status** **matrix** **+** **tests**.                                                                            |

---

## 8. Open questions (resolved in S2)

| ID      | Question                                                           | Resolution (see [S2](./S2-worker-payments-period-accrual.md#8-open-questions-resolved-from-s1-8))                                                                 |
| ------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O-1** | Exact **definition** of **"confirmed by any other worker"**        | **Resolved:** S1 phrase was hypothesis. Use `job.approval_status === "approved"` — set when all non-submitter colleagues confirm. Solo jobs approved immediately. |
| **O-2** | Should **manual** **Calculate & Save** remain **forever**?         | **Resolved:** **Yes.** Creates auditable snapshots for CSV export. Accrual + explicit save coexist.                                                               |
| **O-3** | **Period** **boundary** **inclusive** **rules** (cutoff, timezone) | **Resolved:** Start inclusive (00:00), end inclusive (23:59:59.999). Use org IANA timezone.                                                                       |
| **O-4** | **Mark as paid** **granularity**: batch vs line vs worker          | **Resolved:** **Batch-level** for Phase A/B. Per-worker deferred to Phase C+.                                                                                     |

---

## 9. Acceptance criteria (triage → S2 handoff)

- [x] **G1–G5** are **reflected** in **one** **locked** **S2** **F&F** — see [S2](./S2-worker-payments-period-accrual.md) with **explicit** **phase** **dependencies** (A–D).
- [x] **Accrual** **trigger** **documented** — see [S2 §4.3](./S2-worker-payments-period-accrual.md#43-accrual-trigger-definition-g3--o-1-resolved) with `isJobReadyForAccrual` predicate.
- [x] **Org** **period** **settings** **schema** **sketched** — see [S2 §4.2](./S2-worker-payments-period-accrual.md#42-organisation-pay-period-settings-g2).
- [x] **Double-pay** **prevention** **rule** **stated** — see [S2 §4.5](./S2-worker-payments-period-accrual.md#45-double-pay-prevention-g5) with SQL predicate.
- [x] **Migration** **note** for **existing** **batches** — see [S2 §7](./S2-worker-payments-period-accrual.md#7-migration--compatibility) (no CSV changes).

---

## 10. Phased delivery (proposal)

| Phase                  | Scope (indicative)                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **A — IA + honesty**   | **G1**: rename **History**, **badges**, **remove** **misleading** **Approve**; **copy** pass **(M-1)**.                  |
| **B — Org period**     | **G2**: **settings** + **Overview** **period** **header** (even before **full** **accrual**).                            |
| **C — Accrual engine** | **G3** + **G5**: **events**, **persistence**, **anti-duplicate**, **edit** **adjustments**.                              |
| **D — Overview**       | **G4**: **replace** **cards** with **period** **+** **outstanding** **+** **mark** **paid** **flow** **to** **History**. |

Phases **B–D** may **overlap**; **A** can ship **independently**.

---

## 11. Gold review — _pending_

_Run before **S2** lock: cross-check against **job** **model**, **worker_payment** **schema**, and **existing** **status** **APIs**._

---

## 12. Adversarial review — _pending_

_Stress-test: **solo** **worker** **job**, **mid** **period** **settings** **change**, **timezone** **DST**, **orphan** **batch**, **CSV** **reconciliation** **after** **accrual**._

---

**Next step:** **S2 created** — see [`S2-worker-payments-period-accrual.md`](./S2-worker-payments-period-accrual.md) with **normative** **data** **rules**, **UI** **sections**, **migration**, **and** **verification** **commands**. Run **Gold review** (§11) before S3 DAP.
