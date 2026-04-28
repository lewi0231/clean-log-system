# S2 — Features & Functions: Worker payments disbursement v1 (messaging + per-worker handoff)

| Field                     | Value                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**                 | S2 — Features & Functions (scope lock before S3 DAP / HLP)                                                                                          |
| **From S1**               | [`S1-worker-payments-disbursement.md`](./S1-worker-payments-disbursement.md) (2026-04-27)                                                           |
| **Created**               | 2026-04-27                                                                                                                                          |
| **Updated**               | 2026-04-27 (Gold + Diamond + **§12.1** adversarial)                                                                                                 |
| **Gold review (S2)**      | **Completed** 2026-04-27; **re-verified** with **S3** **2026-04-27** — see **§11**                                                                  |
| **Diamond review (S2)**   | **Completed** 2026-04-27 — see **§12**; **adversarial addendum** **§12.1** (2026-04-27)                                                             |
| **Product**               | Tally Runner                                                                                                                                        |
| **S4 build (v1 handoff)** | **Implemented** 2026-04-27 — per-worker CSV, UI wiring, tests, [`docs/operator/worker-payments-handoff.md`](../operator/worker-payments-handoff.md) |

---

## 1. S1 recap (locked for this delivery)

- **G1 — GO (v1):** **Non-custodial** only: **no** in-app **money movement**, **no** ABA, **no** payroll **APIs**.
- **v1 deliverables:** **(1)** Clear **messaging** (product boundary + “Mark as Paid” is **record**-keeping). **(2)** **Per-worker CSV** (and optional per-job **detail** in the same file or second sheet) for a **payment batch**, sourced from **persisted** calculation / **`worker_payment`** rows. **(3)** Short **operator** note (in-app or `docs/`) for using export with **bank / payroll** **outside** Tally.
- **Out of v1:** Bank **PII** (BSB/account), **STP** / **tax** **lodgement**, **Xero** import format, **worker app** “my pay.”
- **Depends on (orthogonal):** [`S2-worker-payment-split-weights.md`](./S2-worker-payment-split-weights.md) / [`S1-worker-payment-split-weights.md`](./S1-worker-payment-split-weights.md) for **richer** `worker_splits` in **preview**; **export** can ship **regardless** using **`worker_payment`** + **`calculation_data`** (see **§5**).

---

## 2. Product boundaries

| In scope (v1)                                                                                                                                                | Out of scope (v1)                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Copy** and **ContextualHelp** (or inline alert) on **Worker Payments** page: **Tally** **calculates** and **records**; **does not** **transfer** **funds** | **Initiating** bank transfer, **wallet**, **payout** **provider**                                   |
| **“Mark as Paid”** **helper** / **subcopy** (and optional **label** **tweak** in S3)                                                                         | **Renaming** **required** if **subcopy** is **sufficient** per S1                                   |
| **CSV** **download** for a **batch**: **per-worker** **roll-up**; optional **per-job** **lines**                                                             | **ABA**, **BECS**, **NACHA**, **SEPA** file **generation**                                          |
| **Jurisdiction** lines: **AU** **Fair** **Work** **link** (context); **one** **generic** **compliance** line                                                 | **Jurisdiction**-specific **wage** **advice** as **if** the product **were** **payroll**            |
| **Reconciliation** **row** (or **footer** comment) in **CSV**: batch **id**, **totals**                                                                      | **STP** / **super** / **withholding** **labels**                                                    |
| **Payment History** and/or **Detail** **entry** **point** for **Download**                                                                                   | **Per-worker** **breakdown** **inside** **PaymentDetailDialog** **(optional** **v1.1**; see **§7**) |

**Product owner:** The **org** (dashboard **admin** / **ops**), not the **field worker** (no **v1** **self-service** **pay** **history** for workers).

---

## 3. Personas & user stories

| ID      | Persona                 | Story                                                                                                                                                                                                                                                                      |
| ------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-1** | **Org admin**           | As an admin, I need to **see in plain language** that Tally **does not pay** my workers, so I do not **mistake** the product for a **bank** or **payroll** **run**.                                                                                                        |
| **F-2** | **Org admin / finance** | After I **save** a **batch**, I need a **CSV** of **how much** **each** **worker** is owed for **that** **run** (roll-up), so I can **enter** or **reconcile** amounts in my **bank** or **payroll** **system** without **re-typing** from **job** **subtotals** **only**. |
| **F-3** | **Org admin**           | I need the **file** to include **enough** **metadata** (batch, dates, **currency**, **reconciliation** **line**) to **dispute** or **audit** **later**.                                                                                                                    |
| **F-4** | **Org admin (AU)**      | I still see a short context line and link to Fair Work (piece/commission overview), as context—not as a guarantee that I comply.                                                                                                                                           |
| **F-5** | **Org admin**           | When I **mark** **a** **batch** **paid**, the UI **makes** **clear** I am **recording** **an** **external** **payment** **(bank** / **payroll** / **cash)**, not **triggering** **Tally** **to** **send** **money**.                                                       |

**Non-stories (v1):** Worker **self-service** **payslips**; **automatic** **remittance** to **ABN** **contractors**; **GST** / **PAYG** **lines**.

---

## 4. Message inventory (v1) — _exact_ copy in S3 / content PR\*

| #       | Where                                                                                                                                                                                                                                                             | Content intent |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **M-1** | **Worker** **Payments** page — **Contextual** **help** (extend **or** add **sibling**): one **sentence** **boundary** (S1: _Tally_ **calculates** _amounts_ **and** **records** **pay** **runs**; _it_ **does** **not** **transfer** **money** _to_ **workers**). |
| **M-2** | **Calculate** / **mark**-**paid** **journey** — **if** M-1 is not **visible** from **mark**-**paid** **context**, **repeat** a **one**-**line** **variant** in **MarkPaymentPaidDialog** **description** or **Contextual** **help** on **that** **dialog**.       |
| **M-3** | **Jurisdiction** — add to help on Worker Payments: one line for **non–AU** orgs: verify local wage and contractor rules independently.                                                                                                                            |
| **M-4** | **“Mark** **as** **Paid”** — **subheading** or **DialogDescription**: **Record** **that** **you** **completed** **payment** **in** **your** **bank** / **payroll** / **other** **system**; **Tally** **only** **stores** **this** **record** **(see** M-1**).**   |

_Final strings approved in implementation PR / `docs/operator/…` as needed._

---

## 5. Data & persistence (facts for build)

**Source: `save-worker-payment`** — `database/supabase/functions/save-worker-payment/index.ts` (repo root)

| Fact                                         | Implication for export                                                                                                                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`worker_payment_batch.calculation_data`**  | Stores **full** **`calculation`** **JSON** from **client** (includes **`job_calculations`**, each may have **`worker_splits`**) **—** can **rehydrate** **preview**-**equivalent** **structure** for **old** **batches** **without** re-calling **calculate**.                                                      |
| **When** `jobCalc.worker_splits` **present** | **One** **`worker_payment`** **row** **per** **split** (**per** **job** **×** **worker**); **`amount` =** `split.final_payment`; **`calculation_details.worker_split`** **holds** **partial** **breakdown** **(including** `team_percentage_bonus` **in** **save** **path**).                                       |
| **When** `worker_splits` **absent**          | **Fallback** **:** **equal** **split** of **`jobCalc.total_worker_payment`** **across** **workers** on **job**; **`split_among_workers`** in **`calculation_details`**. **Export** must **not** **claim** “time-**based**” **splits** for **these** **rows** **(metadata** **column** or **separate** **section**). |
| **`batch.total_payment`**, **currency**      | **Must** **reconcile** to **sum** of **logical** **per-worker** **payouts** for **the** **batch** **(see** **§6**).                                                                                                                                                                                                 |

**Listing loaded batches (verified, Gold 2026-04-27):** Edge function **`list-worker-payments`** (`database/supabase/functions/list-worker-payments/index.ts`) **already** returns each batch with:

- **`calculation_data`** (full persisted calculation snapshot, or a fallback from `total_payment` if missing).
- **`payments`**: an array built from the **`worker_payment`** child rows (job id, worker id, `amount`, `currency`, `calculation_details`, etc.).

The dashboard hooks **`useWorkerPaymentHistory` → `WorkerPaymentService.listPayments`**. **`PaymentRecord`** in `worker-payment.service.ts` **now** includes **`payments?`**, **`currency?`**, and related **types** (**e.g.** **`BatchWorkerPaymentRow`**, **`LoadedPaymentBatch`**) **as** **shipped** in **the** **handoff** **v1** **build** — **Gold** **(2026-04)** **finding** **G2-2** **closed**; **new** **work** **(e.g.** [S2 **Calculate** **UX**](./S2-worker-payments-calculate-ux.md)**) should** **treat** **list** **payload** as **the** **source** **of** **truth** for **per-worker** **lines** **(no** **stale** **“type** **gap”** **in** **spec**).

**`dateRange` (important for F-3 / CSV header):** The list formatter **currently** sets `dateRange.start` and `dateRange.end` **both** to **`calculated_at`** (see in-function comment and `dateRange` at **lines 157–162** in `list-worker-payments/index.ts`). For **v1** metadata, either: **(1)** treat “period” in the CSV as **as-of** the batch calculation time, and/or **(2)** derive a human “jobs included” line from `calculation_data.job_calculations` / `jobIds` in the list payload **without** claiming it is a calendar pay period. **v1.1 enhancement:** Fetch job `completed_at` or `scheduled_date` to show actual job date range.

**Pagination:** List defaults to **`limit` 50** (max 100) — only affects how many **batches** load in **history**; a **per-batch** export uses **one** batch object (ensure the selected batch is fully loaded, not a stub).

**S2 instruction for S3 DAP:** **(1)** Type alignment for **`list-worker-payments` → client**. **(2)** Build CSV from **`payments` + `calculation` + `totalPayment`**; **(3)** optional later hardening: server-side `GET` by batch id if we ever split **list** from **detail**; **not** a v1 **blocker**.

---

## 6. Export specification (v1) — _normative for DAP_

### 6.1 Files

- **Default:** **one** **UTF-8** **`.csv`**, **BOM** **optional** (Excel: consider **BOM** for **Excel** **double**-**click** **—** DAP).
- **Optional** **(same** **PR** **or** **v1.1):** second **file** or **“** **Export** **details**” **—** `…-by-job.csv` with **per-job** **lines**.

### 6.2 Primary sheet: `worker_totals` (table inside one CSV)

| Column                | Required        | Description                                                                                                                        |
| --------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `batch_id`            | **Yes**         | UUID **(repeat** on **each** **row** **or** **header** **comment** **—** DAP)                                                      |
| `organization_id`     | **Optional** v1 | **If** **easy** from **context**                                                                                                   |
| `currency`            | **Yes**         | e.g. **AUD** from **batch**                                                                                                        |
| `worker_id`           | **Yes**         |                                                                                                                                    |
| `worker_name`         | **Yes**         | **Resolve** from **DB** or **JSON**; **if** **missing**, **id** **only** + **empty** name **flag**                                 |
| `total_for_batch`     | **Yes**         | Sum of `amount` across all `worker_payment` rows for this worker in this batch (see **§6.3**).                                     |
| `job_count_in_batch`  | **Recommended** | Count of jobs in the batch for this worker.                                                                                        |
| `hours_worked`        | **Recommended** | Total hours from `worker_splits` if available; empty if equal-split fallback was used.                                             |
| `split_mode`          | **Recommended** | `time_based` (from `worker_splits`), `weights_only`, or `equal_split_fallback`. Helps payroll identify estimated vs actual splits. |
| `calculated_at`       | **Yes**         | ISO 8601 timestamp of when the batch was calculated (from `worker_payment_batch.calculated_at`).                                   |
| `export_generated_at` | **Yes**         | ISO 8601 timestamp (UTC) for when this CSV file was generated (will differ from `calculated_at` if exported later).                |

**Header** **comment** **rows** **(recommended** **v1**): lines **0–2** with **`#`** **prefix**:

- Line 0: `# Tally Runner Worker Payment Export`
- Line 1: `# Batch: {batch_id} | Calculated: {calculated_at}`
- Line 2: `# DISCLAIMER: Amounts are estimates for informational purposes only. Verify totals with your payroll system. Tally Runner does not transfer funds, file tax returns, or provide legal/financial advice. For AU: see fairwork.gov.au; for other jurisdictions: consult local authorities.`

### 6.3 Reconciliation (must)

- **Let** `T_batch` = **`worker_payment_batch.total_payment`**.
- **Let** `S_workers` = **Σ** ( **per**-**worker** **rolled**-**up** `total_for_batch` ) **=** **Σ** all **`worker_payment.amount`** in **batch**.
- **Rule:** `|T_batch - S_workers| ≤ 0.01` (for AUD/USD; use currency's smallest unit otherwise), or the DAP documents an explicit rounding policy. If the check fails, disable export and show a clear error (do not download a wrong CSV). **Name alignment:** In DB, the batch table column is **`total_payment`**, but the list API maps it to **`totalPayment`**. Reconciliation should use the **numeric** values from the same loaded batch object, not mix raw vs formatted labels.
- **Float note:** Equal-split and percentage paths may introduce **tiny** **float** imbalance vs stored decimals; the **$0.01** tolerance is intentional. **DAP** should use **cent-level integer** math (multiply by 100, compute, divide) or **Decimal** type to avoid floating-point drift. Compare against DB precision used by `save-worker-payment` (PostgreSQL `DECIMAL` / `NUMERIC`).
- **Normative for code:** the implementable pass/fail for export is in **S3** **§2.2** (cent-integer or `|T - S| <= 0.01` in major units — not `<= 1` in dollars).

### 6.4 Optional second section or file: `by_job`

| Column       | Description                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `job_id`     |                                                                                                                                 |
| `worker_id`  |                                                                                                                                 |
| `amount`     | `worker_payment.amount`                                                                                                         |
| `split_mode` | `calculated` (row has `calculation_details.worker_split`) vs `equal_split_fallback` (equal split path in `save-worker-payment`) |

### 6.5 Service layer

- Add to `WorkerPaymentService` (or adjacent module) something like `exportBatchToCsv({ batch, workerPayments, organization }, …)` — exact signature in DAP; add unit tests for the pure string/row builder.
- Either replace entry points for the current job-only `exportPaymentsToCSV` or keep it as a second, clearly named export (“Jobs only (quick)”) so two exports are not confused.

---

## 7. UI features (v1)

| #       | Area                          | Work                                                                                                                      |
| ------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **U-1** | `/dashboard/worker-payments`  | Extend ContextualHelp (F-1, M-3); optional non-blocking info strip.                                                       |
| **U-2** | Payment History               | Per batch row: **Download worker summary (CSV)** when reconciliation passes, or a documented degraded state (see **§8**). |
| **U-3** | `MarkPaymentPaidDialog`       | M-2 / M-4 helper copy on the dialog.                                                                                      |
| **U-4** | Optional (v1.1 or stretch v1) | `PaymentDetailDialog`: read-only per-worker table + same download.                                                        |

**Accessibility:** **Button** has **visible** **label**; **not** **icon**-**only** **(or** `aria-label` **+** **tooltip**). |

---

## 8. Degraded & legacy behavior

| Condition                                                                                                                     | Product behavior                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Batch only has equal-split fallback (no `worker_splits` in JSON)                                                              | Export still works; in `by_job` export use `split_mode=equal_split_fallback`. Optional one-line tool tip: _These amounts used per-job equal split; re-run with the current app for time-based detail if available._                                                                                                                                  |
| Reconciliation fails                                                                                                          | Block export, log, user message with batch id (no raw internals).                                                                                                                                                                                                                                                                                    |
| List path missing line items in **client**                                                                                    | **Unlikely** if the hook uses default **list** response — the **server** includes **`payments`**. If local **optimistic** `addPayment` is shown before refetch, **export** should use the **fetched** batch or **refetch** before download so totals match DB. If types omit `payments`, **fix** types before **shipping** **export** (no guessing). |
| Same worker in multiple jobs in one batch                                                                                     | **Expected:** roll-up **sums** all `worker_payment.amount` for that `worker_id` in the batch.                                                                                                                                                                                                                                                        |
| **Zero** `worker_payment` rows (batch “orphan” — e.g. all jobs had no `job_worker`, so the save loop never inserted children) | **Block** export; toast that the batch has **no** per-worker lines (include **batch id**). **Do not** invent amounts from `calculation_data` in v1 (see **§12.1** / **S3** **§9**). Reconcile only when **S3** can compare **T** to **S** on real rows, or mark product fix (future: reject save with zero line items).                              |

---

## 9. Non-functional requirements

| NFR             | Target                                                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Correctness** | CSV matches DB (or batch object) after reconciliation; unit tests for roll-up and totals.                                                                                                                                                   |
| **PII**         | No new bank account fields in v1. **Exports** include **worker names** and **amounts** — same sensitivity as a payroll report; do **not** log full CSV / full row payloads; operator doc should say “treat the file as confidential (§13).” |
| **Security**    | Export only for org members (same as list); no unauthenticated public export; prefer client-built CSV from already-fetched data or a single `GET` by `batch_id` with RLS.                                                                   |
| **i18n**        | English in v1; optional content file for strings later.                                                                                                                                                                                     |

---

## 10. Testing strategy (S3 / QA)

| Layer           | Cases                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Unit**        | Roll-up map, reconciliation pass/fail (incl. **zero-decimal** sample), CSV escaping (comma, quote, **leading** `=` in name) — see **§12.1** / **S3** **§9**. |
| **Integration** | Fixture batch with and without `worker_splits`; assert CSV. Optional E2E if the stack has save-and-export.                                                   |
| **Manual**      | M-1 visible on first visit; CSV opens in Excel/Sheets; totals match the batch.                                                                               |

---

## 11. Gold review (S2) — completed 2026-04-27

**Scope:** Factual check against `save-worker-payment`, `list-worker-payments`, and `WorkerPaymentService` in repo.

| ID       | Finding                                                                                                                                      | Doc / DAP action                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------- |
| **G2-1** | `list-worker-payments` **embeds** `worker_payment` rows as **`payments`**; prior S2 text could be read as “list might omit per-worker data.” | **§5** rewritten.                                                                          |
| **G2-2** | `PaymentRecord` type omits `payments` + `currency` though the API returns them.                                                              | DAP: extend types.                                                                         |
| **G2-3** | `dateRange` is a **placeholder** (both ends `calculated_at`), not a pay-period span.                                                         | **§5** + F-3 / CSV **§6.2** — label honestly or derive from `calculation_data` / `jobIds`. |
| **G2-4** | Trailing `                                                                                                                                   | ` in **§6.3** broke table **rendering** in some viewers.                                   | **Removed** (this review). |
| **G2-5** | **§8** (pre–Gold) row “List API omits `worker_payment` rows” — **incorrect** for the current **`list-worker-payments`** response.            | **§8** updated.                                                                            |

**Gate:** Gold complete — S3 may proceed with **export + types + copy** without a **new** list API.

### 11.1 Gold re-check (S2 + S3 DAP) — 2026-04-27

| ID       | Check                                                                                              | Result                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **G3-1** | S3 **§2.2** reconciliation must match S2 **§6.3** ($0.01 / one cent).                              | **S3** amended: cent-integer or `<= 0.01` major units (see S3 **§7** Gold + **§2.2**). |
| **G3-2** | S3 type name must not clash with `WorkerPaymentLineItem` (pricing) in `worker-payment.service.ts`. | **S3** **§2.1** uses **`BatchWorkerPaymentRow`**.                                      |
| **G3-3** | `list-worker-payments` line reference for `dateRange`.                                             | **§5** updated to **lines 157–162**.                                                   |

---

## 12. Diamond review (S2) — completed 2026-04-27

**Scope:** Adversarial + product + cross-doc + operational edge cases, building on S1 `G1–G4` and Gold above.

| ID           | Line / theme                                    | Outcome                                                                                                                                                                                                                                                                                                                                  |
| ------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1 (A-1)** | **Legal-adjacent** copy (M-1, M-3)              | **Keep** to **factual** product capability: _what Tally does / does not do_, **not** “you are compliant with Fair Work.” F-4 remains **“context, not a guarantee”**; link stays educational. M-3 uses **independent** **verify** **language**, not a checklist.                                                                          |
| **D2 (A-2)** | **Equal-split** **misread** as **time-based**   | `split_mode` in **§6.4** + **§8** + optional tooltip; CSV header disclaimer **(§6.2)** one line.                                                                                                                                                                                                                                         |
| **D3 (A-3)** | **Client-sourced** `calculation` at save time   | **Export** = **attested** **snapshot** of what was **stored**; add **#** line “Generated from Tally pay run record; amounts reflect saved calculation at save time” — not a re-audit. **Server** **recalc** = **hardening**, **v1.1+** if prioritized. **Cross-doc:** `S2-worker-payment-split-weights` **trust** **notes** still apply. |
| **D4**       | **aggregateByWorker** in `WorkerPaymentService` | **Not** a source for **payout** **line** **amounts**: it **adds** the **full** `job` **`total_worker_payment`** to **each** worker on the job (not **split** math). **Export** must use **`payments`** / **`worker_payment`**, **not** that helper.                                                                                      |
| **D5**       | **Support** and **disputes**                    | CSV includes **batch_id**, `export_generated_at`, reconciliation row — support can ask for that triad. **Do not** claim **payslip** or **STP** in filename or header.                                                                                                                                                                    |
| **D6**       | **i18n** (NFR)                                  | **v1** English; avoid jurisdiction-specific **hard-coded** **currency** **symbols** in **machine** code unless we already have a locale pattern — use **currency** code column.                                                                                                                                                          |
| **D7**       | **Cross-doc** S0 / S1 / S2                      | S1 **G1** “no new list” **agrees** with **G2-1**; S0 **§4.1** now references **`list-worker-payments`**. **Single** place for “we don’t move money” remains **M-1** / M-2 / M-4.                                                                                                                                                         |
| **D8**       | **Accessibility** (§7)                          | **U-2** download control must be **labelled**; if icon-only, **aria-label** + **tooltip** = **DAP** test.                                                                                                                                                                                                                                |
| **D9**       | **Pagination**                                  | If org has **>100** **batches**, history pagination must **load** the **right** page to find a batch; **not** a problem for “export this row” if the **row** is **fully** **hydrated**. **Edge:** future **get-batch-by-id** if we lazy-load.                                                                                            |

**Adversarial prompts (retained for S3 / reviewer):** **A-1** — legal framing; **A-2** — equal-split; **A-3** — client-sourced snapshot — all **acknowledged** in the table.

### 12.1 Adversarial re-review — 2026-04-27

| ID      | Attack / risk                                                                                                                             | Spec outcome                                                                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------- |
| **D10** | **CSV formula injection** — worker or job name starts with `=`, `+`, `-`, `@` (Excel / Sheets)                                            | **Escape** for RFC 4180; **force text** in spreadsheet docs (operator §13) — leading single-quote or tab is a common pattern; DAP **Task B** must cover. |
| **D11** | **Zero-decimal currencies (JPY, KRW, …)** — “one cent” tolerance is **wrong** in major units                                              | **S2** **§6.3** / **S3** **§2.2**: use **smallest currency unit** in code (`minorUnits` / ISO **fraction**); for **JPY** `                               | T−S | ≤ 1`**yen**; do **not** use`\* 100` for JPY. |
| **D12** | **Naming collision** — `listPayments()` returns `{ payments: PaymentRecord[] }` but each record’s **nested** `payments` is **line items** | **DAP** **§2.1** + **S3** **§9**: comment at mapper; optional future rename to `batches` at service return (not v1 if risky).                            |
| **D13** | **Orphan batch** — `save-worker-payment` can leave a **batch** with **no** `worker_payment` if the insert array is **empty**              | **§8** row + **block** export; do not infer line amounts from `calculation_data` in v1.                                                                  |
| **D14** | **Privacy** — exported file is **org payroll**-grade data                                                                                 | **NFR** **PII** row + operator doc: store like any pay report; DAP: no PII in **logs**.                                                                  |

**Gate:** S3 **§9** is the build-side checklist for D10–D14.

---

## 13. Operator documentation (v1) — _short_

- **Path (suggested):** `docs/operator/worker-payments-handoff.md` or a section in user-facing help (if a separate help site exists).
- **Content outline:**
  1. **What Tally does:** Calculates worker payment amounts based on pricing rules and job data; stores calculation records; provides CSV export for manual payroll entry.
  2. **What Tally does NOT do:** Transfer money, file tax returns (STP, 1099, BAS), remit superannuation, generate payslips, or provide legal/financial/tax advice.
  3. **How to use the CSV:** Copy-paste or import into your bank portal, Xero, MYOB, or payroll system; always verify totals match before paying; keep the CSV as an audit artifact.
  4. **AU context (not compliance guarantee):** Link to [Fair Work Ombudsman](https://www.fairwork.gov.au/) for minimum wage, award rates, and contractor rules. Tally calculations are estimates only—actual obligations depend on your Modern Award, enterprise agreement, and individual circumstances.
  5. **Other jurisdictions:** Verify local wage and contractor rules independently; Tally makes no jurisdiction-specific compliance claims.

---

## 14. Deferred (v1.1+)

- **Xero** / **MYOB** **one**-**format** **import** **(if** **spec** **small**)
- **PaymentDetailDialog** per-worker table — **F&F** for **v1.1** in [**S2 — Calculate & period UX**](./S2-worker-payments-calculate-ux.md) **(U-3**); supersedes the **optional** U-4 note above for **ship** order.
- Export `calculation_warnings` as footer lines in the file
- Email column in export (only after PII review)
- Public signed download URL (only if export moves server-side)

---

## 15. References

- [S0 — Worker payments disbursement](./S0-worker-payments-disbursement.md)
- [S1 — Worker payments disbursement (triage)](./S1-worker-payments-disbursement.md)
- [S3 — DAP / locked contracts (build)](./S3-worker-payments-disbursement.md)
- [S4 — Execution DAP (step tables)](./S4-worker-payments-disbursement.md)
- [S1 / S2 — Worker payment split weights](./S1-worker-payment-split-weights.md) (sibling **—** **math** **clarity**)
- `database/supabase/functions/save-worker-payment/index.ts`
- `database/supabase/functions/list-worker-payments/index.ts`
- `dashboard/lib/services/worker-payment.service.ts`
- `dashboard/components/worker-payments/*`

---

**Next step (DAP / build):** [S3 — contracts + task letters](./S3-worker-payments-disbursement.md) (**§2**, tasks **A–G**). **Execution tables:** [S4 — stepwise DAP](./S4-worker-payments-disbursement.md). Mark the handoff v1 spec as _implemented_ when the **S3** **§6** / **S4** **§11** checklist is complete.

_**Scope lock (S2):** v1 = **messaging** + **per-worker** **batch** **CSV** ("handoff") + **reconciliation**; **no** **custodial** **payouts** (true "disbursement" deferred to v2+)._

---

## Appendix: Terminology

| Term             | Meaning in this doc track                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| **Handoff**      | v1 scope: export per-worker amounts for manual entry into external payroll/bank. No money movement by Tally.   |
| **Disbursement** | Future (v2+): actual fund transfer via bank file or API. Requires re-triage with compliance review.            |
| **Batch**        | A `worker_payment_batch` record: one calculation run across N jobs → M workers.                                |
| **Split**        | Per-worker allocation from a job's total, either time-based (`worker_splits`) or equal-split fallback.         |
| **Mark as Paid** | UI action that records attestation that org paid workers externally; does **not** trigger Tally to move funds. |
