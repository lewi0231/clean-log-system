# S1 — Triage: Paying workers (disbursement / handoff) — scope, phasing, GO

| Field              | Value                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| **Stage**          | S1 — Triage (feasibility, risk, strategic fit, phased scope)                                      |
| **From S0**        | [`S0-worker-payments-disbursement.md`](./S0-worker-payments-disbursement.md) (2026-04-27)         |
| **Triaged**        | 2026-04-27                                                                                        |
| **Gold review**    | **Completed** 2026-04-27; **track re-check** 2026-04-27 (S3 DAP) — see **§4.1** and **S3** **§7** |
| **Diamond review** | **Completed** 2026-04-27 — cross-doc + edge cases; see **S2** §12                                 |
| **Product**        | Tally Runner (Worker Payments dashboard, payment batches)                                         |

---

## 1. S0 recap

S0 asked what **“paying workers”** should mean: today the product **calculates** and **saves** amounts, and **“Mark as Paid”** is **attestation** (method / date / reference) — it does **not** **disburse** funds, provide **per-worker** bank handoff, or **integrate** with payroll or banking. The gap is **operator double-entry**, **expectation** risk on the word _payment_, and **limited audit** compared to a **per-worker** trail suitable for remittance or payroll.

---

## 2. S1 decision: strategic recommendation

| Gate                                                        | **Outcome**                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1 (Disbursement / handoff v1)**                          | **GO** — **non-custodial** scope only: the product **does not hold funds** and **does not initiate bank transfers** in v1. Ship **(a)** **clear, durable messaging** on what the feature does, **(b)** a **per-worker, per-batch export** (or equivalent download) so admins can pay via **external** bank / payroll without re-keying from job totals, **(c)** optional **tightening** of payment history to show that **per-worker** lines are the **source** for that export. |
| **G1 (Initiate / move money, payroll API, ABA generation)** | **DEFER (re-triage)** — high **compliance**, **security**, and **vendor** cost; not required to unlock **v1** value. Re-open when: **(i)** a **jurisdiction** and **1–2** **anchor customers** are committed, **(ii)** legal review of “payment agent” language is available if we ever act as a channel.                                                                                                                                                                        |
| **G1 (Worker mobile “my pay”)**                             | **DEFER** for disbursement v1; **org-admin workflow** is the constraint. Revisit in a separate S0 if workers report trust issues.                                                                                                                                                                                                                                                                                                                                                |

**Rationale:** A **credible, honest** v1 (clarity + **structured handoff**) reduces the worst failure modes (**mis-selling** and **transcription error**) with **low** regulatory surface. **Payout execution** and **KYC**-style data are a **different product** layer.

---

## 3. S1 product decisions (resolved for v1 / later)

### 3.1 Product boundary (public and in-app)

| Topic                 | v1 choice                                                                                                                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What we say**       | **Single sentence** in **Worker Payments** and **mark-paid** context: e.g. _Tally Runner calculates amounts and records your team’s pay run; it does not transfer money to workers._ (Exact copy in S2 / content pass.)                               |
| **“Mark as Paid”**    | **Rename** is **optional** in v1; **minimum** = **subheading or helper** under the button: _Record that payment was completed in your bank or payroll system_ — no rename required if the helper is unmissable.                                       |
| **Jurisdiction**      | **Australia**: keep **Fair Work** pointer as **context** (per existing product lines), not **compliance** guarantee. **US / other:** **one** line _Verify obligations under local wage and contractor rules_ — no country-specific tax filing claims. |
| **STP / tax / super** | **Not in v1**; any future export is **earnings/amount** data for **re-entry**, not a **lodgement** or **payslip** product unless a later **G1** approves.                                                                                             |

### 3.2 Unit of handoff and data shape

| Topic               | v1 choice                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit**            | **One saved payment batch** → **N workers** (aggregate **per worker** across jobs in the batch, with optional **per-job** drill-down in the file or a second tab). **Per-job-only** export alone is **insufficient** for a typical “pay the crew this week” run.                                                                                                                                                    |
| **Source of truth** | **Verified (Gold):** **`save-worker-payment`** persists full **`calculation_data`** and inserts one **`worker_payment`** row per split (or equal-split allocation). **`list-worker-payments`** returns **`calculation_data`** and nested line items as **`payments`**. v1 **export** reads from that persisted shape; **very old** or partial rows may need **`calculation_data`–only** or degraded UX (S2 **§8**). |
| **Worker identity** | Export columns: **at minimum** `worker_id`, **display name**, **currency amount(s)**. **BSB / account** are **out of v1** unless a **separate** **G1** on **sensitive** **PII** storage is run (retention, encryption, consent).                                                                                                                                                                                    |

### 3.3 Export format (v1)

| Option          | v1 choice                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Primary**     | **CSV** (UTF-8), **per batch**: **(1)** `worker_totals` — one row per worker; **(2)** optional `job_details` — worker × job lines for audit, or a **second** file. |
| **ABA / bank**  | **Not v1** — format and **DDA** / **debtor** rules are **bank-specific**; re-triage with AU accountant input.                                                      |
| **Xero / MYOB** | **Not v1** — **v1.1** candidate if a **single** **manual import** spec is **documented** and **low** **variance** across orgs.                                     |

### 3.4 Relationship to split math (other S1)

- **[`S1-worker-payment-split-weights.md`](./S1-worker-payment-split-weights.md)** (and implemented **`split_weight`**) **feeds** the **per-worker** numbers that a disbursement **export** must show. **Disbursement v1** should **not** re-implement **split** logic; it **displays/serializes** what **`calculate-worker-payment`** and **persisted** rules already produce.
- **Order:** if **split_weight** is not yet in production, **export** can still ship using **current** `worker_splits` as returned today — the **S1** docs should note **version** in **export** metadata (e.g. **calculator** **version** or **rule effective time**) if available for **disputes** (S2).

### 3.5 Cash / invoice / worker payout — single view

| Question (S0 §4.4)                                    | S1 choice                                                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Link **customer invoice** cash to **worker** payouts? | **Out of v1** — **larger** **finance** / **P&L** product. **v1.1+** if **treasurer** persona emerges. **Do not** block **export** on this. |

---

## 4. Technical feasibility (Gold review — completed 2026-04-27)

| Area                                           | Notes                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`WorkerPaymentService.exportPaymentsToCSV`** | Today is **job-level** and **coarse** (see S0). **v1** adds a **per-worker** builder that consumes **`payment.payments`** (API) / `worker_payment` rows + **`currency`**, and optionally **`calculation_data`** for names/audit.                                                                                 |
| **`list-worker-payments`**                     | **Gold:** Selects **`calculation_data`**, embeds **`worker_payments:worker_payment (…)`**, maps to a **`payments`** array on each batch. **DAP** is **not** blocked by “missing per-worker lines on list” — the **TypeScript** `PaymentRecord` type is **incomplete** vs runtime (add `payments?`, `currency?`). |
| **`save-worker-payment`**                      | **Gold:** Inserts `worker_payment` for each job×worker with amounts from splits or equal-split path; **batch.total_payment** aligns with the calculation.                                                                                                                                                        |
| **Types**                                      | **Gold:** Align **`PaymentRecord`** (or a **`LoadedPaymentBatch`**) with list response, including line items; document **`dateRange`** is **not** a true job range today (see S2).                                                                                                                               |
| **Dashboard**                                  | **Payment detail** / **history** row: add **“Download CSV (per worker)”** when **reconciliation** passes (S2).                                                                                                                                                                                                   |
| **PII**                                        | **No** new **account numbers** in v1 — unchanged.                                                                                                                                                                                                                                                                |

### 4.1 Gold review — findings → doc / build actions

| ID     | Finding                                                                                                                                       | Severity       | Action                                                                                                                                                                                                                                                                     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1** | `list-worker-payments` **already** returns per-worker line items — **no** new list **contract** required for v1.                              | —              | S2 **§5** updated; DAP = **type** + **export** + **reconciliation** only.                                                                                                                                                                                                  |
| **G2** | Runtime batches include `payments` and `currency`; `PaymentRecord` does not.                                                                  | Medium         | DAP: extend types; no silent `as` cast without documenting.                                                                                                                                                                                                                |
| **G3** | `dateRange` in list response uses `calculated_at` for both start/end.                                                                         | Low (metadata) | CSV **F-3** “range”: derive from `calculation_data.job_calculations` / job metadata where needed, or label **as-of** `calculated_at` until jobs are joined server-side.                                                                                                    |
| **G4** | `worker_payment` has **no** worker display name; names live in **calculation** JSON (`worker_splits.worker_name`) or require job/worker join. | Medium         | DAP: resolve names per S2 **§6.2**; **do not** use **`aggregateByWorker`** — it **adds full job `total_worker_payment`** to **each** worker on a job (bug: 2 workers on $100 job = $200 total, not $50 each). Export must use **`worker_payment.amount`** (already-split). |
| **G5** | Edge function name is **`list-worker-payments`** (plural).                                                                                    | Trivial        | References corrected in **§9**.                                                                                                                                                                                                                                            |

**Gold checklist (disbursement):** **Path verified:** **calculate** → **save** (with `worker_payment` rows) → **list** includes **`payments`** + **`calculation_data`**. Remaining: **export** + **reconciliation** test + type alignment per **S3** **§2–3** (implement **`BatchWorkerPaymentRow`**, not **`WorkerPaymentLineItem`**, for batch rows).

---

## 5. Risk assessment

| Risk                                      | Likelihood | Impact                       | Mitigation (v1)                                                                                  |
| ----------------------------------------- | ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| **Users assume app pays**                 | Medium     | **Trust** / support          | **Prominent** **one-line** **boundary**; **in-app** on **mark paid**                             |
| **Export wrong vs preview**               | Medium     | **Payroll error** / disputes | **Tests**; **batch id** and **date** in **CSV** **header**; **total** **reconciliation** **row** |
| **Old batches** lack **splits** in **DB** | Medium     | **Confusing** **export**     | **Clear** **empty** state; **re-run** **calculate** path **or** **document** **limitation**      |
| **Over-promising** “payroll ready”        | Low        | **Legal** / **reputational** | **Copy** **review**; **no** **STP** / **BAS** **claims**                                         |

---

## 6. Phased delivery

| Phase                  | Scope                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **v1 (MVP / handoff)** | **(1)** **UI** + **in-app** **copy** (boundary + mark-paid helper). **(2)** **Per-worker (and optional per-job) CSV** from a **payment batch** when **data** **allows**. **(3)** **Docs** (operator): how to use **export** with **payroll** / **bank** **outside** the app.                                                   |
| **v1.1**               | **Hardening**: second **file format** (e.g. **one** **Xero**-compatible **import** if **spec** is **small**), **version** line in **export**, **per-worker** **email** in **export** (if **not** PII-**sensitive** in **region**), **reconciliation** **report** (batch **total** vs **sum of workers** + **line** **items**). |
| **v2 (re-triage)**     | **Bank file** (e.g. **AU ABA**), **payroll** **API** **pilot**, **worker** **payout** **dashboard**, **KYC** / **wallet** only after **G1** **#2** **on** **custodial** or **regulatory** **load**.                                                                                                                            |

---

## 7. Acceptance criteria (v1)

1. A **new** or **returning** admin can read **in one place** (Worker Payments) that **Tally** **does** **not** **transfer** **money** to **workers** by **itself** (or **substantial** **equivalent** in **onboarding** **copy** if **moved**).
2. For a **batch** with **per-worker** **splits** in the **loaded** **calculation**, the user can **download** a **CSV** with **at least** **worker** **name**, **worker** **id**, and **total** **amount** **per** **worker** for **that** **batch** (or **stated** **reason** if **unavailable**).
3. The **sum** of **per-worker** **export** **amounts** **reconciles** to the **batch** **total** (within **$0.01** for AUD/USD or the currency's smallest unit, or a **documented** **rule** for **FX** / **multi-currency** if needed).
4. **“Mark as Paid”** **context** **explains** **external** **completion**; **no** **new** **legal** **claim** **implied** in **CTA** **copy**.
5. **S0** open **items** on **Jurisdiction** get **a** **single** **generic** **+** **AU** **line** in **UI** or **ContextualHelp** (no **STP** **promise**).

---

## 8. Open items for S2 / F&F (not blocking v1 triage)

- **Status mapping:** `update-worker-payment-status` maps worker `status: "paid"` to batch `status: "completed"` — CSV spec should clarify which status to export (worker-level vs batch-level).
- **F&F** / **HLP** document: **end-to-end** **operator** **journey** “**From** **job** **complete** **to** **bank**” **using** **Tally** + **X** \*\*(spreadsheet, payroll, bank)”.
- **Persisted** **split** **warnings** in **export** **footer** (if **G4**-style **audit** is **valued**).
- **Per-worker** **breakdown** in **PaymentDetailDialog** **UI** (not only **CSV**).
- **Link** to **S0/S1** **split** **weights** in **user** **docs** when **trainee** **weight** **affects** **export** **lines**.

---

## 9. References

### Internal

- [S0 — Worker payments (disbursement)](./S0-worker-payments-disbursement.md)
- [S3 — DAP (build order)](./S3-worker-payments-disbursement.md)
- [S1 — Worker payment split weights](./S1-worker-payment-split-weights.md) (per-worker **math**)
- `dashboard/lib/services/worker-payment.service.ts`
- `dashboard/app/dashboard/worker-payments/page.tsx`
- Edge: `save-worker-payment`, `calculate-worker-payment`, **`list-worker-payments`**, `update-worker-payment-status`

### External (context only)

- [Fair Work Ombudsman — Piece rates and commission](https://www.fairwork.gov.au/pay-and-wages/minimum-wages/piece-rates-and-commission-payments) (AU)

---

**Next step (build):** [S3 — DAP](./S3-worker-payments-disbursement.md) (execution order, contracts, verification). S2 F&F: [S2-worker-payments-disbursement.md](./S2-worker-payments-disbursement.md).

_S1 triage: **GO** for **v1 = clarity + per-worker handoff (CSV)**; **DEFER** **money movement** (true **disbursement**) **and payroll integrations** to **v2+** with **re-triage**._
