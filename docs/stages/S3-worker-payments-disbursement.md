# S3 — Detailed Action Plan (DAP): Worker payments handoff v1 (messaging + per-worker CSV)

| Field                | Value                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| **Stage**            | S3 — Detailed Action Plan (execute in order; checkboxes for tracking)                                 |
| **From S2**          | [`S2-worker-payments-disbursement.md`](./S2-worker-payments-disbursement.md)                          |
| **Created**          | 2026-04-27                                                                                            |
| **Updated**          | 2026-04-27 (Gold + **§9** adversarial: naming, minor units, PII, orphan batch)                        |
| **Gold review (S3)** | **Completed** 2026-04-27 — see **§7**                                                                 |
| **Adversarial (S3)** | **See §9** (pairs with **S2** **§12.1** D10–D14)                                                      |
| **Execution (S4)**   | [S4 — stepwise DAP](./S4-worker-payments-disbursement.md) (file-level tasks; **S3** wins on conflict) |
| **Product**          | Tally Runner (dashboard, Worker Payments)                                                             |

---

## 1. Scope lock (v1)

Deliver everything in S2 **§2 (In scope)**, **§4 (messages M-1–M-4)**, **§6 (export)**, and **§7 (UI U-1–U-3)**. **Do not** implement: ABA / bank file generation, payroll provider APIs, new edge functions for `GET batch by id` (list payload is sufficient), or **PaymentDetailDialog** per-worker table (**U-4** is v1.1 per S2).

**PRESERVE:** Existing **Calculate → Save** flow, **Mark as Paid**, **job-level** `exportPaymentsToCSV` behavior until a clearly named second action exists (or replace only after gating; see **Task C**).

---

## 2. Locked contracts (do not improvise)

### 2.1 Types: loaded payment batch (from `list-worker-payments`)

- **`BatchWorkerPaymentRow`** (or **`WorkerPaymentSubRow`**) must match the formatted **`payments[]`** from `list-worker-payments`: at minimum `id`, `job_id`, `worker_id`, `amount` (number), `currency`, `calculation_details`.
- **Do not** reuse the name **`WorkerPaymentLineItem`** — that identifier already means **pricing** line items inside `job_calculations` in `worker-payment.service.ts` (field_config / quantity / unit price).
- **`PaymentRecord`** in `worker-payment.service.ts` **must** be extended to include:
  - `currency?: string`
  - `payments?: BatchWorkerPaymentRow[]` (or equivalent name)
- **`listPayments`** return type: `Promise<{ payments: PaymentRecord[]; … }>` — ensure **`data.batches` → `PaymentRecord[]`** is accurate without bare `as` casts, or add a small mapper from API shape to `LoadedPaymentBatch`. **(A-4 / §9):** the outer **`payments`** key is a **list of batches**; each **`PaymentRecord.payments`** is **per**-**worker** **line** **items** — add a 2–3 line file comment in `worker-payment.service.ts` so the next author does not sum the wrong array.

### 2.2 Reconciliation (aligned with S2 **§6.3**)

- Let `T` = `totalPayment` (from same object as the export).
- Let `S` = sum of `p.amount` over all `payments` in that batch.
- **Pass** if totals match within **one cent** of the batch currency, e.g. **integer-cents** compare (avoids float drift):
  - `const tc = Math.round(T * 100); const sc = Math.round(S * 100);` then **`Math.abs(tc - sc) <= 1`**
- Equivalently in **major units** for **two**-**decimal** currencies: **`Math.abs(T - S) <= 0.01`** (not `<= 1` — that would allow **$1.00** drift).
- **Zero-decimal currencies (e.g. JPY):** do **not** use `* 100` as “cents.” Use the currency’s **minor unit** (JPY: **1** yen = smallest unit) so tolerance is `|T−S| ≤ 1` **in those units** (see **S2** **§12.1** **D11**; implement via `Intl` / table / `currency-codes` — pick one pattern in **Task B** and test).
- **Fail:** disable download; toast with message including **batch id** (S2 §8). No silent fallback.

### 2.3 CSV: primary file (worker totals)

Normative column set per **S2 §6.2** (required + recommended as listed there). **Header comment lines 0–2** (S2 §6.2) are **in scope** for v1. **UTF-8**; **optional BOM** for Excel (decide in **Task C** and document in PR).

### 2.4 Worker name resolution (priority order)

1. **`calculation_data.job_calculations[].worker_splits[]`** where `worker_id` matches, use `worker_name`.
2. Else **`job.workers`** from dashboard **`jobs[]`** (same pattern as current `exportPaymentsToCSV`).
3. Else empty string; include row anyway with `worker_id` (S2 **worker_name** rule).

**Do not** use `WorkerPaymentService.aggregateByWorker` for export **amounts** (S2 Diamond **D4** / S1 **G4**).

### 2.5 Split mode strings (v1)

Map from `calculation_details`:

| Condition                                        | `split_mode` value                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `calculation_details.worker_split` present       | `time_based` (or `weights_only` if that path is in saved JSON; align with S2 **§6.4** `calculated` semantics) |
| `split_among_workers` present, no `worker_split` | `equal_split_fallback`                                                                                        |

If ambiguous, use `calculated` vs `equal_split_fallback` to match S2 **§6.4** by-job file — document exact strings in the export module comment.

### 2.6 Copy (M-1 – M-4)

Final strings: **S2 §4**; product/legal tone per **S2 §12 (Diamond)**. No “you are compliant with Fair Work” phrasing.

---

## 3. Task sequence (dependency order)

### Task A — Types + `listPayments` contract

| Step | Action                                                                                                                                                                                                                                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1   | In `dashboard/lib/services/worker-payment.service.ts`, add interfaces for a single **`worker_payment` row** as returned by the list API.                                                                                                              |
| A2   | Extend **`PaymentRecord`** with `currency?`, `payments?`, and ensure `batch_id?` and `id` are documented for “which id is the batch” (list returns both `id` and `batch_id` as the batch uuid).                                                       |
| A3   | Add **`assertLoadedBatch(p: PaymentRecord)`** helper or use discriminated type **`LoadedPaymentBatch`** where `payments` is required for export (optional: only for TypeScript at call sites).                                                        |
| A4   | Update **`use-worker-payment-history.ts`** (and **`addPayment`** optimistic path) so merged server rows preserve **`payments`** and **`currency`** when present. If optimistic row lacks `payments`, export path must refetch or block per S2 **§8**. |
| A5   | **Verify:** from `dashboard/`, run **`npm run typecheck`** (maps to `tsc -noEmit` per `dashboard/package.json`).                                                                                                                                      |

**Done when:** No unchecked cast from `data.batches` to `PaymentRecord[]` without comment, or types match API 1:1.

---

### Task B — Pure module: reconciliation + roll-up + CSV

| Step | Action                                                                                                                                                                                                                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1   | Add `dashboard/lib/worker-payments/export-batch-worker-csv.ts` (name may vary; keep **server-agnostic** — no React).                                                                                                                                                                                     |
| B2   | Implement **`reconcileBatchTotal(totalPayment, payments: { amount: number }[])`** using **§2.2** (cent-integer or `<= 0.01` in major units). Return **`{ ok, deltaCents }`** for logging/support.                                                                                                        |
| B3   | Implement **`rollupByWorkerId(payments)`** → `Map<workerId, { total, jobIds: Set, rows… }>`.                                                                                                                                                                                                             |
| B4   | Implement **`buildWorkerTotalsCsv`**: **#** header lines, column header row, data rows, optional reconciliation **#** line at file end (`# RECONCILIATION: T_batch=… S_workers=… OK`).                                                                                                                   |
| B5   | Implement **RFC 4180-style escaping** (quotes, commas, newlines in `worker_name`). **Formula injection (S2** **§12.1** **D10):** if a name begins with `=`, `+`, `-`, `@`, ensure the cell is **quoted** (RFC 4180) so consumer spreadsheets do not interpret as a formula.                              |
| B5b  | Reconciliation **must** use **per-currency** minor units for **JPY** / **KRW** / etc. (not always ×100) — one unit test with a **zero-decimal** example (S2 **D11**).                                                                                                                                    |
| B6   | Unit tests: `dashboard/__tests__/lib/worker-payments/export-batch-worker-csv.test.ts` (or under `__tests__/lib/`) — cases: reconciles, fails 2¢ drift, one worker two jobs, comma in name, name leading `=`, empty name, no `payments` / zero rows → structured error or block, **JPY**-style tolerance. |

**Verify:** `npm test` (or `vitest` / `jest` per repo) for the new test file only first, then full suite.

---

### Task C — `WorkerPaymentService` wiring

| Step | Action                                                                                                                                                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1   | Add **`static exportBatchWorkerSummaryToCsv(payment: PaymentRecord, options: { organizationId: string; jobs: Job[]; now?: Date })`** (signature adjustable) that calls the pure builder from **Task B** and resolves names per **§2.4**. |
| C2   | **Rename** or **alias** existing **`exportPaymentsToCSV`** to a name that signals **job-level** only, e.g. `exportJobLevelPaymentsToCsv`, and keep it for backward compatibility or internal use — **S2 §6.5**.                          |
| C3   | **Optional BOM:** if product chooses BOM for Excel, prepend `\uFEFF` in the new export only; document in test or comment.                                                                                                                |
| C4   | **Filename:** e.g. `tally-worker-payments-{batchId}-{date}.csv` — avoid “payroll” or “STP” in the string (S2 **D5**).                                                                                                                    |

**Done when:** Service exports one clear entry point for the new CSV and the old method is not confused in UI.

---

### Task D — UI: page copy, history download, mark-paid (U-1, U-2, U-3)

| Step | Action                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1   | **`page.tsx`**: Extend **`ContextualHelp`** (or add block) with **M-1** and **M-3** (non-AU + AU Fair Work link as in existing patterns). Reuse `Link` / external link style from the same file.                                                                                                                                                              |
| D2   | **`mark-payment-paid-dialog.tsx`**: **DialogDescription** (or subcopy) for **M-2** / **M-4** — user must see that recording payment is **external** completion.                                                                                                                                                                                               |
| D3   | **`payment-history-list.tsx`**:                                                                                                                                                                                                                                                                                                                               |
|      | - Replace or branch **`handleExport`**: if `reconcileBatchTotal` **ok** and `payments?.length`, call **new** export; else if only calculation exists with **no** line items, show toast explaining degraded state (S2 **§8**).                                                                                                                                |
|      | - **Accessibility:** add **`aria-label="Download worker payment summary (CSV)"`** (or similar) to the download control; if keeping icon-only, **title** + **aria-label** (S2 **D8**).                                                                                                                                                                         |
|      | - Optional: add second menu item **“Download job-level CSV (quick)”** calling renamed job export — only if it reduces confusion; otherwise one button with tooltip.                                                                                                                                                                                           |
| D4   | **Status gating:** Download available when batch has data for export; **reconciliation fail** = disable + tooltip “Cannot export: totals do not match. Contact support with batch id …” (no raw stack). **Orphan batch** (zero `worker_payment` rows): disable + same pattern as S2 **§8**; no silent rebuild from `calculation_data` (S2 **§12.1** **D13**). |
| D4b  | **PII (S2** **D14):** do not `console.log` / structured-log full CSV body or all worker names in production paths.                                                                                                                                                                                                                                            |

**Done when:** Manual spot-check: M-1 visible on page; mark-paid dialog shows M-4; download produces new format for a batch with `payments` in React Query cache.

---

### Task E — Operator documentation

| Step | Action                                                                                                                                                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1   | Create `docs/operator/worker-payments-handoff.md` with outline from **S2 §13** (5 points) **+** one line: **CSV** contains **names** and **amounts** — treat as **confidential** payroll data (**S2** **D14** / **§9** **A-5**). |
| E2   | Add one-line link from `README` or `docs/README` if the repo has an operator index; else **E1** alone is enough.                                                                                                                 |

**Done when:** New doc committed; explains non-custodial boundary and Fair Work as **context**, not compliance guarantee.

---

### Task F — Tests + CI

| Step | Action                                                                                                                                                                                                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1   | Update `dashboard/__tests__/components/worker-payments/payment-history-list.test.tsx` mocks: include `payments` + `currency` on **`PaymentRecord`**; assert new export path or **aria-label** on download. |
| F2   | Run **`npm test`** / **`pnpm test`** in `dashboard` (full or worker-payments scope).                                                                                                                       |
| F3   | Fix any `PaymentRecord` type regressions in **`use-worker-payment-history.test.tsx`**, **`worker-payment-summary`**, **integration** tests.                                                                |

**Done when:** CI green (or document known unrelated failures; do not leave disbursement tests red).

---

### Task G — Documentation cross-links

| Step | Action                                                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1   | When handoff v1 is **shipped**: set **S2** “Next step” to _Implemented_ (or add a one-line “**Status**” row under the S2 title table) so readers do not re-run a finished DAP. |
| G2   | **S0** / **S1** already link S3; confirm links remain after any rename.                                                                                                        |

---

## 4. Rollback plan

- **Code revert:** Revert `export-batch-worker-csv` + `PaymentRecord` changes together; if **`payments`** was added to types only, old UI still works.
- **Feature flag (optional):** `NEXT_PUBLIC_ENABLE_WORKER_HANDOFF_CSV` to fall back to job-level CSV only if critical bug in the field.

---

## 5. Manual QA (release)

1. **Org with a saved batch** from `list-worker-payments` (after refresh): open Worker Payments → Payment History → **Download** — file opens in Excel/Sheets; **#** disclaimers present; `total_for_batch` sums match `totalPayment` in reconciliation line.
2. **Two workers, one job:** CSV shows two rows, amounts sum to batch total.
3. **Same worker, two jobs in one batch:** one row, combined total.
4. **Mark as Paid** dialog: copy states external payment, not Tally sending money.
5. **Reconciliation failure (simulated):** temporarily corrupt mock in dev only — button disabled, toast copy safe.
6. **Non**-AU org: M-3 line visible in help.

---

## 6. Post-implementation PR checklist (copy to PR)

- [ ] `PaymentRecord` / API alignment (**Task A**)
- [ ] New CSV module + unit tests (**Task B**)
- [ ] `WorkerPaymentService` export entry points clear (**Task C**)
- [ ] Page + dialog + history list (**Task D**)
- [ ] `docs/operator/worker-payments-handoff.md` (**Task E**)
- [ ] Tests updated (**Task F**)
- [ ] S2 / S1 / S0 links updated if needed (**Task G**)
- [ ] Manual QA **§5** done
- [ ] **§2** contracts: **§2.2** cent-integer (or `<= 0.01` major) reconciliation; **`BatchWorkerPaymentRow`** naming; no `aggregateByWorker` for amounts
- [ ] **§9** adversarial checklist: **A-1**–**A-5** (formula escape, minor units, orphan batch, list naming comment, PII logging)

---

## 7. Gold review (S3) — completed 2026-04-27

**Scope:** Cross-check **S0–S3** against each other, **`list-worker-payments`**, `dashboard/package.json`, and `WorkerPaymentService` type names.

| ID       | Finding                                                                                                                                                                    | Severity | Action                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| **G3-1** | **§2.2** used `Math.abs(…(T)-…(S)) <= 1` after `roundToCents` returning **major** units — that allowed **$1.00** tolerance, not **$0.01**. **Conflicts** with S2 **§6.3**. | **High** | **§2.2** rewritten: **cent-integer** compare or `<= 0.01` major units. |
| **G3-2** | S3 proposed **`WorkerPaymentLineItem`** for batch rows; codebase already exports **`WorkerPaymentLineItem`** for **pricing** line items.                                   | **High** | **§2.1** renamed to **`BatchWorkerPaymentRow`** + collision note.      |
| **G3-3** | Task A5 referenced generic `pnpm`/`npx` without repo script.                                                                                                               | Low      | **Task A5** → **`npm run typecheck`** in `dashboard/`.                 |
| **G3-4** | Footer referenced **"S6 (Launch / acceptance)"** — ambiguous vs document IDs.                                                                                              | Low      | Replaced with **PR checklist (§6)** + optional PE **S6** note.         |
| **G3-5** | S2 **§5** line range for `dateRange` in `list-worker-payments` was **157–161**; `dateRange` object spans **159–162**.                                                      | Trivial  | **S2** **§5** set to **lines 157–162** (this Gold pass).               |

---

## 8. References (build)

- [`S0-worker-payments-disbursement.md`](./S0-worker-payments-disbursement.md)
- [`S1-worker-payments-disbursement.md`](./S1-worker-payments-disbursement.md)
- [`S2-worker-payments-disbursement.md`](./S2-worker-payments-disbursement.md) — product spec, CSV columns, **§11** Gold, **§12 / §12.1** Diamond + adversarial
- `database/supabase/functions/list-worker-payments/index.ts`
- `database/supabase/functions/save-worker-payment/index.ts`
- `database/supabase/functions/update-worker-payment-status/index.ts`
- `dashboard/lib/services/worker-payment.service.ts`
- `dashboard/hooks/use-worker-payment-history.ts`
- `dashboard/components/worker-payments/payment-history-list.tsx`
- `dashboard/components/worker-payments/mark-payment-paid-dialog.tsx`
- `dashboard/app/dashboard/worker-payments/page.tsx`

---

## 9. Adversarial review (S3 — build checklist) — 2026-04-27

Paired with **S2** **§12.1** (D10–D14). **Do not** ship v1 with these unaddressed if the test matrix hits them.

| ID      | Item                                                         | Build action                                                                                      |
| ------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **A-1** | CSV **formula** cells (**D10**)                              | **Task B5**; unit test with leading `=`.                                                          |
| **A-2** | **Minor** units for non-AUD/USD (**D11**)                    | **§2.2** + **Task B5b**; JPY (or mock) in tests.                                                  |
| **A-3** | **Orphan** batch, **zero** line items (**D13**)              | **Task D4**; optional follow-up: server rejects empty `worker_payments` insert (**v1.1** / debt). |
| **A-4** | **`listPayments().payments` vs** `record.payments` (**D12**) | **§2.1** comment; optional `batches` alias in a later refactor.                                   |
| **A-5** | **PII** / **logging** (**D14**)                              | **Task D4b**; operator doc **Task E** one bullet on file handling.                                |

---

**After handoff v1 ships:** treat **S2 §14 (Deferred)** as the backlog (Xero import, by-job second file, `calculation_warnings` in footer, server-side download URL). Process Excellence **S6 (Launch pad)** / release sign-off is outside this file — use **§6** PR checklist as the **definition of done** for the DAP.
