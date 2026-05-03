# S1 — Triage: Duplicate payment prevention and soft replace

| Field           | Value                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| **Stage**       | S1 — Triage (feasibility, risk, phased scope)                                                           |
| **From S0**     | [`S0-worker-payment-duplicate-prevention.md`](./S0-worker-payment-duplicate-prevention.md) (2026-04-30) |
| **Triaged**     | 2026-04-30                                                                                              |
| **Gold review** | Pending (section 8)                                                                                     |
| **Product**     | Tally Runner (worker payments, batch calculation, reconciliation)                                       |

---

## 1. S0 recap

Recalculating worker payments for jobs that already have payment records creates **duplicate** `worker_payment` rows instead of replacing the existing calculation. This leads to **inflated totals**, **overpayment risk**, and **audit confusion**. The fix: **check for duplicates** before save, **warn** the user, **soft-replace** for unpaid jobs, and **block** recalculation of paid jobs (adjustment workflow deferred to Phase B).

---

## 2. S1 decisions (resolved here)

### 2.1 Duplicate detection query

| Decision           | Choice                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------- |
| **Query location** | Server-side in `save-worker-payment` Edge Function (single source of truth)                 |
| **Batch statuses** | Check `calculated`, `approved`, `processing`, `completed`; exclude `cancelled`              |
| **Response shape** | Return `{ duplicates: Array<{ job_id, batch_id, batch_status, calculated_at }> }` to client |

**Query:**

```sql
SELECT DISTINCT wp.job_id, wpb.id AS batch_id, wpb.status AS batch_status, wpb.calculated_at
FROM worker_payment wp
JOIN worker_payment_batch wpb ON wpb.id = wp.batch_id
WHERE wp.organization_id = :org_id
  AND wp.job_id = ANY(:selected_job_ids)
  AND wpb.status NOT IN ('cancelled')
ORDER BY wpb.calculated_at DESC;
```

### 2.2 Decision matrix

| Existing batch status | User action        | System behaviour                                                     |
| --------------------- | ------------------ | -------------------------------------------------------------------- |
| `calculated`          | Confirm replace    | Delete old `worker_payment` rows; cancel empty batches; create new   |
| `approved`            | Confirm replace    | Same as `calculated` (both are "unpaid")                             |
| `processing`          | Confirm replace    | Same as `calculated` (rare intermediate state)                       |
| `completed` (paid)    | **Blocked**        | Show error; cannot recalculate paid jobs (adjustment workflow later) |
| `cancelled`           | N/A (not detected) | Proceed normally (cancelled records are ignored)                     |

### 2.3 Empty batch handling

| Scenario                              | Behaviour                                                  |
| ------------------------------------- | ---------------------------------------------------------- |
| All `worker_payment` rows deleted     | Set `worker_payment_batch.status = 'cancelled'`            |
| Some rows remain (partial overlap)    | Batch remains; only overlapping jobs' rows deleted         |
| Batch `calculation_data` preservation | **Keep** — provides audit trail even for cancelled batches |

### 2.4 API contract changes

**`save-worker-payment` request (extended):**

```typescript
interface SaveWorkerPaymentRequest {
  organization_id: string;
  calculation: {
    /* existing */
  };
  job_ids: string[];
  /** If true, delete existing calculated payments for overlapping jobs. */
  replace_existing?: boolean;
}
```

**`save-worker-payment` response (extended):**

```typescript
interface SaveWorkerPaymentResponse {
  success: boolean;
  batch_id?: string;
  payment_count?: number;
  /** Present when duplicates detected and replace_existing not set. */
  duplicates?: Array<{
    job_id: string;
    batch_id: string;
    batch_status: string;
    calculated_at: string;
  }>;
  /** Present when any duplicate is in 'completed' status. */
  blocked_jobs?: Array<{
    job_id: string;
    batch_id: string;
    batch_status: "completed";
  }>;
  /** Stats when replace happened. */
  replaced?: {
    jobs_replaced: number;
    batches_cancelled: number;
  };
}
```

### 2.5 UI flow

| Step | UI State                                                                                   |
| ---- | ------------------------------------------------------------------------------------------ |
| 1    | User clicks "Save Payment" after preview                                                   |
| 2    | Client calls `save-worker-payment` with `replace_existing: false` (or omitted)             |
| 3a   | If no duplicates → normal success toast                                                    |
| 3b   | If duplicates (unpaid) → show warning dialog with list; user chooses "Replace" or "Cancel" |
| 3c   | If duplicates (any paid) → show error dialog; "Cancel" only (no replace option)            |
| 4    | On "Replace" → retry with `replace_existing: true`                                         |
| 5    | Success toast: "Payment saved. Replaced [n] previous calculation(s)."                      |

### 2.6 UI copy (locked)

| Context             | Copy                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **Warning title**   | "Replace existing calculations?"                                                                     |
| **Warning body**    | "The following jobs already have pending (unpaid) payments. Saving will replace those calculations." |
| **Warning list**    | "[Job date] — [Location] (Batch from [date])" for each duplicate                                     |
| **Warning buttons** | "Cancel" (secondary), "Replace and Save" (primary)                                                   |
| **Error title**     | "Cannot recalculate paid jobs"                                                                       |
| **Error body**      | "The following jobs have already been marked as paid. To adjust these, use the Adjustment workflow." |
| **Error button**    | "OK" (single dismiss)                                                                                |
| **Success toast**   | "Payment saved. Replaced [n] previous calculation(s)." OR "Payment calculation saved successfully."  |

---

## 3. Technical feasibility

### 3.1 Touchpoints

| Layer         | Work                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| **Edge**      | `save-worker-payment`: Add duplicate query, `replace_existing` param, delete logic, batch cancel logic |
| **Edge**      | New helper: `checkDuplicatePayments(org_id, job_ids)` in `_utils/` for reuse                           |
| **Dashboard** | `calculate-payment-dialog.tsx`: Add warning/error dialog states, retry logic with `replace_existing`   |
| **Dashboard** | `useWorkerPayments` hook: Update `savePayments` to handle duplicate response + retry                   |
| **Types**     | `worker-payment.service.ts`: Extend request/response types                                             |
| **DB**        | No schema changes required (status constraints already exist)                                          |

### 3.2 Pseudocode (save-worker-payment flow)

```
function handleSave(request):
  duplicates = checkDuplicatePayments(org_id, job_ids)

  if duplicates.length > 0:
    blocked = duplicates.filter(d => d.batch_status === 'completed')

    if blocked.length > 0:
      return { success: false, blocked_jobs: blocked }

    if not request.replace_existing:
      return { success: false, duplicates: duplicates }

    // Replace mode: delete old records
    for each duplicate:
      DELETE FROM worker_payment WHERE job_id = d.job_id AND batch_id = d.batch_id

    // Cancel now-empty batches
    empty_batches = SELECT batch_id FROM worker_payment_batch
                    WHERE id IN (duplicate batch_ids)
                    AND NOT EXISTS (SELECT 1 FROM worker_payment WHERE batch_id = wpb.id)

    UPDATE worker_payment_batch SET status = 'cancelled' WHERE id IN (empty_batches)

  // Normal insert (existing logic)
  batch = INSERT INTO worker_payment_batch ...
  payments = INSERT INTO worker_payment ...

  return {
    success: true,
    batch_id: batch.id,
    replaced: { jobs_replaced: duplicates.length, batches_cancelled: empty_batches.length }
  }
```

### 3.3 Testing

| Test type       | Coverage                                                                             |
| --------------- | ------------------------------------------------------------------------------------ |
| **Unit (Deno)** | `checkDuplicatePayments`: returns correct jobs; excludes cancelled batches           |
| **Unit (Deno)** | Delete logic: removes only target job_id rows; leaves other jobs in batch intact     |
| **Unit (Deno)** | Batch cancellation: only cancels batches with zero remaining payments                |
| **Unit (Deno)** | Blocked detection: correctly identifies `completed` batches                          |
| **Integration** | Full flow: save → recalculate (replace) → verify old payments gone, new batch exists |
| **Integration** | Paid job blocking: attempt recalculate on paid job → blocked response                |
| **Component**   | Warning dialog renders with correct job list                                         |
| **Component**   | Error dialog renders for paid jobs; no "Replace" button                              |

### 3.4 Risks to existing data

| Risk                                       | Likelihood | Mitigation                                                         |
| ------------------------------------------ | ---------- | ------------------------------------------------------------------ |
| Accidental deletion of wrong payments      | Low        | Delete is scoped to specific `(job_id, batch_id)` pairs from query |
| Race condition (two tabs)                  | Low        | Last write wins; acceptable for MVP; idempotency key for v2        |
| Cancelled batches still visible in History | Info       | Intentional — provides audit trail; filter UI if desired later     |

---

## 4. Risk assessment

| Risk                                    | Likelihood | Impact | Mitigation                                                         |
| --------------------------------------- | ---------- | ------ | ------------------------------------------------------------------ |
| User accidentally replaces (no undo)    | Medium     | Medium | Warning dialog with job list; require explicit confirm             |
| Partial batch delete causes confusion   | Low        | Low    | Clear toast message; History shows both batches                    |
| Adjustment workflow missing (paid jobs) | Medium     | Medium | Clear error message; Phase B backlog; workaround: cancel old batch |
| Delete fails mid-transaction            | Low        | High   | Wrap delete + insert in transaction; rollback on failure           |

---

## 5. Phased delivery

| Phase        | Deliverables                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------- |
| **v1 (MVP)** | Duplicate detection; warning dialog (unpaid); error dialog (paid); soft replace; batch cancel  |
| **v1.1**     | "Undo replace" within session (soft delete with TTL restore); enhanced History filtering       |
| **Phase B**  | Adjustment workflow for paid jobs (new batch type `adjustment`, `references_batch_id`)         |
| **Phase C**  | Full ledger model (`worker_payment_event` table) per S2-worker-payments-period-accrual.md §4.4 |

---

## 6. Acceptance criteria (v1)

1. **Duplicate detection:** Saving payments for jobs already in an open (non-cancelled) batch returns `duplicates` array.
2. **Unpaid warning:** UI shows warning dialog listing affected jobs; user can cancel or confirm replace.
3. **Paid blocking:** If any selected job is in a `completed` batch, save is blocked; error dialog shown.
4. **Soft replace:** On confirm, old `worker_payment` rows for those jobs are deleted; new batch is created.
5. **Batch cancel:** Batches with zero remaining payments after delete are set to `cancelled` status.
6. **Audit preserved:** Cancelled batches retain `calculation_data`; visible in History with "Cancelled" badge.
7. **No regression:** Jobs with no prior payments save normally (no warning, no extra logic triggered).
8. **Toast feedback:** Success message indicates if replacements occurred.

---

## 7. Open items for S2 / product (not blocking v1)

- **Adjustment workflow (Phase B):** How to handle recalculation of paid jobs (delta display, adjustment batches).
- **Multi-batch scenario:** Job appears in multiple open batches (edge case) — delete from all or most recent?
- **Undo replace:** Soft delete with time-limited restore option.
- **History filtering:** Option to hide cancelled batches by default.
- **Retroactive cleanup:** Tool to identify and merge existing duplicate batches.

---

## 8. Gold review (codebase cross-check)

Independent pass against `save-worker-payment`, `list-worker-payments`, `update-worker-payment-status`, and dashboard components.

### 8.1 Findings and resolutions

| #      | Finding                                                                                                                                 | Severity   | Resolution                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| **G1** | `save-worker-payment` has no transaction wrapper; concurrent calls could create duplicates between check and insert.                    | **Medium** | **v1:** Add transaction for delete + insert sequence. Document race condition for separate tabs. |
| **G2** | `list-worker-payments` returns all batches; no indication of "superseded" or duplicate jobs — UI shows all with equal weight.           | **Low**    | **v1:** Cancelled batches already have distinct status/badge. Enhanced filtering is v1.1.        |
| **G3** | `worker_payment` has `ON DELETE CASCADE` from `job`; no cascade from `batch` — deleting batch orphans payments (but we use `SET NULL`). | **Info**   | Confirmed: batch deletion sets `batch_id = NULL`; we're updating status, not deleting batches.   |
| **G4** | `calculate-payment-dialog.tsx` has `selectionStaleForSave` check; ensure duplicate flow doesn't bypass this validation.                 | **Low**    | **v1:** Duplicate check happens **after** stale check; user must preview before replace too.     |
| **G5** | No index on `worker_payment(job_id)` — duplicate query may be slow for large orgs.                                                      | **Low**    | **v1:** Query is filtered by org_id first (indexed); job_id scan is bounded. Add index in v1.1.  |
| **G6** | `payment_history_list.tsx` shows status badges; verify "Cancelled" badge exists and is styled appropriately.                            | **Info**   | Confirmed: `statusConfig` includes `cancelled` with muted styling (per S2-worker-payments doc).  |

### 8.2 Gold verdict

**Ready for S2 / implementation.** No blocking issues. G1 (transaction) is a v1 deliverable; G5 (index) is a v1.1 optimization.

---

## 9. References

### Internal

- [S0 — Worker payment duplicate prevention](./S0-worker-payment-duplicate-prevention.md)
- [S2 — Worker payments period accrual](./S2-worker-payments-period-accrual.md) (§4.5, §4.6)
- `database/supabase/functions/save-worker-payment/index.ts`
- `database/supabase/functions/list-worker-payments/index.ts`
- `dashboard/components/worker-payments/calculate-payment-dialog.tsx`

### External

- [Payment Reconciliation Best Practices](https://invoicedataextraction.com/blog/payment-reconciliation)
- [Modern Treasury — Ledgering Patterns](https://docs.moderntreasury.com/ledgers/docs/ledgering-of-partially-reconciled-expected-payments)

---

_End of S1 — gold-reviewed. **Next:** [S2 — Features & Functions](./S2-worker-payment-duplicate-prevention.md) or proceed directly to implementation (scope is small)._
