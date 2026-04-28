# S3 — Detailed Action Plan: Selective Job Settlement, Remittances, Email

| Field       | Value                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------- |
| **Stage**   | S3 — DAP (implementation)                                                                    |
| **From S2** | [`S2-worker-payments-selective-settlement.md`](./S2-worker-payments-selective-settlement.md) |
| **Created** | 2026-04-28                                                                                   |
| **Product** | Tally Runner — **Worker Payments** (selective settlement Phases A+B)                         |
| **Status**  | Phase A — **COMPLETE**, Phase B — **COMPLETE**, Phase C — **COMPLETE**                       |

---

## 1. Phase A — Completed Tasks

### 1.1 New Files Created

| File                                                                            | Purpose                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------- | --------- |
| `dashboard/components/worker-payments/mark-worker-lines-paid-dialog.tsx`        | Job-level checkbox dialog for selecting which jobs to mark as paid |
| `dashboard/lib/worker-payments/unpaid-lines-for-worker-batch.ts`                | Filter helper: returns unpaid lines for a worker in a batch        |
| `dashboard/lib/worker-payments/payment-settlement-status.ts`                    | Derived status helper: `none                                       | partial | complete` |
| `dashboard/__tests__/lib/worker-payments/unpaid-lines-for-worker-batch.test.ts` | Unit tests (10 tests)                                              |
| `dashboard/__tests__/lib/worker-payments/payment-settlement-status.test.ts`     | Unit tests (10 tests)                                              |

### 1.2 Modified Files

| File                                                              | Change                                                                                                                                                                     |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard/components/worker-payments/worker-payment-summary.tsx` | Added import for new dialog; added state for line-level marking; updated `openMarkForWorker` to open job selection dialog; added per-worker Settle column to arrears table |

### 1.3 Implementation Details

**Line Selection Dialog (`mark-worker-lines-paid-dialog.tsx`):**

- Receives batch, workerId, workerName, jobs
- Filters lines using `unpaidLinesForWorkerBatch` (excludes `paid`, `cancelled`)
- Checkbox list with job names (from location name)
- "Select all" / "Deselect all" toggle
- Shows running total of selected amounts
- Payment form: method (required), date (required), reference (optional), notes (optional)
- Sequential `paymentId` calls per S2 §4.1
- Partial failure handling: if N−1 succeed and 1 fails, shows warning toast and calls `onSuccess` to refresh

**Worker Summary Flow:**

- User clicks "Mark as paid" on worker row
- If single batch: opens `MarkWorkerLinesPaidDialog` directly
- If multiple batches: opens `MarkPayRunChoiceDialog` first → then `MarkWorkerLinesPaidDialog`
- Header "Mark as paid" button on arrears sections **preserved** (batch-level, uses `MarkPaymentPaidDialog`)

**Arrears Table:**

- Added "Settle" column with per-worker "Mark as paid" button
- Same flow as current period table

### 1.4 Verification

- ESLint: ✓ 0 errors, 0 warnings
- TypeScript: ✓ No errors in new/modified files (pre-existing test file errors unrelated)
- Unit tests: ✓ 20/20 passing

---

## 2. Phase B — Remittance PDF (COMPLETE)

### 2.1 New Files Created

| File                                               | Purpose                                               |
| -------------------------------------------------- | ----------------------------------------------------- |
| `dashboard/lib/worker-payments/remittance-pdf.tsx` | Client-side PDF generator using `@react-pdf/renderer` |

### 2.2 Modified Files

| File                                                                     | Change                                                                                              |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `dashboard/components/worker-payments/mark-worker-lines-paid-dialog.tsx` | Added success step with "Download remittance PDF" button; stores marked line IDs for PDF generation |
| `dashboard/components/worker-payments/payment-detail-dialog.tsx`         | Added "PDF" download button per worker with paid lines in History view                              |
| `dashboard/package.json`                                                 | Added `@react-pdf/renderer ^4.5.1` dependency                                                       |

### 2.3 Implementation Details

**Remittance PDF (`remittance-pdf.tsx`):**

- Uses `@react-pdf/renderer` for client-side generation
- A4 format with professional layout
- Shows: org name, worker name, period, total, payment method, reference
- Per S2 §6: itemizes per-line metadata when references differ across lines
- Disclaimer: "record of payments as stored in Tally, not a bank statement"
- `downloadRemittancePdf()` generates blob and triggers browser download

**Mark Dialog Success Step:**

- After payments marked → shows confirmation with total and period
- "Download remittance PDF" button available
- Uses the lines just marked (in-flow remittance per S2 §2 O-2)

**History / Detail Dialog:**

- Per worker row: "PDF" button visible when worker has paid lines
- Downloads remittance showing all paid lines for (worker, batch) per S2 §6
- Desktop table and mobile cards both have download option

### 2.4 Exit Criteria — Verified

- ✓ PDF amounts match DB (uses line amounts from `BatchWorkerPaymentRow`)
- ✓ Org name + period on PDF
- ✓ Per-line metadata shown when values differ (`allReferencesMatch` check)

---

## 3. Phase C — Email (COMPLETE)

### 3.1 New Files Created

| File                                                                | Purpose                                            |
| ------------------------------------------------------------------- | -------------------------------------------------- |
| `dashboard/lib/worker-payments/resolve-worker-email.ts`             | Resolves worker email from job data per S2 §4.3    |
| `database/supabase/functions/send-worker-remittance-email/index.ts` | Edge function to send remittance emails via Resend |

### 3.2 Modified Files

| File                                                                     | Change                                                                       |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `database/supabase/functions/_utils/org-mail-from.ts`                    | Added `worker_remittance` to `MailKind` type; maps to `payments@` local part |
| `dashboard/lib/services/worker-payment.service.ts`                       | Added `sendRemittanceEmail()` method                                         |
| `dashboard/components/worker-payments/mark-worker-lines-paid-dialog.tsx` | Added "Email to worker" button in success step with email status handling    |

### 3.3 Implementation Details

**Worker Email Resolution (`resolve-worker-email.ts`):**

- Iterates jobs to find first non-empty email for worker
- Returns `{ email, source, jobId }` or null values
- Basic format validation with `isValidEmailFormat()`

**Edge Function (`send-worker-remittance-email`):**

- Receives: org_id, worker_email, worker_name, period_label, currency, lines[], payment metadata, total
- Uses `resolveOrgMailFrom()` with `worker_remittance` kind
- HTML + text email templates with professional styling
- Test mode support with recipient redirection
- Returns `{ ok, emailId }` or `{ ok: false, code, message }`
- Error codes: `EMAIL_NOT_CONFIGURED`, `EMAIL_SEND_FAILED`

**Mark Dialog Success Step:**

- Shows "Email to worker" button alongside "Download PDF"
- Button disabled if no email found for worker (shows "No email")
- On success: marks `emailSent` state, button shows "Email sent"
- On failure: shows error message in destructive banner
- Per S2 §5: email failure does NOT affect paid status

**O-4 Gating:**

- Server-side: `validateEmailConfig()` check returns `EMAIL_NOT_CONFIGURED` code
- Client-side: displays error message directing user to administrator
- PDF download always available as fallback

### 3.4 Exit Criteria — Verified

- ✓ Failed email does not clear paid status (payment primary, email secondary)
- ✓ User can download PDF as fallback anytime
- ✓ O-4 gating: error message shown when email not configured
- ✓ Edge function type-checks with Deno

---

## 4. PRESERVE Blocks (Article 1)

| Component                           | PRESERVE                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `worker-payment-summary.tsx`        | Header "Mark as paid" button on arrears batch sections — marks entire batch |
| `mark-payment-paid-dialog.tsx`      | Unchanged — used for batch-level marking                                    |
| `mark-pay-run-choice-dialog.tsx`    | Unchanged contract                                                          |
| `update-worker-payment-status` edge | Both `payment_id` and `batch_id` paths remain                               |

---

## 5. References

- [S2-worker-payments-selective-settlement.md](./S2-worker-payments-selective-settlement.md) — Normative F&F
- [S1-worker-payments-selective-settlement.md](./S1-worker-payments-selective-settlement.md) — Scope lock
- `update-worker-payment-status` edge function — Supports `payment_id` for line-level

---

**Status:** Phase A complete. Phase B complete. Phase C complete. **All phases delivered.**
