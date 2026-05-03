# S0 — Idea Intake: Duplicate payment prevention and soft replace

| Field        | Value                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------- |
| **Stage**    | S0 — Idea capture (not triage; no build commitment)                                            |
| **Captured** | 2026-04-30                                                                                     |
| **Updated**  | 2026-04-30                                                                                     |
| **Product**  | Tally Runner — Worker Payments (batch calculation, reconciliation, handoff)                    |
| **Source**   | Internal QA — observed bug where recalculating payments creates duplicates instead of updating |

---

## 1. Idea (submitter language)

When an admin **recalculates** worker payments for a job that was **already calculated**, the system creates **duplicate** `worker_payment` records instead of **replacing** the old calculation. This leads to:

- **Inflated totals** in the History view (same job counted multiple times)
- **Confusion** about which batch is the "real" one
- **Risk** of paying workers twice if the admin doesn't manually cancel old batches

The expected behaviour:

- **Unpaid jobs**: Recalculating should **replace** the previous calculation (with a warning)
- **Paid jobs**: Recalculating should be **blocked** (or require an explicit adjustment workflow)

---

## 2. Problem / opportunity (why this matters)

### Current state

| Area                      | Behaviour                                                                       |
| ------------------------- | ------------------------------------------------------------------------------- |
| **`save-worker-payment`** | Always **creates new** `worker_payment_batch` + `worker_payment` rows           |
| **Duplicate check**       | **None** — no query to see if job is already in an open batch                   |
| **History**               | Shows **all** batches, including duplicates for the same jobs                   |
| **Mark as Paid flow**     | Works per-batch; if duplicates exist, **all** could be marked paid accidentally |

### Impact

1. **Data integrity**: Payment totals drift from reality; reconciliation becomes manual.
2. **Audit confusion**: Multiple batches for the same job; which is authoritative?
3. **Overpayment risk**: Admin may pay from a stale batch, then pay again from the new one.
4. **Trust erosion**: System appears buggy when totals don't match expectations.

### Prior documentation

- **S2-worker-payments-period-accrual.md §4.5** — "Double-pay prevention" flagged this gap; proposed a query to check existing batches.
- **S2-worker-payments-period-accrual.md §4.6** — "Job edit adjustments" proposed Option A (warning) for MVP, Option B (auto-adjustment) for later.

---

## 3. Success (what "good" looks like — draft)

| Outcome                   | Description                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **No silent duplicates**  | Saving a calculation for jobs already in an open batch shows a **warning** and requires **confirmation**.    |
| **Soft replace (unpaid)** | Confirmed save **deletes** old `worker_payment` rows for those jobs; empty batches are marked **cancelled**. |
| **Block paid jobs**       | Jobs in a **completed** (paid) batch **cannot** be recalculated without an explicit adjustment workflow.     |
| **Clear UI feedback**     | Warning copy explains what will happen; toast confirms action taken.                                         |
| **Audit trail preserved** | `calculation_data` on batches retains the original calculation; cancelled batches remain visible in History. |
| **No breaking changes**   | Jobs with no prior calculation continue to work as before (no regression).                                   |

_(Exact API contracts, UI copy, and migration rules belong in S1/S2.)_

---

## 4. Research summary (landscape — not a decision yet)

### 4.1 Industry patterns for payment reconciliation

| Pattern                | Description                                                        | Fit for Tally                                        |
| ---------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| **Append-only ledger** | Never mutate; create adjustment/reversal events                    | Best audit; complex for MVP                          |
| **Supersede pattern**  | New batch marks old records as "superseded"; both remain for audit | Good balance; adds status complexity                 |
| **Soft replace**       | Delete "calculated" records; preserve "paid" records               | Simplest UX; acceptable audit via `calculation_data` |
| **Warning + Block**    | Prevent duplicates; require manual resolution                      | Safe but clunky; user manages batches                |

**Recommendation for MVP:** Soft replace for unpaid + block for paid — simplest UX while preserving paid records.

### 4.2 Current codebase (facts for S1)

| Area                                        | Notes                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| **`worker_payment` table**                  | No unique constraint on `(job_id, worker_id)` — duplicates allowed by schema |
| **`save-worker-payment/index.ts`**          | Insert-only; no duplicate check; no delete logic                             |
| **`list-worker-payments/index.ts`**         | Returns all batches; no filter for "latest per job" or deduplication         |
| **`update-worker-payment-status/index.ts`** | Sets batch to `completed` when marked paid; individual payments to `paid`    |
| **`calculate-payment-dialog.tsx`**          | No warning state for duplicates; calls `onCalculate` directly                |
| **Batch status constraint**                 | `calculated`, `approved`, `processing`, `completed`, `cancelled`             |
| **Payment status constraint**               | `calculated`, `pending`, `processing`, `paid`, `failed`, `cancelled`         |

### 4.3 Design options (for S1 triage — not decided in S0)

| Option                                | Description                                                                      | Tradeoffs                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **A. Check + Warning + Soft Replace** | Query for existing; warn user; delete old calculated records on confirm          | **Simplest UX**; minimal schema change; audit via `calculation_data` |
| **B. Supersede status**               | Add `superseded_by_batch_id` column; old records remain but filtered from totals | Better audit trail; more complex queries                             |
| **C. Full ledger model**              | `worker_payment_event` table with accrual/adjustment/reversal events             | Best audit; requires event infrastructure (Phase C)                  |
| **D. Unique constraint + Error**      | Add `UNIQUE(job_id, worker_id, batch_status NOT cancelled)`; reject duplicates   | Requires schema migration; poor UX (hard error)                      |

**Recommended direction for MVP:** Option A — minimal change, good UX, acceptable audit.

---

## 5. Proposed behaviour (Phase A)

### 5.1 Pre-save duplicate check

Before inserting new `worker_payment` records:

```sql
SELECT wp.job_id, wp.worker_id, wpb.id AS batch_id, wpb.status AS batch_status
FROM worker_payment wp
JOIN worker_payment_batch wpb ON wpb.id = wp.batch_id
WHERE wp.organization_id = :org_id
  AND wp.job_id = ANY(:selected_job_ids)
  AND wpb.status NOT IN ('cancelled')
ORDER BY wpb.calculated_at DESC;
```

### 5.2 Decision tree

```
┌─────────────────────────────────────────────────────────────────┐
│                   User clicks "Save Payment"                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
            ┌────────────────────────────────────┐
            │ Check: Any selected jobs already   │
            │ in non-cancelled batches?          │
            └─────────┬────────────┬─────────────┘
                      │            │
                 NO   │            │ YES
                      ▼            ▼
           ┌──────────────┐  ┌─────────────────────────────────┐
           │ Normal save  │  │ Any of those batches "completed"?│
           │ (no change)  │  └─────────┬───────────┬───────────┘
           └──────────────┘            │           │
                                  NO   │           │ YES
                                       ▼           ▼
                          ┌────────────────┐  ┌─────────────────────────┐
                          │ Show warning:  │  │ Show error:             │
                          │ "Replace?"     │  │ "Job X already paid     │
                          │ [Cancel][Save] │  │  in batch Y. Cannot     │
                          └───────┬────────┘  │  recalculate."          │
                                  │           └─────────────────────────┘
                                  ▼
                          ┌────────────────────────────────────────────┐
                          │ On confirm:                                │
                          │ 1. Delete old worker_payment rows for jobs │
                          │ 2. If batch now empty → cancel batch       │
                          │ 3. Create new batch + records              │
                          └────────────────────────────────────────────┘
```

### 5.3 UI copy (draft)

| Scenario                | Message                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| **Warning (unpaid)**    | "The following jobs already have pending payments: [list]. Saving will replace those calculations."  |
| **Error (paid)**        | "Job [name] was already paid in batch [date]. To adjust, use the Adjustment workflow (coming soon)." |
| **Toast (success)**     | "Payment saved. Previous calculation for [n] job(s) was replaced."                                   |
| **Toast (normal save)** | "Payment calculation saved successfully."                                                            |

### 5.4 Edge cases

| Case                                  | Handling                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------- |
| **Job in multiple old batches**       | Delete from all open (non-cancelled) batches; cancel any that become empty |
| **Partial overlap**                   | Only warn/delete for overlapping jobs; non-overlapping jobs proceed        |
| **Race condition (two tabs)**         | Last write wins; consider idempotency key in future                        |
| **Batch has mix of paid/unpaid jobs** | Block the entire save if any selected job is paid                          |

---

## 6. Future phases (out of scope for Phase A)

### Phase B — Adjustment workflow for paid jobs

When a paid job is edited and recalculated:

1. Show delta (e.g., "Original: $100, Current: $120, Adjustment: +$20")
2. Create **adjustment batch** with `adjustment_type = 'adjustment'` and `references_batch_id`
3. Adjustment appears in History with clear label

**Schema addition (Phase B):**

```sql
ALTER TABLE worker_payment_batch
  ADD COLUMN adjustment_type TEXT CHECK (adjustment_type IN ('original', 'adjustment', 'reversal')),
  ADD COLUMN references_batch_id UUID REFERENCES worker_payment_batch(id);
```

### Phase C — Full ledger model

Per S2-worker-payments-period-accrual.md §4.4:

- `worker_payment_event` table with event types: `accrual`, `adjustment`, `reversal`, `batch_save`, `mark_paid`
- Running balances from aggregation
- Period-based views

---

## 7. Out of scope for S0 (explicit)

- Final API contracts and Edge Function implementation
- Exact dashboard UX and component structure
- Schema migrations for adjustment workflow (Phase B)
- Ledger event model (Phase C)
- Unique constraint changes to `worker_payment` table
- Retroactive cleanup of existing duplicates (may be addressed separately)

---

## 8. Post–gate check (S0 quality)

> If someone reads this idea in 6 months with no other context, will they understand what was meant?

**Reader should take away:** Tally Runner currently allows duplicate payment calculations for the same jobs, causing inflated totals and overpayment risk. Phase A introduces a **duplicate check** before save, **warns** the user, and **soft-replaces** previous calculations for unpaid jobs while **blocking** recalculation of paid jobs. Future phases add explicit **adjustment workflows** and a **ledger model** for full audit trails.

---

## 9. References

### Internal (codebase)

- `database/supabase/functions/save-worker-payment/index.ts` — current insert-only save logic
- `database/supabase/functions/list-worker-payments/index.ts` — batch listing
- `database/supabase/functions/update-worker-payment-status/index.ts` — mark paid flow
- `dashboard/components/worker-payments/calculate-payment-dialog.tsx` — save UI
- `docs/stages/S2-worker-payments-period-accrual.md` — §4.5 (double-pay prevention), §4.6 (job edit adjustments)
- `docs/research/WORKER_PAYMENT_FLOW_AND_CYCLES.md` — payment cycle design notes

### External (research)

- Payment Reconciliation: Types, Process, and Automation — [invoicedataextraction.com](https://invoicedataextraction.com/blog/payment-reconciliation)
- General Ledger Reconciliation: Best Practices 2026 — [scryai.com](https://scryai.com/blog/general-ledger-reconciliation/)
- Ledgering of Partially Reconciled Payments — [Modern Treasury docs](https://docs.moderntreasury.com/ledgers/docs/ledgering-of-partially-reconciled-expected-payments)

---

_End of S0. **Next:** [S1 — Triage](./S1-worker-payment-duplicate-prevention.md) (scope lock, acceptance criteria, implementation plan)._
