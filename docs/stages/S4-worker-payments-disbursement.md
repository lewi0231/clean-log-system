# S4 — Detailed Action Plan (execution): Worker payments handoff v1

| Field                       | Value                                                                                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**                   | S4 — Execution DAP (Process Excellence: **S5 = Build** uses this; **S3** remains normative **contracts** + task letters)                                                                                    |
| **From**                    | [`S0`](./S0-worker-payments-disbursement.md) → [`S1`](./S1-worker-payments-disbursement.md) → [`S2`](./S2-worker-payments-disbursement.md) → [`S3 — DAP / contracts`](./S3-worker-payments-disbursement.md) |
| **Created**                 | 2026-04-27                                                                                                                                                                                                  |
| **Updated**                 | 2026-04-27 (Gold **§14** + Adversarial **§15** + recommendations pass)                                                                                                                                      |
| **Gold review (S4)**        | **Completed** 2026-04-27 — see **§14**                                                                                                                                                                      |
| **Adversarial review (S4)** | **Completed** 2026-04-27 — see **§15**                                                                                                                                                                      |
| **Product**                 | Tally Runner (dashboard, Worker Payments)                                                                                                                                                                   |

**Normative source:** If this file and **S3** disagree, **S3** wins (especially **S3** **§2** locked contracts and **§9** adversarial). This file adds **file paths**, **step IDs**, and **verify** commands so an implementer can run **A → G** without guessing.

**Note on section numbers:** **S4** **§0–§13** are the main plan; **§14** / **§15** are reviews. **S3** **§2** = locked **contracts** (not the same as **S4** **§2** Task A). When a step cites “**S3** **§2.2**,” it always means the **S3** file.

**Verify discipline:** Run the **Verify** for a row before starting the next **depends-on** row in the same task.

---

## 0. Prerequisites

| #   | Prerequisite                                                                                                                                                                                                      | Verify                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| P0  | Read **S2** **§2–8**, **§6** (export), **§7** (UI), **§12.1** (adversarial). Skim **S3** **§1–3**; **deep-read** **S3** **§2** (all subsections) and **§9**.                                                      | N/A                                                              |
| P1  | `cd dashboard && npm run typecheck` passes on current `main` (or your base branch)                                                                                                                                | Exit code 0                                                      |
| P2  | Know **`list-worker-payments`** returns `batches` → client **`payments: PaymentRecord[]`**; each record may include nested **`payments`** = `worker_payment` **rows** (naming: **S3** **§2.1** / **§9** **A-4**). | Read `database/supabase/functions/list-worker-payments/index.ts` |

---

## 1. PRESERVE (Article 1)

| ID       | Must remain true after ship                                                                                                                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PR-1** | **Calculate → Save** flow unchanged in intent; `save-worker-payment` still authoritative for stored batches.                                                                                                            |
| **PR-2** | **Mark as Paid** and existing **`update-worker-payment-status`** behavior preserved; copy only _extends_ with **S2** **M-2** / **M-4**.                                                                                 |
| **PR-3** | **`exportPaymentsToCSV`** (job-level) remains available until a **renamed** or clearly second entry point exists (**S3** **Task** **C2**). Do not remove the old export in the same PR without the rename + UI clarity. |
| **PR-4** | Reconciliation: **no** download when `reconcileBatchTotal` **fails**; **no** silent `calculation_data`-only export for v1 when **S** cannot be built from line items (**S2** **§8**, **D13**).                          |

---

## 2. Task A — Types + `listPayments` (dashboard service + hook)

| Step | ID  | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | File(s)                                            | Verify                                                                                              |
| ---- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 2.1  | A1  | Add **`BatchWorkerPaymentRow`** (or equivalent) with fields matching `list-worker-payments` child rows: at minimum `id`, `job_id`, `worker_id`, `amount`, `currency`, `calculation_details` (and any fields the list API already returns). **Do not** name it **`WorkerPaymentLineItem`** (**S3** **§2.1**).                                                                                                                                                                                                                  | `dashboard/lib/services/worker-payment.service.ts` | Grep: no new type named `WorkerPaymentLineItem` for batch rows.                                     |
| 2.2  | A2  | Extend **`PaymentRecord`** with `currency?`, `payments?: BatchWorkerPaymentRow[]` (or alias). Document **`id`** / **`batch_id`** both = batch uuid when that is what the API returns.                                                                                                                                                                                                                                                                                                                                         | same                                               | `npm run typecheck`                                                                                 |
| 2.3  | A3  | **Recommendation:** add a **discriminated union** type or branded type **`LoadedPaymentBatch`** where `payments` is **required** (not optional). This lets the export call site use `payment: LoadedPaymentBatch` instead of runtime `if (!payment.payments)` checks. Example: `type LoadedPaymentBatch = PaymentRecord & { payments: BatchWorkerPaymentRow[]; currency: string }`. Alternatively, a runtime **`assertLoadedBatch(p)`** guard that throws if `payments` is missing. Avoid bare `as LoadedPaymentBatch` casts. | same                                               | `npm run typecheck`; export call site accepts `LoadedPaymentBatch`                                  |
| 2.4  | A4  | **2–3 line comment** at mapper: return key **`payments`** = **batches**; **`record.payments`** = **line items** (**S3** **§2.1**).                                                                                                                                                                                                                                                                                                                                                                                            | `worker-payment.service.ts` (near `listPayments`)  | Code review / PR                                                                                    |
| 2.5  | A5  | **`use-worker-payment-history.ts`**: when merging **optimistic** + server rows, preserve **`payments`** and **`currency`**. If export runs on a row **without** `payments`, **refetch** or **block** (S2 **§8**). **Recommendation:** prefer **refetch** on download click (simpler UX; one extra round-trip acceptable for export) over disabling the button while optimistic.                                                                                                                                               | `dashboard/hooks/use-worker-payment-history.ts`    | Manual: save batch → history shows row → click Download → file downloads (hook refetches if needed) |
| 2.6  | A6  | After **2.1–2.5**, re-run project typecheck to close Task A.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | (same)                                             | `cd dashboard && npm run typecheck` — **0 errors**                                                  |

**Dependency (execution order):** **Task C (§4)** and **Task D (§5)** need **`PaymentRecord`** + **`exportBatchWorkerSummaryToCsv`** from **A** and **B**. **B (§3)** can start after **A2** (structural `amount` + batch shape) if needed for parallel work; do **not** ship **C1** before **A** and **B** are complete. **Task D (UI download)** should follow **A** (hook preserves `payments`) and **B/C** (export implementation).

---

## 3. Task B — Pure module: `reconcile` + `rollup` + `buildWorkerTotalsCsv`

| Step | ID  | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | File(s)                                              | Verify                                                                                                                                                                                                        |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1  | B1  | Create **`export-batch-worker-csv.ts`** (name may match **S3**), **no** React.                                                                                                                                                                                                                                                                                                                                                                                                             | `dashboard/lib/worker-payments/` (new dir if needed) | File exists, imports resolve                                                                                                                                                                                  |
| 3.2  | B2  | **`reconcileBatchTotal(total, payments, currency)`** — implement **S3** **§2.2**: cent-style for 2dp currencies; **minor-unit** path for JPY etc. (not always `* 100`). **Recommendation for return type:** `{ ok: boolean; deltaMinorUnits: number; currencyMinorUnitFactor: number }` — generic name that is accurate for both AUD (factor 100) and JPY (factor 1). Caller can log `deltaMinorUnits / currencyMinorUnitFactor` if needed for support. (**S3** **B5b** / **S2** **D11**). | new module                                           | Unit tests (below) pass                                                                                                                                                                                       |
| 3.3  | B3  | **`rollupByWorkerId`**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | new module                                           | Tests: two jobs same worker                                                                                                                                                                                   |
| 3.4  | B4  | **`buildWorkerTotalsCsv`** — **#** lines per **S2** **§6.2**; final **`# RECONCILIATION:`** line per **S3** / **S2** **§6.3**.                                                                                                                                                                                                                                                                                                                                                             | new module                                           | Snapshot or string assert in test                                                                                                                                                                             |
| 3.5  | B5  | **RFC 4180** escaping; **formula** safety: lead **`=`**, **`+`**, **`-`**, **`@`** in names → quoted field (**S2** **§12.1** **D10**).                                                                                                                                                                                                                                                                                                                                                     | new module                                           | Test: name `=EVIL`                                                                                                                                                                                            |
| 3.6  | B6  | **`dashboard/__tests__/lib/worker-payments/export-batch-worker-csv.test.ts`**: pass/fail reconciliation, 2¢ drift fail, one worker / two jobs, comma / newline in name, `=name`, empty name, **empty** `payments` / **zero** rows → error, **JPY** (or zero-decimal mock).                                                                                                                                                                                                                 | `dashboard/__tests__/lib/worker-payments/...`        | `cd dashboard && npx vitest run __tests__/lib/worker-payments/export-batch-worker-csv.test.ts` (after file exists) **green**; or `npm test -- __tests__/lib/worker-payments/…` if your shell expands the path |

---

## 4. Task C — `WorkerPaymentService` export API

| Step | ID  | Action                                                                                                                                                                                                                                                                                                                                                                                                    | File(s)                                              | Verify                                                                      |
| ---- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| 4.1  | C1  | Add **`exportBatchWorkerSummaryToCsv`**, calling **Task B** + **S3** **§2.4** name resolution. **Do not** use **`aggregateByWorker`** for line amounts (S2 **D4**).                                                                                                                                                                                                                                       | `worker-payment.service.ts`                          | Typecheck + unit or smoke                                                   |
| 4.2  | C2  | **Recommendation: rename** (not alias) **`exportPaymentsToCSV`** → **`exportJobLevelPaymentsToCsv`**. An alias creates two names for the same thing; a rename with a single deprecation comment (e.g. `// Renamed from exportPaymentsToCSV 2026-04`) is cleaner. Update call sites: **`payment-history-list.tsx`**, **`dashboard/__tests__/lib/services/worker-payment.service.test.ts`** (and any mock). | `worker-payment.service.ts` + callers + tests        | Grep: `exportPaymentsToCSV` returns **0** hits (except deprecation comment) |
| 4.3  | C3  | **BOM for Excel (recommendation: include):** prepend `\uFEFF` for Excel/Sheets UTF-8 auto-detect. Low risk; avoids mojibake on Windows. Document in code comment.                                                                                                                                                                                                                                         | new export path                                      | Open in Excel; non-ASCII name displays correctly                            |
| 4.4  | C4  | **Filename pattern (recommendation):** `tally-worker-payments-{batchId}-{YYYY-MM-DD}.csv` — no "STP" / "payroll" (**S2** **D5**).                                                                                                                                                                                                                                                                         |                                                      | Spot-check download                                                         |
| 4.5  | C5  | Add a **unit test** (or extend **B6**) calling `exportBatchWorkerSummaryToCsv` with a realistic `PaymentRecord` fixture including `payments`, `currency`, and `jobs` — verifies name resolution (**S3** **§2.4**) and output matches expected CSV structure.                                                                                                                                              | `worker-payment.service.test.ts` or alongside **B6** | Test green                                                                  |

---

## 5. Task D — UI (page, history, mark paid)

| Step | ID  | Action                                                                                                                                                                                                                                                 | File(s)                                                             | Verify            |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ----------------- |
| 5.1  | D1  | **M-1** / **M-3** on **`page.tsx`** (ContextualHelp or strip) — final strings: **S2** **§4**.                                                                                                                                                          | `dashboard/app/dashboard/worker-payments/page.tsx`                  | Visual / snapshot |
| 5.2  | D2  | **M-2** / **M-4** in **`MarkPaymentPaidDialog`** — **S2** **§4**.                                                                                                                                                                                      | `dashboard/components/worker-payments/mark-payment-paid-dialog.tsx` | Read copy in UI   |
| 5.3  | D3  | **`payment-history-list`**: branch **`handleExport`**: if reconcile **ok** and `payments?.length` → new CSV; else toast per **S2** **§8**; **orphan** batch (zero line items) → disable + message (implements **S3** **Task** **D4** status / gating). | `dashboard/components/worker-payments/payment-history-list.tsx`     | Manual            |
| 5.4  | D3a | **Accessibility:** `aria-label` (and title if icon-only) on download control (**S2** **D8**).                                                                                                                                                          | same                                                                | a11y tree or test |
| 5.5  | D3b | **PII:** no logging full CSV / all names in prod (**S3** **D4b** / **S3** **§9** **A-5**).                                                                                                                                                             | changed files                                                       | Grep / review     |

**Recommendation (S2 §6.5):** **Do not** add a second "Job-level CSV (quick)" action in v1 — reduces cognitive load; the renamed method stays in code. Revisit in v1.1 if operators request it.

---

## 6. Task E — Operator documentation

| Step | ID  | Action                                                                                                                                                      | File(s)               | Verify                                                                     |
| ---- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------- |
| 6.1  | E1  | Create **`docs/operator/worker-payments-handoff.md`** per **S2** **§13** + **confidentiality** line (names/amounts) (**S3** **E1**).                        | new doc in repo       | File exists, links to Fair Work as **context** not guarantee               |
| 6.2  | E2  | **Recommendation:** add a one-line link in **`dashboard/README.md`** under "Related docs" or "Operator guides" (that file exists). Discoverability matters. | `dashboard/README.md` | Link resolves; README points to `docs/operator/worker-payments-handoff.md` |

---

## 7. Task F — Component tests + regression

| Step | ID  | Action                                                                                                                         | File(s)                                                                        | Verify                                                                                       |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 7.1  | F1  | Update **`payment-history-list` tests**: mocks include **`payments`**, **`currency`**; assert download path or **aria-label**. | `dashboard/__tests__/components/worker-payments/payment-history-list.test.tsx` | `cd dashboard && npm test -- payment-history-list` (or `npx vitest run` that file) **green** |
| 7.1b | F1b | If **C2** renames `exportPaymentsToCSV`, update **`worker-payment.service.test.ts`** and any `vi.mock` of the static method.   | `dashboard/__tests__/lib/services/worker-payment.service.test.ts`              | Grep: `exportJobLevelPaymentsToCsv` / old name per intent                                    |
| 7.2  | F2  | Run **`cd dashboard && npm test`**; fix `PaymentRecord` regressions in other worker-payment tests.                             |                                                                                | Full suite **green** (or list unrelated failures)                                            |
| 7.3  | F3  | `npm run lint` on touched files (project gate per CI).                                                                         | touched files                                                                  | `cd dashboard && npm run lint` — **0 errors** on changed files                               |

---

## 8. Task G — Post-ship documentation hygiene

| Step | ID  | Action                                                                                                     | Verify         |
| ---- | --- | ---------------------------------------------------------------------------------------------------------- | -------------- |
| 8.1  | G1  | Set **S2** status / “Next step” to _Implemented_ or add **Status** row when v1 is shipped (**S3** **G1**). | S2 file edited |
| 8.2  | G2  | Confirm **S0** / **S1** / **S2** / **S3** / **S4** links still valid.                                      | Manual         |

---

## 9. Rollback and optional flag

- **S3** **§4** applies: revert **`export-batch-worker-csv`**, **`PaymentRecord`**, and UI wiring **together** if hotfixing.
- **Feature flag — recommendation:** **Do not** add `NEXT_PUBLIC_ENABLE_WORKER_HANDOFF_CSV` for v1 unless product explicitly requests it. Rationale: the feature is additive (new export option); existing job-level export is renamed, not removed; test coverage in **§3** / **§7** / **§10** is sufficient to ship with confidence. A flag adds complexity without proportionate risk reduction. If a critical bug surfaces post-ship, revert the PR or hotfix the module.

---

## 10. Manual QA (copy from S3 **§5**; execute before merge)

1. Fresh batch from **`list-worker-payments`**: open Worker Payments → history → **Download**; **#** lines; reconciliation line matches.
2. Two workers, one job.
3. One worker, two jobs in one batch.
4. Mark as Paid: copy is “external” payment.
5. Simulated **reconcile fail**: button disabled, safe copy.
6. **Non**-AU: **M-3** visible.
7. **Add:** Open CSV in **Excel/Sheets** with a **name** `=1+1` — value must not execute as a formula (quoted cell).
8. **Orphan batch** — a batch with **no** `worker_payment` rows / empty **`payments`**:
   - **How to reproduce (dev only):** call `save-worker-payment` with a set of `job_ids` where **none** have `job_worker` rows (no workers assigned). The loop in `save-worker-payment` skips all jobs, leaving `workerPayments = []`, and the batch is created with zero children.
   - **Expected:** **Download** disabled **or** error toast (**S2** **§8** / **D13**); no CSV built from `calculation_data` alone.

---

## 11. Definition of done (PR checklist)

Copy **S3** **§6** checklist (includes **S3** **§2** contracts and **§9** **A-1**–**A-5**). S4 adds:

- [ ] **Task A** through step **2.6** (A6) and **Task B** (§3) tests **green** (`typecheck` + new unit file)
- [ ] **§10** Manual QA complete (all items, including item **7** — formula / quoted cell)
- [ ] **Task D (§5)** spot-checked (not a substitute for **§10**)
- [ ] **Task E** operator doc **merged**
- [ ] **PRESERVE** (S4 **§1**) — PR description states if any **PR-\*** row is **not** met (and why)

**Process Excellence S6 (Launch pad):** release notes / stakeholder demo are **outside** this DAP; use org’s release process.

---

## 12. Document map (S3 task letter → S4 section)

| S3     | S4     |
| ------ | ------ |
| Task A | **§2** |
| Task B | **§3** |
| Task C | **§4** |
| Task D | **§5** |
| Task E | **§6** |
| Task F | **§7** |
| Task G | **§8** |

**Note:** S4 adds **C5** (unit test for service export) not present in S3 — this is a **best practice** addition, not a contract change.

---

## 13. References (same as S3 **§8** + this file)

- [`S3-worker-payments-disbursement.md`](./S3-worker-payments-disbursement.md) — **contracts** **§2**, **adversarial** **§9**
- [`S2-worker-payments-disbursement.md`](./S2-worker-payments-disbursement.md) — product spec
- `dashboard/lib/services/worker-payment.service.ts`
- `dashboard/hooks/use-worker-payment-history.ts`
- `dashboard/components/worker-payments/payment-history-list.tsx`
- `dashboard/components/worker-payments/mark-payment-paid-dialog.tsx`
- `dashboard/app/dashboard/worker-payments/page.tsx`
- `database/supabase/functions/list-worker-payments/index.ts`
- `database/supabase/functions/save-worker-payment/index.ts`
- `database/supabase/functions/update-worker-payment-status/index.ts` (read-only: **PR-2** / out of scope for CSV logic)

---

## 14. Gold review (S4) — completed 2026-04-27

**Scope:** Factual and cross-link check of **S4** against **S3**/**S2** and repository paths; first execution draft had several issues — below.

| ID       | Finding                                                                                                                                          | Action taken                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **G4-1** | **§11** said “**§5** (Task D) **manual QA**” — **§5** is **UI** steps; **manual QA** lives in **§10**                                            | **Amended** **§11** to point to **§10**; clarified Task D vs full QA.                           |
| **G4-2** | `npm test -- export-batch-worker-csv` is **unreliable** as a filter; vitest may not match by substring                                           | **B6** verify uses **`npx vitest run __tests__/lib/worker-payments/...`** with a note.          |
| **G4-3** | **Task F** only listed `payment-history-list` test; **C2** rename of **`exportPaymentsToCSV`** also affects **`worker-payment.service.test.ts`** | Added **7.1b** **F1b** for service tests and mocks.                                             |
| **G4-4** | **E2** implied **`docs/README.md`** at repo root — **not** present in this repo’s layout at review time                                          | **E2** now lists real examples (`dashboard/README`, `docs/user_stories/README`, root `README`). |
| **G4-5** | **§13** **References** omitted **`update-worker-payment-status`** (named in **PR-2** / **S3**)                                                   | **Added** to **§13** (read-only path).                                                          |
| **G4-6** | **2.6 (A6)** was an **empty** action row in first draft                                                                                          | Filled with explicit “re-run typecheck to close Task A.”                                        |
| **G4-7** | **S4** **§2** (Task A) vs **S3** **§2** (contracts) could confuse new readers                                                                    | **Header** + **Document map** note; **P0** in **§0** is sufficient; reinforced in this table.   |
| **G4-8** | **Task dependency** (A before D; whether **B** can parallelize) was implicit                                                                     | **Dependency** paragraph under Task A.                                                          |

**Gate:** Gold for **S4** is **complete**; **S3**/**S2** remain the product authority.

---

## 15. Adversarial review (S4) — completed 2026-04-27

| ID       | Attack / gap                                                                                                                                                  | Outcome / mitigation in **S4**                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A4-1** | **Step ID collision:** S3 **D4** “status gating” vs a local **D4** “PII” in the first draft                                                                   | S4 table uses **D3a** / **D3b** only; **5.3** maps to **S3** **Task** **D4** in prose.                                                                                                             |
| **A4-2** | **S4** `reconcile` takes **`currency`**, but if caller passes **wrong** code vs batch                                                                         | **B2**+ tests must use same currency as batch; **C1** must pass `payment.currency` from loaded batch — add unit test in **B6**; **C1** verify “smoke with real `PaymentRecord`” recommended in PR. |
| **A4-3** | **Orphan** batch: `payments?.length === 0` is **falsy** — ensure UI does **not** treat as “reconcile with empty sum” in a way that still **enables** download | **5.3** + **D3** require disable + message; add **10.x** in **§10** to smoke-test empty child rows (optional in §10).                                                                              |
| **A4-4** | **Feature flag** only in **S4** / **S3** rollback — not a **S2** req                                                                                          | Treated as **optional**; do not block ship if not implemented.                                                                                                                                     |
| **A4-5** | **E2** “index” is vague — could ship operator doc with **no** link                                                                                            | **6.2** still **optional**; product can accept **E1** without **E2** if no index.                                                                                                                  |
| **A4-6** | **S6** in **§11** / footer vs **S4** (this file) or **S3** (spec)                                                                                             | Disambiguation: **“PE S6”** = Process Excellence _Launch / deploy_ stage, **not** “section 6” of S4.                                                                                               |

**§10 item 8** covers orphan-batch QA (not optional if the org can create such a batch in dev).

---

## 16. Recommendations summary (open questions closed)

| Item              | Question                                    | Recommendation                                                                                                                |
| ----------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **A3**            | `LoadedPaymentBatch` vs `assertLoadedBatch` | **Discriminated union type** (`PaymentRecord & { payments: …; currency: string }`) — compile-time safety at export call site. |
| **A5**            | Refetch vs disable on optimistic row        | **Refetch** on download click — simpler UX; one extra round-trip acceptable for an export action.                             |
| **B2**            | Return type naming for reconcile            | `{ ok, deltaMinorUnits, currencyMinorUnitFactor }` — accurate for both 2dp and 0dp currencies.                                |
| **C2**            | Rename vs alias old export                  | **Rename** with deprecation comment; alias creates two names for the same thing.                                              |
| **C3**            | BOM for Excel                               | **Include BOM** (`\uFEFF`) — low risk, avoids mojibake on Windows Excel for non-ASCII names.                                  |
| **C4**            | Filename pattern                            | `tally-worker-payments-{batchId}-{YYYY-MM-DD}.csv`                                                                            |
| **E2**            | Link from index                             | **Add** link in `dashboard/README.md` under "Operator guides" or similar.                                                     |
| **§5 (optional)** | Second "Job-level CSV" action               | **Do not add** in v1 — reduces cognitive load; revisit if operators request it.                                               |
| **§9**            | Feature flag                                | **Do not add** in v1 — feature is additive; revert PR if critical bug.                                                        |

---

**After S5 build:** hand off to **PE S6** (launch) using test evidence + **S3** **§6** + **S4** **§11**; set **G1** in **S2** when the feature is **in production** per your branching policy.
