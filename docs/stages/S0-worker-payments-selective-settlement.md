# S0 — Idea Intake: Worker Payments Selective Settlement & Remittance

| Field        | Value                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| **Stage**    | S0 — Idea capture (not triage; no build commitment)                                                        |
| **Captured** | 2026-04-28                                                                                                 |
| **Updated**  | 2026-04-28 — Gold + **adversarial** pass: §4.3/§6.2/risks aligned with S1/S2; no DB `partial` batch status |
| **Product**  | Tally Runner Dashboard — Worker Payments tab                                                               |
| **Source**   | Product owner — UX feedback on current "Mark as paid" workflow                                             |

---

## 1. Idea (submitter language)

Redesign the **Worker Payments settlement flow** so that:

1. **Job-level selection within a pay run.** Instead of marking an entire batch as paid with a single click, users can **tick individual jobs** (via checkboxes) and mark only those as paid. This supports real-world scenarios where an operator pays some jobs now and others later.

2. **Prior pay periods get per-worker settlement.** Arrears sections (past pay periods with unpaid runs) should allow settling each **worker individually**, not just the whole batch. This enables partial catch-up payments.

3. **Remittance advice generation.** When settling (all or partial), the system should generate a **remittance advice document** for the worker showing:
   - Which jobs/line items were paid
   - Period covered
   - Amounts and payment reference
   - Organization details

4. **Email delivery option.** After generating remittance, offer to **send it to the worker's registered email** (from job assignment or worker directory). This closes the loop without requiring manual document handling.

---

## 2. Problem / opportunity (why this matters)

### 2.1 Current state pain points

- **All-or-nothing batch marking:** Today, "Mark as paid" updates the entire `worker_payment_batch`. If an operator paid 3 of 5 workers in a run (e.g., bank limits, partial funds), they must either:
  - Mark the whole batch and manually track who wasn't really paid, OR
  - Not mark anything and lose visibility on what was actually disbursed.

- **No partial settlement UI:** The backend _already_ supports `payment_id` (per-worker line item) in `update-worker-payment-status`, but the UI only exposes `batch_id`. The infrastructure exists; the UX doesn't surface it.

- **No remittance for workers:** Workers have no formal record of what they were paid and for which jobs. This creates:
  - Disputes ("I thought I'd get more")
  - Administrative burden (manual emails, spreadsheets, phone calls)
  - Compliance gaps for organizations required to provide pay statements

- **Arrears are batch-only:** Prior period sections show "Mark as paid" for the whole run, but no per-worker action. This is inconsistent with the current-period table that shows per-worker rows.

### 2.2 Opportunity

- **Operational flexibility:** Partial payments are common (cash flow, bank batch limits, disputed work). Supporting them reduces workarounds.
- **Worker trust:** A clear remittance advice (even a simple one) professionalizes the relationship and reduces support queries.
- **Compliance readiness:** Some jurisdictions require written pay advices; having the infrastructure in place positions the product for those markets.
- **Audit trail:** Per-job and per-worker settlement creates granular history for reconciliation and disputes.

---

## 3. Success (what "good" looks like — draft)

### 3.1 Selective job marking

- User opens a pay run (either current period or arrears).
- Each job line has a **checkbox** (or the worker row expands to show jobs).
- Selecting one or more jobs enables a **"Mark selected as paid"** action.
- The action updates only those `worker_payment` records. **Batch** row status in the DB does **not** use a `partial` enum value: the run stays in an **unpaid** batch state (e.g. `calculated` / `approved`) until **all** lines in the run are `paid`, then the batch is `completed` (see S1). The UI may show a **derived** “Partial” label from line counts.

### 3.2 Per-worker settlement (arrears)

- Arrears table shows per-worker rows (currently it does not).
- Each worker row has a **"Mark as paid"** or **"Settle"** action.
- Clicking opens a dialog/sheet showing that worker's jobs in this run with checkboxes defaulted to **all selected**.
- User can deselect jobs if needed, then confirm.

### 3.3 Remittance advice

- After confirming payment (single worker or batch), system generates a **remittance document** containing:
  - Organization name and contact
  - Worker name
  - Period (pay run date range)
  - Itemized jobs: date, job ID/reference, amount
  - Total paid
  - Payment method and reference (if provided)
  - Generation timestamp
- Document available as **PDF download** and/or **in-browser preview**.

### 3.4 Email delivery

- Dialog includes option: **"Send to worker"** with prefilled email from worker record.
- If no email on file, show informational message with option to add one (link to worker management, if exists).
- Sending attaches the PDF or embeds summary in email body.
- Success/failure toast confirms action.

---

## 4. Research summary (UX best practices + current product)

### 4.1 Bulk selection UX (from Tavily research)

| Principle                              | Application to this feature                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Checkboxes for multi-select**        | Use checkboxes (not toggles or radio) for job selection. Universal "pick as many as you need" pattern. |
| **Minimum target size**                | 24×24px desktop, 44×44px touch (Material Design).                                                      |
| **Don't hide selection controls**      | Checkboxes visible by default, not on hover. Reduces discoverability friction.                         |
| **Select All / Deselect All**          | Provide header checkbox for "select all jobs in this run" — common expectation.                        |
| **Action buttons appear on selection** | "Mark selected as paid" button disabled or hidden until ≥1 item selected. Prevents confusion.          |
| **Group related items**                | Jobs grouped under worker (or workers grouped under run). Clear visual hierarchy.                      |
| **Limit cognitive load**               | For large batches (20+ jobs), consider pagination or "top N + show more" to prevent overwhelm.         |

### 4.2 Remittance advice best practices (from Tavily research)

| Element               | Best practice                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Content**           | Itemized list (job/invoice ref, date, amount), total, payer details, payment method/reference, contact for questions. |
| **Format**            | PDF preferred for records; email body for quick reference. Offer both when practical.                                 |
| **Timing**            | Sent with or immediately after payment. Not delayed.                                                                  |
| **Recipient control** | Payer (organization) initiates; worker receives. Clear "from" address and reply-to for questions.                     |
| **Audit**             | Store sent remittances or at least log "remittance sent at X to Y" for compliance.                                    |

### 4.3 Edge cases (from Tavily research + domain knowledge)

| Edge case                                      | Handling recommendation                                                                                                                                                                                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Partial payment of a batch**                 | **No** `partial` **value** on `worker_payment_batch` in DB (see S1/S2). Batch stays `calculated` / `approved` until **all** lines are `paid`, then `completed`. UI may show “X of Y lines paid” or a **Partial** badge **derived** from line rows. |
| **Re-marking already-paid job**                | Prevent or warn. "This job was already marked paid on [date]."                                                                                                                                                                                     |
| **Duplicate payment prevention**               | Confirmation dialog with summary before commit. Log each marking.                                                                                                                                                                                  |
| **Worker with no email**                       | Show "No email on file" with optional link to add. Don't block remittance generation (PDF still available).                                                                                                                                        |
| **Large batches**                              | Lazy-load jobs or paginate. Header checkbox + "Select all X jobs" action.                                                                                                                                                                          |
| **Multiple runs same worker (current period)** | If worker appears in multiple unpaid runs, chooser dialog (already implemented) lets user pick which run. Within that run, they can then select jobs.                                                                                              |
| **Reversal / undo**                            | Out of scope for S0. S1 should consider whether "un-mark as paid" is needed and what it does to remittances already sent.                                                                                                                          |

### 4.4 Current backend capability

| Endpoint                       | Current support                                                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `update-worker-payment-status` | Accepts **`payment_id`** (single `worker_payment` row) OR **`batch_id`** (all rows in batch). Per-job marking is **already supported** by passing `payment_id`. |
| `worker_payment` table         | Each row is one **worker × job** line item with `status`, `paid_at`, `paid_by`, `payment_method`, `payment_reference`.                                          |
| `worker_payment_batch` table   | Batch-level status. Edge function auto-updates to `completed` when all lines in batch are `paid`.                                                               |
| **Implication**                | UI work only for selective marking; backend is ready.                                                                                                           |

### 4.5 Current frontend state

| Component                    | Current behavior                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `worker-payment-summary.tsx` | Per-worker rows in current period table. "Mark as paid" → `MarkPaymentPaidDialog` → calls batch-level API. |
| `MarkPaymentPaidDialog`      | Accepts `batchId`, marks entire batch. Does not accept `paymentId`.                                        |
| `MarkPayRunChoiceDialog`     | Lists runs if worker spans multiple; user picks one, then opens batch-level dialog.                        |
| **Gap**                      | No job-level selection UI. No `paymentId` path in dialog. No remittance generation.                        |

---

## 5. Proposed UI flow (sketch for S1)

### 5.1 Current period — per-worker row action

1. User clicks **"Mark as paid"** on a worker row.
2. If worker has jobs in **one run**: open **Job Selection Dialog**.
3. If worker has jobs in **multiple runs**: open **Run Chooser** (existing), then **Job Selection Dialog** for chosen run.

### 5.2 Job Selection Dialog (new component)

```
┌─────────────────────────────────────────────────────────────────┐
│ Mark as paid — [Worker Name]                                    │
│─────────────────────────────────────────────────────────────────│
│ Pay run: Apr 14 – Apr 20, 2026                                  │
│                                                                 │
│ [✓] Select all (4 jobs)                                         │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ [✓] Job #1234 — Apr 14 — $125.00                          │   │
│ │ [✓] Job #1235 — Apr 15 — $98.50                           │   │
│ │ [✓] Job #1236 — Apr 17 — $142.00                          │   │
│ │ [✓] Job #1237 — Apr 19 — $87.25                           │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│ Selected: 4 jobs · $452.75                                      │
│                                                                 │
│ ─── Payment details (required) ───                              │
│ Payment method: [ Bank transfer ▼ ]                             │
│ Payment date:   [ 2026-04-28     ]                              │
│ Reference:      [ ______________ ] (optional)                   │
│                                                                 │
│ ─── Remittance (optional) ───                                   │
│ [✓] Generate remittance advice                                  │
│ [ ] Send to worker (john@example.com)                           │
│                                                                 │
│                            [ Cancel ]  [ Mark as paid ]         │
└─────────────────────────────────────────────────────────────────┘
```

**Key interactions:**

- Header checkbox toggles all.
- Deselecting all disables "Mark as paid" button.
- "Generate remittance advice" checkbox controls whether PDF is created.
- "Send to worker" checkbox appears only if remittance checked and email exists.
- On confirm: API calls for each selected `payment_id`, then generates remittance if checked.

### 5.3 Arrears — add per-worker rows

- Convert arrears sections from batch-only to **worker-breakdown table** (same as current period).
- Each worker row has **"Mark as paid"** → opens same Job Selection Dialog scoped to that worker + that run.

### 5.4 Remittance document

**Content:**

- Header: Organization name, ABN (if set), contact email/phone.
- Title: "Payment Advice" or "Remittance Advice".
- Worker: Name, email (if available).
- Period: Pay run date range.
- Table: Job ID | Date | Description (optional) | Amount.
- Footer: Total paid, payment method, reference, generated timestamp.

**Delivery:**

- **Download PDF**: Always available after marking.
- **Email**: Attach PDF or embed HTML summary. Subject: "Payment advice from [Org Name] — [Period]".

---

## 6. Stakeholder preferences (captured) vs open items (S1)

### 6.1 Captured in this S0

| Topic                     | Direction                                                                    |
| ------------------------- | ---------------------------------------------------------------------------- |
| **Job-level selection**   | Checkboxes in dialog, not on summary table directly (keeps table scannable). |
| **Remittance generation** | Opt-in checkbox in marking dialog; PDF output.                               |
| **Email delivery**        | Opt-in; uses worker's registered email; skippable if no email.               |
| **Arrears per-worker**    | Match current-period pattern: worker rows with individual actions.           |
| **Backend**               | Use existing `payment_id` path in `update-worker-payment-status`.            |

### 6.2 Explicitly not decided in S0 (superseded where noted)

- **Batch status for partial payment:** **Resolved in** [S1](./S1-worker-payments-selective-settlement.md) / [S2](./S2-worker-payments-selective-settlement.md) — **derived** “Partial” in UI; batch row uses existing enum until all lines `paid`.
- **Remittance storage:** Store generated PDFs in Supabase Storage, or regenerate on demand from payment records?
- **Email service:** Use existing email provider (if any) or add new dependency?
- **Worker email source:** Job-level `worker.email`, organization worker directory, or both with fallback?
- **Undo / reversal:** Can a paid job be un-marked? What happens to sent remittances?
- **Audit log:** Log remittance sends separately, or rely on `worker_payment.updated_at` + notes?

---

## 7. Out of scope (unless pulled in by S1)

- **Bulk remittance for entire batch:** This S0 focuses on per-worker remittance. Batch-level "send all remittances" could be a follow-up.
- **Custom remittance templates:** Organization-branded templates are a nice-to-have; v1 uses standard Tally template.
- **SMS / push delivery:** Email only for v1.
- **Worker portal / self-service:** Workers viewing their own payment history is a separate feature.
- **Payment initiation:** Tally records payments made externally; it does not move money. Remittance is informational.

---

## 8. Risks and mitigations

| Risk                        | Impact                                                          | Mitigation                                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Complexity creep**        | Job selection + remittance + email in one dialog may overwhelm. | Split into phases: Phase A = job selection only; Phase B = remittance + email.                                                                                                                                   |
| **Email deliverability**    | Remittances marked as spam or bounce.                           | Reputable transactional provider; clear “from” identity; **optional** one-line _check spam_ in UI — **not** marketing email; do **not** treat as newsletter (no misleading unsubscribe **requirements** for v1). |
| **Large batches**           | 50+ jobs in one run → slow UI, long dialog scroll.              | Paginate or lazy-load jobs; show summary count.                                                                                                                                                                  |
| **Missing worker email**    | User expects to send but can't.                                 | Clear empty state: "No email on file. [Add email]" or "Download PDF instead."                                                                                                                                    |
| **Partial state confusion** | Batch shows "partial" but user doesn't understand meaning.      | Clear UI: "3 of 5 workers paid" badge; progress indicator.                                                                                                                                                       |

---

## 9. References

- **Current implementation:** `dashboard/components/worker-payments/worker-payment-summary.tsx`, `mark-payment-paid-dialog.tsx`, `mark-pay-run-choice-dialog.tsx`.
- **Backend:** `database/supabase/functions/update-worker-payment-status/index.ts` (supports `payment_id`).
- **UX research:**
  - [Eleken: Bulk actions UX](https://www.eleken.co/blog-posts/bulk-actions-ux) — checkbox sizing, selection patterns.
  - [Bridge Studio: Bulk Payments UX](https://bridgestudio.co/case-study/bulk-payments/) — fintech payment flow.
  - [Ramp: Remittance Advice](https://ramp.com/blog/accounts-payable/remittance-advice) — remittance content and purpose.
  - [Modern Treasury: Edge Cases](https://www.moderntreasury.com/journal/edge-cases-in-complex-payment-operations) — partial payments, duplicate prevention.
- **Related stage docs:** `S2-worker-payments-period-accrual.md`, `S3-worker-payments-disbursement.md`.

---

_Project stage doc — Tally Runner — S0 idea intake only. Triage: [`S1`](./S1-worker-payments-selective-settlement.md). F&F / Gold / Adversarial: [`S2`](./S2-worker-payments-selective-settlement.md). External accounting: [`S0-external-accounting`](./S0-external-accounting-integration.md)._
