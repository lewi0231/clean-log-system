# S2 — Features & Functions: Selective job settlement, remittances, email, and admin access

| Field                           | Value                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Stage**                       | S2 — F&F (scope lock for S3 DAP)                                                                                                                                               |
| **From S1**                     | [`S1-worker-payments-selective-settlement.md`](./S1-worker-payments-selective-settlement.md) (2026-04-28)                                                                      |
| **From S0**                     | [`S0-worker-payments-selective-settlement.md`](./S0-worker-payments-selective-settlement.md)                                                                                   |
| **Created**                     | 2026-04-28                                                                                                                                                                     |
| **Product**                     | Tally Runner — **Worker Payments** (settle by line, remittance, email)                                                                                                         |
| **Gold review**                 | **Completed** 2026-04-28 — see **§13**                                                                                                                                         |
| **Adversarial review**          | **Completed** 2026-04-28 — see **§12**                                                                                                                                         |
| **Related (out of scope here)** | [External accounting (Xero, etc.)](./S0-external-accounting-integration.md) — **separate** S0; [period accrual S2](./S2-worker-payments-period-accrual.md) — independent track |
| **Non-custodial**               | Unchanged: Tally **records** settlement; it **does** **not** **move** **money** ([handoff S2](./S2-worker-payments-disbursement.md) M-1–M-4)                                   |

---

## 1. S1 recap (locked)

| Gate | Outcome                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------ |
| G1   | Job-level mark paid (checkboxes + `payment_id` API) — **GO**                                     |
| G2   | Arrears: per-worker Settle, same job dialog — **GO**                                             |
| G3   | Partial state **derived** from line rows; no new `worker_payment_batch` enum in Phase A — **GO** |
| G4   | Remittance PDF — **GO Phase B**                                                                  |
| G5   | Email to worker — **GO Phase C**                                                                 |
| G6   | Reversals / un-mark paid — **NO-GO v1**                                                          |

**Article 1 (PRESERVE):** Arrears section header **retains** “Mark as paid” for the **entire** batch.

---

## 2. S1 open questions — **resolved in this S2**

| ID                                    | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O-1 Notes**                         | **Same** `notes` string **written** to **each** `worker_payment` row **updated** in **this** **submit** (the lines the user selected). Rationale: reconciliation and search in DB match what the user typed once; no “hidden” note only on the last line.                                                                                                                                                                                               |
| **O-2 Remittance scope**              | **In-flow remittance (Phase B):** lines **just** marked `paid` in that submit, plus shared payment metadata. **History / regenerate (admin):** **all** `worker_payment` rows for **(worker, batch)** where `status = paid` (single normative story for “download again” — no separate per-submit snapshot in v1). A future product variant could add event-level PDFs if we store generation IDs.                                                       |
| **O-3 PDF stack**                     | **Default for v1:** **client-side** **PDF** (e.g. `@react-pdf/renderer` or equivalent) from structured props, triggered after successful status updates, with **in-browser** **download**. **Avoid** headless Chrome in Supabase **Edge** for v1 (runtime / cold-start / bundle). **DAP** may **swap** to **print**-**to**-**PDF** (browser print) as fallback if package weight is a problem. **Spike** in first build task.                           |
| **O-4 Email when org not configured** | **If** org **cannot** send email (Resend not configured, domain not verified, etc.): **block** the **“Send to worker”** **action** with a **short** **explanation** and **link** to the **same** **org** **email** / **sending** **settings** used for **invoices** (if present). **Do** **not** use a system-wide default “from” for worker remittances in v1 (privacy and deliverability). **User** can still **Download** **PDF** and send manually. |

---

## 3. Product boundaries

| In scope (this S2 / phased)                                                                                                                                                                                   | Out of scope                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase A:** Job selection dialog; `WorkerPaymentService.updatePaymentStatus` with **`paymentId`** for each selected unpaid line; current period + arrears; multi-run chooser; batch-level mark **preserved** | **Reversing** `paid` **status**; **Xero** **/** **MYOB** **auto**-**update** (see [S0 external accounting](./S0-external-accounting-integration.md)) |
| **Phase B:** Remittance PDF (this submit only) + **admin** access to **re-generate** **/** **download** for past paid lines (see **§6–7**)                                                                    | Storing every PDF in **Storage** in v1 (optional later)                                                                                              |
| **Phase C:** Send remittance email with **best-practice** **failure** **handling** (see **§5**)                                                                                                               | SMS; worker self-service portal; custom branded templates                                                                                            |
| **Logging:** Server-side log line for “remittance email attempted / failed / delivered” (minimum in Phase C)                                                                                                  | Full **outbox** **table** with retry worker (optional v1.1)                                                                                          |

---

## 4. Data rules and API

### 4.1 Line update sequence (Phase A)

1. **Filter** to **unpaid** `worker_payment` lines for **(organization_id, batch_id, worker_id)** from the batch payload (already in `PaymentRecord.payments` when loaded) or from refetch.
2. User checks **one or more** **line ids** (only **unpaid** selectable).
3. On submit, for **each** selected `payment_id`: call `update-worker-payment-status` with `status: "paid"`, same `payment_method`, `payment_date`, `payment_reference`, and **`notes`** (same string per O-1).
4. **Order:** **sequential** **calls** in v1 to simplify error handling; **if** one fails, **stop** and show error; **DAP** documents whether prior lines in the submit are reverted (they **should** **not** be — **treat** **as** **partial** **success** and **refresh**; operator may need to mark remaining lines; **S3** can add `Promise.all` or **batch** **edge** if needed).
5. **Edge case:** if **N−1** succeed and **1** **fails**, show “Some payments could not be updated” with detail, then **refetch**; prior successful line updates **remain** `paid` (no automatic rollback — operator completes the rest in a follow-up or support intervenes — document in S3 DAP).

**Batch status:** Unchanged: edge function sets `worker_payment_batch` to `completed` only when **all** lines in the batch are `paid` ([`update-worker-payment-status`](../../database/supabase/functions/update-worker-payment-status/index.ts)).

**Line status enum (verified `schema.sql` `worker_payment_status_check`):** `calculated` \| `pending` \| `processing` \| `paid` \| `failed` \| `cancelled`.

- **Dialog — selectable lines (v1):** any line with `status !== 'paid'`, with `cancelled` excluded from selection. Whether to allow marking lines in `failed` is a DAP choice; default: allow `calculated`, `pending`, `processing`, and `failed` (retry path), exclude `paid` and `cancelled`.

### 4.2 Derived “partial” UI (Phase A)

For a pay run in **Worker Summary** and **History** (batch row):

- `totalLines` = number of `worker_payment` lines in the batch (from `payments` array on the `PaymentRecord`).
- `paidLines` = `payments.filter(p => p.status === "paid").length`
- If `0 < paidLines < totalLines`, show a **derived** badge or subtitle, e.g. “Partial” (exact string in DAP i18n table). **Do not** introduce a new DB value on `worker_payment_batch` for v1.

### 4.3 Worker email (Phase C)

**Resolve** for remittance + send:

1. For each `job_id` on the line items, get `Job` from props/cached `jobs` array.
2. Find `Job.workers.find(w => w.id === workerId)?.email` in job list order (first non-empty wins), or first job in the batch that contains that worker — **document** the chosen order in code + unit test.
3. **Missing `Job` for a `job_id`:** If `jobs` does not include that job (stale list, deleted job, pagination), **treat** **email** as **unknown** and show “Email unavailable for this remittance” — **do** **not** guess. **DAP:** refetch jobs when opening dialog, or use job labels from `calculation_details` only for **display**, not for PII email guess.

### 4.4 Concurrency, idempotency, and interaction with “whole batch” mark

| Hazard                                                   | What can go wrong                                                                                                                                                                                                                                                                               | Mitigation (v1 doc / DAP)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Double submit / race**                                 | Two sessions mark the same line; or user double-clicks **Mark as paid**.                                                                                                                                                                                                                        | **UI:** disable primary after first click; `invalidate` + refetch after success. **Server:** the `payment_id` path **updates** the row even if already `paid` — it can **reset** `paid_at` and payment metadata to the **latest** request. **DAP** must **exclude** `paid` lines from selection; **optional** follow-up: edge guard **idempotent 409** or no-op if already `paid` (product decision).                                                                                          |
| **Batch `batch_id` “Mark entire run” (PRESERVE header)** | Edge function applies **one** `updateData` to **all** `worker_payment` rows with that `batch_id` ([`update-worker-payment-status`](../../database/supabase/functions/update-worker-payment-status/index.ts) **batch** branch) — including lines **already** marked `paid` with line-level flow. | **Overwrites** per-line `paid_at`, `payment_method`, `payment_reference`, `notes` to the **form** values. If operators mixed different references per line, the header action **homogenises** them. **Mitigation:** helper copy on **batch** `MarkPaymentPaidDialog`: e.g. _“Applies the same payment details to every line in this run.”_ **Prefer** line-level only when workers were paid on different days/refs. **Future (not v1):** edge change to update only `status != 'paid'` lines. |
| **Line-level then batch**                                | User marks 2/4 lines, then uses batch mark for “the rest” but form **overwrites** the 2 already marked.                                                                                                                                                                                         | Same as above — **document**; training / copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Paginated `list-worker-payments`**                     | Default `limit=50` — very old runs might not be in the first page for **some** UIs.                                                                                                                                                                                                             | History already paginates; **DAP** uses same hook **refetch** + **infinite** scroll or “Load more” if the batch is not in memory. Unlikely to affect **open** run from current session.                                                                                                                                                                                                                                                                                                        |

---

## 5. Remittance email — failure handling (best practice)

**Principle:** Recording payment in Tally and emailing the remittance are **separate** operations. If email fails, **do not** roll back `worker_payment` line status to unpaid.

| Scenario                                                       | Product behaviour                                                                                                                                                                                                           |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mark paid succeeded; email failed (network, 4xx/5xx, provider) | Non-blocking error toast, e.g. _“Payment recorded. We couldn’t send the remittance email. You can resend, download the PDF, or get it from History later.”_ Offer **Download PDF** and **Retry send** (if O-4 allows send). |
| User closes the dialog before retry                            | They can use **History → Download remittance** (§6) or retry from a future **run detail** action.                                                                                                                           |
| Retry send                                                     | v1: allowed (may duplicate email). v1.1: optional `remittance_email_sent_at` or send log to show “Emailed on …” and optional confirm on second send.                                                                        |
| O-4 blocks send (org not configured)                           | Disable send; link to org email / domain settings; PDF download still available.                                                                                                                                            |
| Line updates partially failed (§4.1)                           | v1: **all-or-nothing** for the remittance step (only after **all** selected `payment_id` updates return success). S3 DAP can document a single error flow if a stricter **transactional** pattern is required later.        |

**Implementation note:** The email edge function (Phase C) should return `{ ok: true }` or `{ ok: false, code, message }` so the client can show actionable copy and the server can log (VERIFY with test or mock).

### 5.1 Operator trust

- Show **Payment saved** (or equivalent) as the primary success before email outcome.
- Never imply the worker was notified if delivery did not succeed.
- Optional help line: _“If the worker did not receive the email, ask them to check spam.”_

---

## 6. Admin access to “past” remittances (v1: regenerate, not a gallery)

Tally v1 does **not** require a second immutable PDF store. A remittance is a **regenerated** document from current DB state: `worker_payment` rows (for paid lines) plus org and batch metadata.

| Admin need                | v1 approach                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Download remittance again | **History** (batch row or payment detail) → **Download remittance** for a **worker** when they have at least one **paid** line. **Content:** all lines with `status = paid` for **(worker_id, batch_id)**, with **per-line** `amount`, `paid_at`, `payment_method`, and `payment_reference` in the itemized table — those fields **may** differ across lines (multiple line-level marks or a later whole-batch mark that overwrote metadata). **Do not** imply a single bank transfer in the header unless all lines share the same reference; use **“Varies — see rows”** or omit a single global reference. Title/copy: this is a **record of payments as stored in Tally** for this run and worker, **not** a bank statement. |
| What did I email?         | **v1 minimum:** server logs (timestamp, `organization_id`, recipient, result). **v1.1 (optional):** in-app “Remittance sent” on the row or an activity list.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Disputes / proof          | PDF from regenerate + in-app read of `paid_at` and `payment_reference` on each line.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

If we later add Supabase **Storage** for generated files, the regenerate path remains the fallback when a stored file is missing.

**UI entry points (normative for DAP):**

1. `payment-history-list.tsx` (batch row) → expand **or** **Payment** **detail** **dialog** → **…** **menu** or **"Remittance"** for **a** **worker** with **at** **least** **one** **paid** **line** → **Download** **/** **(Phase** **C)** **Resend** **email** **if** **O-4** **ok**
2. `payment-detail-dialog.tsx` — if it lists workers/lines, add **per-worker** **or** **per-batch** remittance when lines are `paid`

---

## 7. Phased delivery and exit criteria (normative)

| Phase | Work                                                                                                                                                                  | Exit criteria                                                                                                          |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **A** | `mark-worker-lines-dialog` (or similar); wire `paymentId` loop; arrears table columns; `MarkPayRunChoiceDialog` then job dialog; partial badge; PRESERVE batch button | Manual QA: **partial** batch then **complete**; **a11y** **checkbox**; **no** **double**-**select** **paid** **lines** |
| **B** | PDF generator; success step **Download**; **History** / **detail** **Download** **remittance** (regenerate)                                                           | PDF **amounts** **match** **DB**; org name + period on PDF                                                             |
| **C** | Email edge (Resend) + O-4 gating; failure UX §5; server log                                                                                                           | Failed email **does** **not** **clear** **paid**; user can **Download**; **configure** help **if** **blocked**         |

---

## 8. User stories (selection)

| ID       | Story                                                                                                                                                                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SS-1** | As an **org admin**, I can **select** which **unpaid** **jobs** in a **run** belong to a **worker** and **mark** **only** those **as** **paid** **in** one **flow**.                                                                     |
| **SS-2** | As an **org admin**, I see **arrears** in a **per-worker** table **with** the **same** **Settle** **pattern** as the **current** **period**, and I can still **mark** **the** **whole** **run** from the **header**.                     |
| **SS-3** | As an **org admin**, after I **settle** **lines**, I can **download** a **remittance** for **this** **event** and **find** it **again** from **History** (regenerate).                                                                   |
| **SS-4** | As an **org admin**, if **remittance** **email** **fails**, I **still** **see** **paid** **status**, I get a **clear** **error** **and** **paths** (download, settings, retry), and I am **not** **misled** that the worker was emailed. |
| **SS-5** | (Phase C) As an **org admin** with **email** **configured**, I can **send** the **remittance** to the **worker** **email** **resolved** from **jobs**, or be **told** when **no** **email** **exists**.                                  |

---

## 9. UI components (file-level map — implement in S3 DAP)

| Area               | Suggested new / changed files                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Job + payment form | `dashboard/components/worker-payments/mark-worker-lines-paid-dialog.tsx` (or extend `mark-payment-paid-dialog` with a mode)                                                |
| Summary / arrears  | `worker-payment-summary.tsx` — open new dialog; arrears `Table` → Settle + View; **PRESERVE** header **Mark** **as** **paid**                                              |
| Run chooser        | `mark-pay-run-choice-dialog.tsx` — unchanged contract; then open job dialog for `(batch, worker)`                                                                          |
| Service / helpers  | `dashboard/lib/worker-payments/resolve-worker-email.ts`, `unpaid-lines-for-worker-batch.ts`                                                                                |
| Remittance         | `dashboard/lib/worker-payments/remittance-pdf.tsx` (or `generate-remittance-pdf.ts`) — **O-3** final choice                                                                |
| History            | `payment-detail-dialog.tsx`, `payment-history-list.tsx` — **Download** **remittance** action                                                                               |
| Email              | `database/supabase/functions/send-worker-remittance-email/index.ts` (or extend existing Resend util) **—** do **not** **commit** **paid** in **this** function (only send) |

---

## 10. Verification (DAP will expand)

- **Unit:** email resolution, line filtering, notes duplication across lines (mocked).
- **Component:** mark dialog — select all, deselect, disabled primary when none.
- **Integration (optional):** mock `updatePaymentStatus` — sequential `paymentId` calls.
- **Phase C:** test email failure path shows toast + no rollback (assert state).
- **Adversarial (see §12.3):** two `paid` lines for one worker with **different** `payment_reference` — History PDF / regenerate shows **per-line** columns; **optional** E2E double-tab mark attempt after success.

---

## 11. Pre-implementation checklist (DAP / build)

Use with **§13** (codebase verification documented in Gold pass):

- [ ] Line selection UI filters using `status` rules in **§4.1** (include/exclude per DAP).
- [ ] `PaymentRecord` used for the job dialog has `payments[]` (see §13) or detail fetch is implemented.
- [ ] Resend / org email: follow **§13** integration note; link or gate “Send to worker” like invoice send.
- [ ] Remittance copy: in-flow = submit-only; History = all paid lines for (worker, batch) per **§2** and **§6** (per-line metadata **§6**; batch-mark overwrite **§4.4**)
- [ ] **§4.4** / **§12:** batch “Mark entire run” **warning** **copy**; no double-submit on line mark

---

## 12. Adversarial review (2026-04-28)

**Intent:** Hostile reviewer, confused operator, race conditions, and **pre-existing** API behaviour that could **surprise** users after selective settlement ships.

### 12.1 Scenarios and mitigations (normative for DAP)

| #   | Attack / stress                                   | Finding                                                                                                                                                                                                                                   | Mitigation                                                                                                                                                      |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **20+ lines** for one worker in one run           | Long dialog; a11y scroll trap.                                                                                                                                                                                                            | Max-height + scroll; optional virtualisation **v1.1**; confirm **Select all** count in header.                                                                  |
| A2  | **Worker email wrong or stale**                   | Remittance sent to old address on job; dispute.                                                                                                                                                                                           | Phase C: **confirm** step showing **full** recipient address before send; link to edit job/worker if applicable.                                                |
| A3  | **Email “sent” but not received**                 | Spam, typo, provider delay.                                                                                                                                                                                                               | Copy: check spam; verify email on file — **not** a guarantee of delivery (§5).                                                                                  |
| A4  | **Multi-tab** two admins                          | Concurrent marks on same line; stale checkbox state.                                                                                                                                                                                      | Last write wins; **refetch** / `invalidate` after any mutation; consider **short** toasts on focus if data version changed.                                     |
| A5  | **Re-marking already-`paid` line**                | Edge `payment_id` path **re-applies** `update` — can **clobber** `paid_at` / ref.                                                                                                                                                         | **UI** is primary guard (no selection of `paid` lines). See **§4.4**.                                                                                           |
| A6  | **Line-level marks then “Mark entire run”**       | **Batch** path updates **every** line in batch with **one** metadata payload — **overwrites** prior per-line **detail**. **Verified** in current [batch branch](../../database/supabase/functions/update-worker-payment-status/index.ts). | Warning copy on batch dialog (§4.4); prefer line-level when references **differ**; future edge change = separate track.                                         |
| A7  | **History / in-flow O-2 mismatch**                | User expects History PDF to match a **single** day’s pay; it is **all paid lines** in run for worker.                                                                                                                                     | Copy on History download (§6); itemise **per line**.                                                                                                            |
| A8  | **PII in PDF + email**                            | Remittance has names, amounts, job refs.                                                                                                                                                                                                  | Same as rest of Tally: org-controlled export; no **extra** **retention** **promise** in v1 beyond DB; DAP: **no** public **ungated** **URL** for PDF.           |
| A9  | **Regulatory “payslip”**                          | Some jurisdictions have specific payslip **rules** (deductions, YTD, …).                                                                                                                                                                  | **M-1** non-custodial: document is **payment advice / remittance of recorded amounts** — **not** legal payslip **compliance** unless product says so **later**. |
| A10 | **Empty `email` on `JobWorkerWithConfirmation`**  | Type is `string` but may be `""`                                                                                                                                                                                                          | **Treat** as missing (Gold §13).                                                                                                                                |
| S0  | **S0 §4.3** row contradicted S1 (batch `partial`) | **Adversarial on docs**                                                                                                                                                                                                                   | **S0** table **amended** to match **S1/S2**.                                                                                                                    |

### 12.2 Residual product risk (accepted for v1)

- **No** idempotent no-op in edge for **duplicate** `paid` → `paid` on same `payment_id` (optional improvement).
- **No** “only update unpaid lines” in **batch** path (optional improvement) — would change **PRESERVE** **batch** **semantics**; needs **explicit** product sign-off.
- **Compliance** and **payslip** **law** — **out of scope**; marketing must not over-claim.

### 12.3 Hooks retained for S3 DAP / QA

- E2E or integration: open two tabs, mark same line — second **should** not corrupt UX if first succeeded (refetch).
- PDF: one worker, **two** `paid` lines with **different** `payment_reference` — table shows **two** **values**.

---

## 13. Gold review results (2026-04-28)

**Scope:** Cross-check of [S0](./S0-worker-payments-selective-settlement.md), [S1](./S1-worker-payments-selective-settlement.md), and this S2 against `schema.sql` and implementation paths.

| Topic                                     | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`worker_payment` line statuses**        | **Verified** `schema.sql` `worker_payment_status_check`: `calculated` \| `pending` \| `processing` \| `paid` \| `failed` \| `cancelled`. S2 **§4.1** / **§4.2** updated to match; “unpaid” in UX = not `paid`, with DAP for `failed` / `cancelled`.                                                                                                                                                                                                                                 |
| **`list-worker-payments` → `payments[]`** | **Verified** [list-worker-payments `index.ts`](../../database/supabase/functions/list-worker-payments/index.ts): each batch includes nested `worker_payment` rows, mapped to **`payments`** on the formatted batch. [WorkerPaymentService.listPayments](dashboard/lib/services/worker-payment.service.ts) exposes `data.batches` as `PaymentRecord[]` with `payments` on each. **No** extra fetch **required** for line-level dialog _if_ the list response is the source of truth. |
| **`dateRange` on list response**          | **Caveat:** the edge function currently sets `dateRange.start` and `dateRange.end` to **`calculated_at`** (placeholder). Remittance and UI that need a **true job window** should derive from `calculation.calculation` (job calcs) and/or `jobIds` + job fetch — DAP to specify. **Does not** block line-level `payment_id` settlement.                                                                                                                                            |
| **Batch `completed` rule**                | **Verified** [`update-worker-payment-status`](../../database/supabase/functions/update-worker-payment-status/index.ts): when using `payment_id` path, batch is set to `completed` when every line in that batch is `paid`.                                                                                                                                                                                                                                                          |
| **S0 contradiction**                      | **Fixed:** S0 §3.1 previously implied a DB `partial` / `in_progress` batch status. **Amended** to match S1 (derived “Partial” in UI).                                                                                                                                                                                                                                                                                                                                               |
| **O-2 (two remittance stories)**          | **Locked** in S2 **§2** and **§6:** in-flow = submit-only; History regenerate = all **paid** lines for (worker, batch).                                                                                                                                                                                                                                                                                                                                                             |
| **Resend / org email (O-4)**              | **Partial** — `OrganizationSettings` / `org-sending-domain-card.tsx` and invoice Resend usage exist; **DAP** must wire worker remittance to the **same** gating and document any **new** edge function. No separate Gold gap if O-4 remains “block + settings link” until implementation.                                                                                                                                                                                           |
| **`JobWorkerWithConfirmation.email`**     | **Verified** [`dashboard/lib/types.ts`](../../dashboard/lib/types.ts): `email: string` on job workers — resolution rules in S2 **§4.3** stand; DAP: treat **empty string** as missing.                                                                                                                                                                                                                                                                                              |
| **External accounting**                   | **S0** [external accounting](./S0-external-accounting-integration.md) remains correctly **out of scope** for this S2. **Updated** that file’s `Updated` field.                                                                                                                                                                                                                                                                                                                      |

**Follow-up (not blocking S3 DAP for Phase A):** consider tightening `list-worker-payments` `dateRange` for accurate pay-period labels in **remittance** PDFs (separate small task or same DAP for Phase B).

---

## 14. References

- [`S1-worker-payments-selective-settlement.md`](./S1-worker-payments-selective-settlement.md)
- [`S0-worker-payments-selective-settlement.md`](./S0-worker-payments-selective-settlement.md)
- [`S0-external-accounting-integration.md`](./S0-external-accounting-integration.md) — Xero, MYOB, auto-update (**not** v1 of this S2)
- `database/supabase/functions/update-worker-payment-status/index.ts`
- `dashboard/lib/services/worker-payment.service.ts`

---

**Next step:** **S3** **Detailed** **Action** **Plan** (step list, PRESERVE blocks, verify commands) — create `S3-worker-payments-selective-settlement.md` when ready to build.
