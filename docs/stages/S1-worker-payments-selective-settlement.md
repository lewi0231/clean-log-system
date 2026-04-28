# S1 — Triage: Selective job settlement, arrears per-worker, remittance & email

| Field                  | Value                                                                                                                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**              | S1 — Triage (feasibility, risk, scope lock, phased delivery)                                                                                                                                                                                                            |
| **From**               | [S0 — Worker Payments Selective Settlement](./S0-worker-payments-selective-settlement.md) (2026-04-28)                                                                                                                                                                  |
| **Parent track**       | **Worker Payments** (dashboard) — coexists with [period-accrual S2](./S2-worker-payments-period-accrual.md) and [disbursement S2/S3](./S2-worker-payments-disbursement.md). **Does not** change non-custodial rule: Tally _records_ settlement; it does not move money. |
| **Triaged**            | 2026-04-28                                                                                                                                                                                                                                                              |
| **Product**            | Tally Runner — **Worker Payments** (mark paid, worker summary, arrears)                                                                                                                                                                                                 |
| **Gold review**        | **Completed** 2026-04-28 — see [S2 §13](./S2-worker-payments-selective-settlement.md#13-gold-review-results-2026-04-28)                                                                                                                                                 |
| **Adversarial review** | **Completed** 2026-04-28 — see [S2 §12](./S2-worker-payments-selective-settlement.md#12-adversarial-review-2026-04-28)                                                                                                                                                  |
| **F&F target (next)**  | [`S2-worker-payments-selective-settlement.md`](./S2-worker-payments-selective-settlement.md) — **created** 2026-04-28                                                                                                                                                   |

---

## 1. Context: locked facts from S0 + codebase

| Area                         | Fact                                                                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Line item model**          | `worker_payment` rows are **worker × job** (one row per line in a batch).                                                                                                                      |
| **Edge function**            | `update-worker-payment-status` accepts `payment_id` (single line) or `batch_id` (entire run). If all lines in a batch are `paid`, the function sets `worker_payment_batch.status = completed`. |
| **Batch `status` enum (DB)** | `calculated` \| `approved` \| `processing` \| `completed` \| `cancelled` — **no** `partial` in schema today (`schema.sql`, `worker_payment_batch_status_check`).                               |
| **Dashboard service**        | `WorkerPaymentService.updatePaymentStatus` already supports `paymentId` and `batchId`; UI mostly uses the batch path.                                                                          |
| **UI today**                 | `MarkPaymentPaidDialog` is batch-scoped. `mark-pay-run-choice-dialog` resolves multiple pay runs per worker, then still opens a batch-scoped mark dialog. No job-level checkboxes.             |
| **Arrears**                  | Batches in prior periods list batch-level "Mark as paid" plus a worker table **without** per-worker settle actions.                                                                            |

**Implication:** Selective settlement in Phase A is mainly **UI + service usage** (call `payment_id` path). A new `partial` value on the batch is **not** required for v1; partial progress is **derived** from line-level `status` (see §4.1).

---

## 2. Problem / opportunity (triage restatement)

1. Operators often pay some jobs (or some workers) before others in the same saved run. Batch-only "Mark as paid" misrepresents what happened externally or forces workarounds.
2. Arrears should follow the current-period mental model: per-worker actions that open the same job-selection flow.
3. Remittance (PDF + optional email) depends on line-level settlement being accurate; ship settlement before remittance (phased below).

---

## 3. Strategic gates (S1 recommendations)

| Gate                                                     | Outcome          | Notes                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **G1 — Job-level "Mark as paid" (checkboxes + confirm)** | **GO**           | Use existing `payment_id` path. One API call per selected line for v1; optional batch server action in a later increment.                                                                                                                                    |
| **G2 — Arrears: per-worker rows + same dialog**          | **GO**           | Align arrears with current-period Settle pattern: per-worker "Mark as paid" → run chooser if needed → job list for that run.                                                                                                                                 |
| **G3 — Partial semantics without new batch status**      | **GO**           | Do **not** add `partial` to `worker_payment_batch.status` in Phase A. Show operator-facing "partial" / "in progress" as a **derived** badge or subtitle from `worker_payment` row counts. Revisit a stored `partial` only if reporting or consumers need it. |
| **G4 — Remittance PDF**                                  | **GO (Phase B)** | After Phase A is stable. v1 = single Tally template (org name, period, itemized lines, total, method/ref).                                                                                                                                                   |
| **G5 — Email to worker**                                 | **GO (Phase C)** | After PDF path exists. Reuse org-level email / Resend patterns where they exist.                                                                                                                                                                             |
| **G6 — Reversal (un-mark paid)**                         | **NO-GO (v1)**   | Reversals need product and audit rules (e.g. remittance already sent). Defer to a later triage unless legal requires void in v1.                                                                                                                             |

**Dependency:** G1+G2 should ship before or with the first remittance slice. **O-2** is resolved in [S2 §2](./S2-worker-payments-selective-settlement.md#2-s1-open-questions--resolved-in-this-s2) (in-flow vs History regenerate).

---

## 4. Product decisions (locked for S2)

### 4.1 Partial settlement and batch state

| Topic                        | S1 choice                                                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Source of truth**          | `worker_payment` per line: `status`, `paid_at`, `paid_by`, `payment_method`, `payment_reference`, `notes`.                              |
| **When some lines are paid** | Batch may stay `calculated` or `approved` until all lines are paid; only then the edge function sets `completed` (unchanged).           |
| **Operator-facing copy**     | When `0 < paid_lines < total_lines`, show a derived label such as "Partial" or "In progress" (not a new DB value).                      |
| **Re-marking a paid line**   | UI must not allow selecting it for payment again. Either hide paid lines in the job dialog or list them disabled with "Paid on {date}". |

### 4.2 Job list in the mark dialog

| Topic               | S1 choice                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **What is listed**  | One row per `worker_payment` line for this worker in this batch (job id, label, amount).    |
| **Select all**      | Header checkbox selects all **unpaid** lines in the dialog scope; aligns with S0 wireframe. |
| **Empty selection** | Primary action disabled.                                                                    |
| **Long lists**      | S2: scrollable list with `max-height`; no pagination in v1 unless usability forces it.      |

### 4.3 Multiple pay runs (same worker)

| Topic     | S1 choice                                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Order** | Keep the existing `MarkPayRunChoiceDialog` (or equivalent): user picks the unpaid run, then the job list for (worker, batch). |

### 4.4 Payment details (method, date, reference, notes)

| Topic              | S1 choice                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **Scope**          | Same metadata applied to every selected line on this submit (same field set as `MarkPaymentPaidDialog` today).                 |
| **Implementation** | S2: confirm request shape; v1 may loop client-side calls with identical metadata. O-1 resolves how `notes` apply across lines. |

### 4.5 Arrears layout

| Topic          | S1 choice                                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Structure**  | Per arrear batch: keep a run header (date range, "View run", and **retain** batch-level "Mark as paid" for the whole run — see §6). Below: a table mirroring the current period (Worker, Jobs, Unpaid, Avg/job, Settle). |
| **Per-worker** | Each row: same "Mark as paid" / "View" pattern as the current period table.                                                                                                                                              |
| **Styling**    | Reuse existing `Table` and typography for consistency.                                                                                                                                                                   |

### 4.6 Remittance (Phase B+)

| Topic               | S1 choice                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **When**            | After successful line updates, or a dedicated success step in the same flow.                                                                                |
| **Minimum content** | Org name; worker name; pay run date range; itemized table (job/ref, date, amount); total; method and reference; generated timestamp; timezone policy in S2. |
| **Storage**         | Prefer **generate on demand** from DB for v1 (no new bucket). Optional later: store PDF in Storage for resend.                                              |
| **Branding**        | Single Tally template; no custom org logo in v1 unless already available on org.                                                                            |

### 4.7 Email to worker (Phase C)

| Topic                 | S1 choice                                                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Email source (v1)** | First non-empty `email` on `Job.workers[]` for this `workerId`, using a deterministic order (e.g. first job in list order from props). S2: helper + unit test. If none, show "No email on file" and disable or hide "Send to worker". |
| **Org directory**     | If a first-class worker directory email exists, S2 may add a documented fallback list.                                                                                                                                                |
| **Transport**         | Reuse Resend / org email used elsewhere (e.g. invoice); if missing, S2 adds minimal edge function and secrets.                                                                                                                        |
| **Audit**             | S2 defines minimum audit (e.g. server log + who sent).                                                                                                                                                                                |

### 4.8 Testing and quality

| Topic           | S1 choice                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| **Unit**        | Helpers: unpaid lines for (worker, batch); email resolution; batch progress string for badges.        |
| **Integration** | At least one test that exercises `updatePaymentStatus` with `paymentId` (or sequential `paymentId`s). |

---

## 5. Phased delivery (normative)

| Phase                        | Scope                                                                                                                                          | Exit criteria (draft)                                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Selective settlement** | Job selection dialog; `payment_id` updates; current period + arrears per-worker Settle; preserve batch-level mark; multi-run chooser retained. | User can mark only selected unpaid lines; batch becomes `completed` only when all lines are paid; checkbox hit targets meet ≥24px (desktop) guidance. |
| **B — Remittance PDF**       | Download or open PDF (or print-ready HTML) for the lines in this settlement.                                                                   | Document line items match DB; org and period visible.                                                                                                 |
| **C — Email**                | Optional "Send to worker" per §4.7; download path still works if send fails.                                                                   | Success and error toasts; no silent failure.                                                                                                          |

Do not start B until A is smoke-tested on staging (Article 2 VERIFY).

---

## 6. Article 1 (PRESERVE) — batch-level "Mark as paid"

The arrear section header **keeps** the existing **"Mark as paid"** for the **entire batch** (whole-run settlement). S2 will document the exact component changes; new behaviour **adds** per-worker and per-line paths without removing the batch shortcut.

---

## 7. Risks

| Risk                                          | Mitigation                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| N network calls for N selected lines          | Sequential or small parallel cap in v1; consider batch edge RPC only if rate limits or perf require it. |
| Confusion between batch and line              | Short helper copy in the dialog; optional link to run detail.                                           |
| Remittance or email before line API is stable | Enforce phase order A → B → C.                                                                          |

---

## 8. Out of scope (S1 lock)

- Reversing paid status (G6).
- Custom remittance branding (logo upload).
- SMS; worker self-service pay stub portal.
- Changes to accrual or double-pay domain rules in [period-accrual S2](./S2-worker-payments-period-accrual.md) unless S2 cross-links a shared guard for "job in two runs".

---

## 9. Open questions — **resolved in** [`S2-worker-payments-selective-settlement.md`](./S2-worker-payments-selective-settlement.md) **§2**

| ID      | Resolution (summary)                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **O-1** | Same `notes` on each `worker_payment` row updated in one submit.                                                                                                               |
| **O-2** | In-flow remittance = lines **in this submit**; History “Download remittance” = **regenerate** all lines with `status = paid` for **(worker, batch)** — see S2 **§2** / **§6**. |
| **O-3** | Default **client-side** PDF stack; DAP may adjust after spike.                                                                                                                 |
| **O-4** | **Block** send with configuration help; no system default “from” for worker remittances in v1.                                                                                 |

---

## 10. Acceptance (S1 triage)

- [x] G1–G6 decided, including NO-GO for reversals in v1.
- [x] Phases A / B / C and ordering.
- [x] Batch status strategy: derive from lines; no DB enum change in Phase A.
- [x] Worker email resolution: job workers first.
- [x] PRESERVE batch-level mark in arrears.

---

## 11. References

- [S0 — Selective settlement](./S0-worker-payments-selective-settlement.md)
- `dashboard/lib/services/worker-payment.service.ts` — `updatePaymentStatus`
- `database/supabase/functions/update-worker-payment-status/index.ts`
- `database/schema.sql` — `worker_payment_batch` status
- [Eleken: Bulk actions UX](https://www.eleken.co/blog-posts/bulk-actions-ux) (checkbox targets, selection patterns)

---

**Next step:** S2 created — see [`S2-worker-payments-selective-settlement.md`](./S2-worker-payments-selective-settlement.md). Run **Gold** review before S3 DAP.
