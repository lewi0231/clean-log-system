# S0 — Idea Intake: Paying workers (disbursement / payout), beyond calculate-and-record

| Field          | Value                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**      | S0 — Idea capture (not triage; no build commitment)                                                                                         |
| **Captured**   | 2026-04-27                                                                                                                                  |
| **Updated**    | 2026-04-27 (Gold pass on S0–S3 track + S3 DAP contract fixes)                                                                               |
| **Doc review** | Gold 2026-04-27 (**S3** **§7**); **Adversarial** 2026-04-27: S2 **§12.1**, **S3** **§9**                                                    |
| **Product**    | Tally Runner (organization / worker job logging, field-based pricing, worker payment batches)                                               |
| **Source**     | Product direction — _Calculate Worker Payments_ today computes and stores amounts; it does not move money or prove settlement with workers. |

---

## 1. Idea (submitter language)

We need to start thinking about **how workers actually get paid** in relation to the **Worker Payments** area of the dashboard.

Today, the flow is essentially:

1. **Calculate** a worker payment total from **pricing rules**, **jobs**, and **rate card modifiers** (edge function: `calculate-worker-payment`).
2. **Save** the result as a **batch** and surface it in **Payment Overview**, **Payment History**, and **Worker Summary** (e.g. `save-worker-payment`).
3. **Track lifecycle** on that batch: statuses such as _calculated_ → _approved_ → _paid_ (or failure/cancel), and a **“Mark as Paid”** path that records **method**, **date**, and optional **reference** / **notes** via `update-worker-payment-status` — as an **operational record** of “we paid this outside the app,” not as **execution of a payment**.

**The gap:** there is **no product logic** that **disburses** funds: no per-worker **bank or wallet details**, no **file export** to payroll with industry-standard formats, no **API** to a payroll / banking / “wage” provider, and no **reconciliation** that ties a **line-item amount per worker** to a **settled bank transaction** (or to a **payslip**). “Paid” in the UI is **attestation + bookkeeping** inside Tally Runner, not **proof of value transfer** to each worker.

This S0 asks: **What should “paying workers” mean in this product** (v1, v2, and never), and **what is the minimum honest slice** we could ship that reduces double-entry and error without over-promising compliance or replacing payroll systems?

---

## 2. Problem / opportunity (why this matters)

- **Expectation risk:** The words **“Calculate”**, **“Payment”**, and **“Mark as Paid”** suggest to many users that the app **pays** people or is **tightly coupled** to payroll. Without clarity and/or a real disbursement path, we risk **trust** issues and **mis-set expectations** (especially for SMBs who run tight cash flow).
- **Double work:** Even with correct **per-job** and **per-worker** splits, teams often **re-type** numbers into a bank portal, Xero, MYOB, or a spreadsheet. A **defined** handoff (even **export** or **read-only** integration) can reduce **transcription error** and **time**.
- **Audit and disputes:** “We calculated $X” and “we said we marked it paid” are weaker than a story that includes **per-worker** amounts, **method**, **timing**, and ideally **reconciliation** artifacts — if we choose to go there in later stages.
- **Strategic:** Competitors and adjacent tools (field service, payroll, “earned wage access”) position around **payouts** or **deep payroll sync**. Tally Runner does not need to match them on day one, but we should **name the boundary** and **option space** in S1.

---

## 3. Success (what “good” looks like — draft, non-binding)

_(Precise metrics and acceptance tests belong in S1+.)_

- **Clarity:** A user (or the marketing site) can state in one sentence what the product **does** and **does not** do for **actual payment** to workers — with no **hidden** claim of moving money until that feature exists and is **explicitly** labeled.
- **Operator value:** A **credible** next step for at least one **concrete** workflow (e.g. “**export per-worker breakdown for this batch** for payroll import,” or “**initiate** payout via [provider] for workers who have [details] on file”) — _if_ S1 chooses to pursue it; **or** a deliberate **scope lock** to **record-only** with improved **wording** and **CSV** only.
- **Safety:** No feature implies **legal or tax** filing, **STP** (Single Touch Payroll), **superannuation guarantee** payment, or **minimum wage** compliance without **jurisdiction-appropriate** disclaimers and **separation** of “calculation” from “wage law.”
- **Data model (if we go beyond status flags):** Per-worker **payout** or **remittance** lines can be **traced** back to a **batch** and a **split row** in the **calculation snapshot** (audit path).

---

## 4. Research summary (landscape and current product — not a decision yet)

### 4.1 Current product behavior (facts for S1)

| Area                       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**              | `dashboard/app/dashboard/worker-payments/page.tsx` — **Calculate Payments** opens a dialog that **previews** and **saves** calculations; **Payment History** lists batches; **Mark as Paid** records **method** / **date** / **reference** in a form — **no** bank API call from this code path.                                                                                                                                  |
| **`WorkerPaymentService`** | `dashboard/lib/services/worker-payment.service.ts` — `calculatePayments` → edge function; `savePayment` → `save-worker-payment`; `listPayments` → **`list-worker-payments`**; `updatePaymentStatus` → `update-worker-payment-status`; `exportPaymentsToCSV` is **coarse** (job-level rows, not per-worker split — v1 per-worker export is a **new** path; see S2).                                                                |
| **List / history**         | Edge function **`list-worker-payments`** returns each batch with **`calculation_data`** and nested **`worker_payments`**, exposed to the client as **`payments`**. Sufficient to build per-worker roll-up for export without a _new_ list contract — **DAP** should extend **`PaymentRecord`** to match the runtime response and note **`dateRange`** is currently **both** ends set to `calculated_at` (not true job date span). |
| **Calculation**            | `calculate-worker-payment` returns **per-job** `job_calculations` with `worker_splits` (when workers have time data or active rate cards), **line items**, **warnings** — the **source of truth** for how much each worker should get in theory.                                                                                                                                                                                  |
| **“Paid” status**          | Represents **downstream** user confirmation that the org believes payment **completed** via **payroll** / **bank** / **cash** — **not** that Tally Runner initiated a **transfer** to a worker.                                                                                                                                                                                                                                   |

### 4.2 External / industry patterns (illustrative, not an endorsement)

| Pattern                                         | What it often means in market                                          | Tally Runner today                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Record-only**                                 | Spreadsheet + “we paid” in head                                        | Close to current **Mark as Paid** + history                                   |
| **Bank file export**                            | e.g. ABA (AU) batch payments from accounting software                  | **Not** in product for worker batches                                         |
| **Payroll file import**                         | Net pay lines into Xero / MYOB / Gusto as **journal** or **timesheet** | **Not** in product                                                            |
| **HCM / payroll API**                           | Push **earnings** and let payroll **pay**                              | **Not** in product                                                            |
| **Wallet / card payout** (contractor platforms) | KYC, balance, **instant** or **T+N** pay                               | **Out of scope** for many SMB field-service orgs; **huge** compliance surface |
| **Open banking** / **faster pay-by-bank**       | Initiate transfer via licensed entity                                  | **Regulatory** and **partner** dependency                                     |

S1 should **not** pick a pattern until **persona** (sole trader with one employee vs. 50-person crew) and **jurisdiction** (AU vs. US default) are at least **drafted**.

### 4.3 Design dimensions (for S1 triage — not decided in S0)

| Dimension                 | Example questions                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Unit of payout**        | One **batch** → many workers, or do we ever pay **per job**?                                                                  |
| **Data required**         | Bank account, BSB+account (AU), routing+account (US), **ABN/contractor** flag, **tax** withholding?                           |
| **Source of pay**         | Org’s **own** bank (file upload) vs. **Tally** as **payment agent** (usually **no** for v1).                                  |
| **Per-worker remittance** | Is **v1** “batch total is correct, payroll divides” enough, or do we need **per-worker** export lines from **worker_splits**? |
| **Idempotency**           | Can the same batch be “paid” twice? **Webhook**-style **reversal**?                                                           |
| **Product boundary**      | **“We never touch money; we only export”** vs. **“We integrate with X”** — **explicit** public promise.                       |

### 4.4 Open product questions (for S1 — not decided in S0)

| #   | Question                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Is the **next** step **(A)** better **UX + export** of **per-worker** amounts, **(B)** **deeper** status workflow only, or **(C)** a **pilot** integration (which provider)? |
| 2   | Do **workers** need a **self-service** “my pay history” in the app, or is **org-only** enough for the first disbursement story?                                              |
| 3   | Should **invoices to customers** and **payouts to workers** be **ever** linked in one **cash** view (larger than this S0)?                                                   |
| 4   | What is the **compliance** line we put in the **UI** and **docs** for AU, US, and **generic**?                                                                               |

### 4.5 Related internal docs (reconciled in S1)

- `docs/stages/S0-worker-payment-split-weights.md` — **split** math and rate cards; **orthogonal** to **handoff** but **payouts** need **final per-worker** numbers from the same **calculation** output.
- `docs/research/worker-payment-split-strategies.md` — **current** (2026-04); documents split strategies including `worker_payment_allocation` (schema-only until later phase); align **split** output with any **per-worker** export or API.

---

## 5. Out of scope for this S0 (explicit)

- **No** build plan, **no** API spec, **no** vendor **selection** — those start in **S1 (Triage)** and **S2+** _(at **S0** capture; **superseded** for this track by [**S3 — DAP**](./S3-worker-payments-disbursement.md) once triage/FF approved)_.
- **No** commitment to **STP**, **1099 e-file**, or **BAS**; mention only as **future** or **not ever** after S1.

---

## 6. Post–S0 gate (from Process Excellence)

> _If someone reads this idea in 6 months with no other context, will they understand what was meant?_

- **Re-read** after S1: cross-link to the **triage** outcome (**GO** / **NO-GO** / **defer**) and, if **GO**, the **F&F** or **HLP** ID that **owns** “disbursement” vs. “clarity only” vs. “integration X.”

---

## 7. Gold review (S0 / disbursement track) — 2026-04-27

**Scope:** S0 **§4.1** product facts; cross-doc against **S1–S3** and the **`list-worker-payments`** / **`save-worker-payment`** code paths. **(S0 is not a spec for reconciliation math—see S2 §6.3 and S3 §2.2.)**

| ID       | Check                                                                                       | Outcome                                                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G0-1** | **§4.1** `list-worker-payments` → nested `payments` on each batch + `dateRange` placeholder | **Accurate**; **naming:** `WorkerPaymentService.listPayments()` return key **`payments`** is the **list of batches** (confusing vs per-batch line items — see **S3** **§9** **A-4**). |
| **G0-2** | S0 said “no build plan in S0” vs existence of **S3** DAP                                    | **Clarified** in **§5** — S0 rule holds **at idea capture**; **S3** is the build plan for this track.                                                                                 |
| **G0-3** | S3 **§2.2** first draft allowed **$1.00** drift                                             | **Fixed** in S3 **§7**; implementers must use **S3** current **§2.2** only.                                                                                                           |

### 7.1 Adversarial notes (S0 / track) — 2026-04-27

- **Data truth:** The CSV is for **org** **operators**, not a worker payslip; **S2** / **S3** treat **leakage** of names/amounts in exports as **org responsibility** (same as any payroll export).
- **Orphan batch:** `save-worker-payment` can create a **batch** with **zero** `worker_payment` rows if every job in the run has **no** `job_worker` (all jobs skipped) — see **S2** **§12.1** / **S3** **§9**. Export must **degrade** (block or message), not **infer** from `calculation_data` without an explicit v1.1 story.

**Next steps (2026-04-27):** [S1 — Triage](./S1-worker-payments-disbursement.md) (**GO** for v1) · [S2 — F&F](./S2-worker-payments-disbursement.md) (scope lock) · [S3 — DAP / build plan](./S3-worker-payments-disbursement.md) (execute in order for implementation).
