# S2 — Features & Functions: Pay periods, accrual-on-completion, overview & history IA (v1)

| Field                  | Value                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Stage**              | S2 — Features & Functions (scope lock before S3 DAP / HLP)                                                                                                                                                                                 |
| **From S1**            | [`S1-worker-payments-period-accrual-overview.md`](./S1-worker-payments-period-accrual-overview.md) (2026-04-28)                                                                                                                            |
| **Parent tracks**      | Builds on [handoff S2](./S2-worker-payments-disbursement.md) (CSV, reconciliation, M-1–M-4) and [calculate-ux S2/S3](./S2-worker-payments-calculate-ux.md) (date presets, per-worker preview). **Does not** revoke non-custodial boundary. |
| **Created**            | 2026-04-27                                                                                                                                                                                                                                 |
| **Updated**            | 2026-04-27 (Gold + Adversarial review completed)                                                                                                                                                                                           |
| **Product**            | Tally Runner — **Worker Payments** (overview, period, accrual, history, settlement **recording**)                                                                                                                                          |
| **Gold review**        | **Completed** 2026-04-27 — see §13                                                                                                                                                                                                         |
| **Adversarial review** | **Completed** 2026-04-27 — see §14                                                                                                                                                                                                         |

---

## 1. S1 recap (locked gates)

| Gate                                                                | Outcome            | Notes                                                                                                                          |
| ------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **G1** — IA: History naming + Paid/Unpaid prominence                | **GO**             | Rename **Payment History** → **History** (or **Past pay runs**); de-emphasise **Approve**; badge priority = **Paid / Unpaid**. |
| **G2** — Org pay period settings (week / fortnight / month)         | **GO**             | Settings + persistence; drive **Overview** period boundaries.                                                                  |
| **G3** — Accrual on job completion (automatic roll-up)              | **GO (direction)** | Automatic updates to period worker balances when completion + confirmation rules pass.                                         |
| **G4** — Overview redesign (period + outstanding + path to History) | **GO**             | Overview = current period + unpaid surface; History = past; mark paid moves items to History.                                  |
| **G5** — Anti–double-pay + job edit adjustments                     | **GO**             | Unique intent per job × period; edit path must not silently duplicate full pay.                                                |

**Open questions resolved:** See **§8** for O-1–O-4 recommendations now locked for this S2.

---

## 2. Product boundaries

| In scope (this S2)                                                                                                                                                    | Out of scope                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **G1 Phase A:** Rename "Payment History" → "History"; remove **Approve** button; badge = **Paid / Unpaid** (status mapping in **§4**)                                 | **Per-line** or **per-worker** "mark paid" (batch-level unchanged)       |
| **G2:** Org pay period settings schema + UI (week / fortnight / month + timezone)                                                                                     | **True** payroll calendar with holidays/public holiday rules             |
| **G3 engine design:** Accrual trigger definition, idempotency rules, storage model recommendation                                                                     | **Full accrual build** (Phase C — separate S3 / DAP after this S2 locks) |
| **G4 Overview UI spec:** Current period header, per-worker running totals (pre-accrual: from jobs + existing batches), outstanding surface, mark paid flow to History | **Real-time WebSocket push** for accrual updates (MVP: poll or refetch)  |
| **G5 rules:** Double-pay prevention predicate, job edit adjustment event definition                                                                                   | **Retroactive adjustment** for batches marked **Paid** (v2+)             |
| **Non-custodial messaging (M-1–M-4):** Unchanged from [handoff S2](./S2-worker-payments-disbursement.md)                                                              | **Money movement**, **ABA/STP**, **tax docs**                            |

---

## 3. Personas & user stories

| ID       | Persona       | Story                                                                                                                                                                                          |
| -------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-10** | **Org admin** | When I look at **History**, I need to see **Paid** or **Unpaid** at a glance — not workflow words like "Approved" that imply I'm authorising bank transfers.                                   |
| **F-11** | **Org admin** | I need to set my org's **pay period** (week, fortnight, or month) so the **Overview** shows the current period without me recalculating dates.                                                 |
| **F-12** | **Org admin** | When a job is **completed and confirmed**, I expect the worker's **running total** for the current period to update automatically — I shouldn't have to "Calculate" for every incremental job. |
| **F-13** | **Org admin** | I need the **Overview** to show **outstanding** (unpaid) amounts so I know what I still owe workers before marking batches paid.                                                               |
| **F-14** | **Org admin** | I need Tally to **prevent** me from paying a worker twice for the same job — or at least warn me clearly.                                                                                      |
| **F-15** | **Org admin** | If I **edit a job** after it was included in a batch, I need to see an **adjustment** — not a silent change that breaks reconciliation.                                                        |

---

## 4. Data rules & schema (normative)

### 4.1 Status mapping (G1)

**DB status sources (verified Gold review):**

- `worker_payment_batch.status`: `calculated`, `approved`, `processing`, `completed`, `cancelled` (constraint in schema.sql)
- `worker_payment.status` (line items): `calculated`, `pending`, `processing`, `paid`, `failed`, `cancelled`

**Key insight:** When batch is marked "paid" via `updatePaymentStatus`, the **batch** status becomes `completed` and each **line item** status becomes `paid`.

| Batch DB status | Current UI label | New UI label (G1) | Badge colour      | Notes                                                               |
| --------------- | ---------------- | ----------------- | ----------------- | ------------------------------------------------------------------- |
| `calculated`    | Calculated       | **Unpaid**        | Neutral (outline) | Initial state after save                                            |
| `approved`      | Approved         | **Unpaid**        | Neutral (outline) | Remove Approve button; legacy rows display as Unpaid                |
| `processing`    | Processing       | **Unpaid**        | Neutral (outline) | Intermediate state (rarely used); treat as Unpaid                   |
| `completed`     | Completed        | **Paid**          | Green             | Final settled state — batch "completed" means line items are `paid` |
| `cancelled`     | Cancelled        | **Cancelled**     | Muted             | Keep separate; not "Unpaid"                                         |

**UI statusConfig also has `paid` and `failed`:** These come from line-item statuses or legacy UI paths. For History list (which shows batches):

- `status === "completed"` → green **Paid** badge
- `status === "cancelled"` → muted **Cancelled** badge
- All others → neutral **Unpaid** badge

Remove **Approve** button from History entirely.

### 4.2 Organisation pay period settings (G2)

**Existing schema (verified Gold review):** `organization_settings.worker_payment_cycle_config` (JSONB) already exists with documented structure:

```json
{
  "payment_frequency": "weekly" | "fortnightly" | "monthly",
  "payment_day_of_week": number,    // 0-6 (for weekly/fortnightly)
  "payment_day_of_month": number,   // 1-31 (for monthly)
  "cut_off_time": string,           // e.g. "17:00"
  "require_approval": boolean,
  "auto_calculate": boolean
}
```

**Recommendation:** Extend this existing JSONB (or create sibling `pay_period_config`) rather than adding new columns. Add `timezone` (IANA string) to the config.

**Extended schema proposal:**

```typescript
// dashboard/lib/types.ts — add to OrganizationSettings or create WorkerPaymentCycleConfig
interface WorkerPaymentCycleConfig {
  payment_frequency: "weekly" | "fortnightly" | "monthly" | null;
  payment_day_of_week?: number | null; // (existing) semantics: align with DB comment "Monday = …" in DAP (see A-2.1)
  payment_day_of_month?: number | null; // (existing)
  cut_off_time?: string | null; // (existing)
  timezone?: string | null; // IANA timezone (NEW) — e.g. "Australia/Adelaide"; null = UTC
  require_approval?: boolean; // (existing)
  auto_calculate?: boolean; // (existing)
}
```

**Note:** The existing `payment_frequency` maps to S1's "pay period type" — **no new column needed** for the core setting.

**A-2.1 (day-of-week semantics):** The DB column comment says _"All cycles start on Monday"_ while the TypeScript sketch above used `0 = Sunday` for `payment_day_of_week`. **DAP must** pick one convention (recommend: match DB comment — `1 = Monday … 7 = Sunday` **or** document ISO weekday `1–7` only) and apply it in `get-organization-settings` / UI / period math. **Do not** mix two schemes in one org.

**Period boundary rules:**

| Period type   | Start                                                                     | End                                            | Example (today = Wed 2026-04-15, TZ = Australia/Adelaide)                                        |
| ------------- | ------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **week**      | 00:00 on anchor weekday (default Monday) of the ISO week containing today | 23:59:59.999 on day before next anchor weekday | Mon Apr 13 00:00 → Sun Apr 19 23:59:59                                                           |
| **fortnight** | 00:00 on anchor weekday two weeks before (or org-defined anchor date)     | 23:59:59.999 on day before next anchor         | Rolling 14 days: Wed Apr 2 00:00 → Tue Apr 15 23:59:59 (MVP: rolling; v1.1: true payroll anchor) |
| **month**     | 00:00 on 1st of current month                                             | 23:59:59.999 on last day of month              | Apr 1 00:00 → Apr 30 23:59:59                                                                    |

**Edge functions / API:** Add optional `period` filter to `list-worker-payments` and `calculate-worker-payment` (accepts `{ from: ISO, to: ISO }`); derive from org settings when not provided.

### 4.3 Accrual trigger definition (G3 — O-1 resolved)

**Codebase findings:**

- `Job.completed_at`: ISO timestamp when job was completed
- `Job.workers[]`: array of `JobWorkerWithConfirmation`
- `JobWorkerWithConfirmation.confirmation_status`: `"confirmed" | "pending" | "flagged"`
- `JobWorkerWithConfirmation.confirmed_at`: timestamp when worker confirmed

**Accrual trigger predicate (normative):**

```typescript
function isJobReadyForAccrual(job: Job): boolean {
  if (!job.completed_at) return false;
  // Reject only explicit non-approved workflow states; allow "approved" or
  // undefined (legacy jobs / API rows before approval_status was populated).
  if (
    job.approval_status === "pending" ||
    job.approval_status === "flagged" ||
    job.approval_status === "cancelled"
  ) {
    return false;
  }
  return true;
}
```

**A-1 (optional `approval_status`):** `Job.approval_status` is optional. A naïve `=== "approved"` check **blocks** legacy rows where the field is absent. **Normative rule:** treat **`undefined` as allow** (accrue when other conditions are met) **or** backfill in `list-jobs` / job loaders before Phase C; **DAP** must assert one path in unit tests.

**Note:** The S1 phrase "confirmed by any other worker" was a hypothesis. The actual implementation: **all** non-submitter `job_worker` rows must reach `confirmation_status === "confirmed"` (or be auto-confirmed) before `job.approval_status` becomes `"approved"`. The **predicate above** encodes that by **rejecting** explicit bad workflow states; **`approved` and `undefined`** both pass (A-1).

**Solo worker / no-colleague case:** Per `create-job` implementation:

- If only the submitter is in `colleague_ids` (or `colleague_ids` is empty), `needsConfirmation` is false and the job is **`approved` immediately** at creation.
- No additional confirmation workflow runs; the job is ready for accrual as soon as `completed_at` is set.

**Implication:** Solo worker jobs do **not** require special handling for accrual — they already pass `approval_status === "approved"`. The `edit_window_expires_at` / `auto_approve_at` delays apply only to multi-colleague jobs where peer confirmation is pending.

### 4.4 Accrual storage model (G3 — design recommendation)

**Options evaluated:**

| Model                              | Description                                                                                                              | Pros                                                    | Cons                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------- |
| **A — Materialised balances**      | New `worker_period_balance` table: `(org_id, worker_id, period_start, period_end, running_total, job_ids[], updated_at)` | Fast reads for Overview; single row per worker × period | Write amplification on job complete; need triggers/events |
| **B — Append-only ledger**         | New `worker_payment_event` table: `(id, org_id, worker_id, job_id, event_type, amount, timestamp)`                       | Audit trail; immutable; events for edit adjustments     | Query complexity for "current balance"; need aggregation  |
| **C — Derive from jobs + batches** | No new persistence; compute Overview from `jobs` + `worker_payment_batch` on demand                                      | No migration; uses existing data                        | Performance at scale; complex query; no event trail       |

**Recommendation:** **Model B (ledger)** with **materialised view** or **periodic snapshot** for Overview performance.

- `worker_payment_event` rows: `{ id, org_id, worker_id, job_id, event_type: "accrual" | "adjustment" | "batch_save" | "mark_paid", amount_delta, period_start, period_end, created_at, metadata }`
- Overview queries: `SUM(amount_delta) WHERE period_start = X AND event_type IN ("accrual", "adjustment") AND NOT superseded`
- **Phase C S3** will define exact schema and event handlers

### 4.5 Double-pay prevention (G5)

**Current state:** No constraint prevents same job appearing in multiple batches.

**New rule (testable predicate):** The `worker_payment` table has **no** `event_type` column (A-3: prior sketch was invalid). Use joins to `worker_payment_batch` and line status, or a pure app-layer check.

```sql
-- Example: "already in an open (non-cancelled) batch for this org"
SELECT 1
FROM worker_payment wp
JOIN worker_payment_batch wpb ON wpb.id = wp.batch_id
WHERE wp.job_id = :job_id
  AND wp.organization_id = :org_id
  AND wpb.status IN ('calculated', 'approved', 'processing', 'completed')
LIMIT 1;
-- completed = user already marked paid; still blocks duplicate *unpaid* intent — product may
-- allow a second *adjustment* batch only after explicit user intent (A-4).
```

**A-3 / A-4:** DAP must define whether a job in a **`completed`** batch may appear again (normally **no** for duplicate _payout_; **yes** for _adjustment_ with audit). **Do not** reference non-existent columns in migrations.

**UI enforcement:**

1. **Calculate dialog:** If selected job already has `worker_payment` row(s), show warning badge + tooltip
2. **Save path:** If any selected job already paid, require explicit "Create adjustment" or "Create duplicate" confirmation
3. **S3 DAP:** Add `job_already_paid_in_batch` flag to calculation response; surface in preview

### 4.6 Job edit adjustments (G5)

**Scenario:** Job J was included in batch B1 (unpaid). Admin edits job J (e.g., changes hours → changes worker split amounts).

**Options:**

| Option                        | Behaviour                                                                                | Pros                   | Cons                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------- |
| **A — Recalc warning**        | Show warning "Amounts in batch B1 are stale; recalculate or create adjustment"           | Simple; user-driven    | User may ignore                         |
| **B — Auto-adjustment event** | Create `worker_payment_event { type: "adjustment", delta: new - old, job_id, batch_id }` | Audit trail; automatic | Complexity; need to track "old" amounts |
| **C — Block edit**            | Prevent editing job if it's in an unpaid batch                                           | Data integrity         | Poor UX; jobs do change                 |

**Recommendation:** **Option A (warning)** for Phase A/B; **Option B (auto-adjustment)** for Phase C when ledger model is implemented.

**Warning copy (M-10):** _"This job is included in an unpaid batch ({batch_id}). Editing may cause the batch totals to be incorrect. Consider recalculating or marking the batch as paid first."_

---

## 5. UI features (normative)

### 5.1 Phase A — IA cleanup (G1)

| #        | Area                 | Work                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **U-10** | `PaymentHistoryList` | Rename CardTitle from "Payment History" to "History" (or "Past pay runs" — final string in impl PR).                                                                                                                                                                                                                                                                                                         |
| **U-11** | `PaymentHistoryList` | Remove **Approve** button entirely. For `calculated` / `approved` / `processing` rows, show **Mark as Paid** directly. **Verify:** `update-worker-payment-status` with `batch_id` + `status: "paid"` has **no** prerequisite `approved` step in the edge function (A-6) — but **orphan batches** (zero `worker_payment` rows) must stay blocked from spurious "paid" if product rejects empty batch updates. |
| **U-12** | `PaymentHistoryList` | Badge: `status === "completed"` → green "Paid"; `status === "cancelled"` → muted "Cancelled"; else → neutral "Unpaid". Remove icons for Approved/Processing; simplify to text only.                                                                                                                                                                                                                          |
| **U-13** | `statusConfig`       | Update config object to new labels per **§4.1**.                                                                                                                                                                                                                                                                                                                                                             |

**Accessibility:** Badge colour alone is not sufficient; "Paid" / "Unpaid" text is primary indicator.

### 5.2 Phase B — Org pay period settings (G2)

| #        | Area                       | Work                                                                                                                                                                                   |
| -------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **U-14** | Organisation Settings page | Add "Pay Period" section: dropdown for type (Week / Fortnight / Month); timezone picker (IANA, default from org locale); optional anchor weekday (for week/fortnight).                 |
| **U-15** | Overview                   | Show "Current period: {formatted date range}" header using org settings. If not configured, prompt to configure or default to month.                                                   |
| **U-16** | Calculate dialog           | If org has period settings, "This week / This fortnight / This month" presets use org timezone (supersede browser-local from [calculate-ux S2](./S2-worker-payments-calculate-ux.md)). |

**Settings UI:** (extends existing `worker_payment_cycle_config` fields)

```
Worker Payment Cycle Settings
────────────────────────────────────────────
Payment frequency:  [Monthly ▼]   ← maps to existing payment_frequency
Timezone:           [Australia/Adelaide ▼]  ← NEW: searchable IANA picker
Payment day:        [Monday ▼] or [15 ▼]   ← maps to existing payment_day_of_week/month
Cut-off time:       [17:00 ▼]             ← maps to existing cut_off_time

[Save]
```

**Note:** UI should read/write to `worker_payment_cycle_config` JSONB via `get-organization-settings` / `update-organization-settings` edge functions.

### 5.3 Phase C — Accrual engine (G3) — _design only in this S2_

**DAP for Phase C is separate S3.** This S2 locks:

- Trigger predicate (§4.3)
- Storage model recommendation (§4.4 — ledger)
- Event types: `accrual`, `adjustment`, `batch_save`, `mark_paid`
- Idempotency: re-fire of job completion event does not create duplicate `accrual` event for same `(job_id, worker_id, period)`

### 5.4 Phase D — Overview redesign (G4)

| #        | Area                      | Work                                                                                                                                                                                                                                                     |
| -------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **U-17** | Overview tab              | Replace current cards with: **(1)** Period header (from U-15), **(2)** Per-worker summary table (name, running total, job count, status), **(3)** Outstanding batches list (unpaid), **(4)** CTA: "Calculate Payments" + "Mark as Paid" for outstanding. |
| **U-18** | Per-worker row (Overview) | Show total owed for period, split mode summary, link to job details.                                                                                                                                                                                     |
| **U-19** | Outstanding section       | List unpaid batches with quick actions: View details, Download CSV, Mark as Paid.                                                                                                                                                                        |
| **U-20** | Transition to History     | **Metaphor, not a data move:** one batch row; status → `completed`; shows under **History** and off "Outstanding" after refresh. Toast: _"Batch recorded as paid. View in History."_ (A-7)                                                               |

**Layout (wireframe):**

```
┌─────────────────────────────────────────────────────────────────────┐
│ Worker Payments                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ [Overview] [History] [Worker Summary] [Rate Cards]                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Current Period: Apr 1 – Apr 30, 2026 (Month)          [Configure]   │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Workers                                                         │ │
│ │ ────────────────────────────────────────────────────────────── │ │
│ │ Name              Running Total    Jobs    Status              │ │
│ │ Alice Smith       $1,250.00        8       5 unpaid            │ │
│ │ Bob Jones         $890.50          5       3 unpaid            │ │
│ │ Carlos Lee        $1,100.00        6       Fully paid          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Outstanding Batches (2)                          [Mark All Paid]│ │
│ │ ────────────────────────────────────────────────────────────── │ │
│ │ Batch Apr 15   $1,450.00   3 workers   [Details] [CSV] [Pay]   │ │
│ │ Batch Apr 8    $980.00     2 workers   [Details] [CSV] [Pay]   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│                                            [Calculate Payments]     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Message & copy inventory

| #        | Where                  | Content                                                                                                                                                                                                                  |
| -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **M-8**  | History section header | Change from "Payment History" to "History" or "Past pay runs"                                                                                                                                                            |
| **M-9**  | Badge tooltip (Unpaid) | _"Not recorded as paid in Tally yet. When you've paid workers in your bank or payroll, mark it here — Tally only stores this record; it does not transfer money."_ (A-5: "Unpaid" must not read as Tally owing workers.) |
| **M-10** | Job edit warning       | _"This job is included in an unpaid batch. Editing may cause batch totals to be incorrect."_ (§4.6)                                                                                                                      |
| **M-11** | Double-pay warning     | _"This job was already included in batch {id}. Adding it again will create a duplicate payment entry."_                                                                                                                  |
| **M-12** | Period settings hint   | _"Set your pay period to see current period totals in Overview."_                                                                                                                                                        |
| **M-13** | Overview empty state   | _"No payments for this period yet. Calculate payments for completed jobs."_                                                                                                                                              |

**Existing M-1–M-4** from [handoff S2](./S2-worker-payments-disbursement.md) remain unchanged.

---

## 7. Migration & compatibility

### 7.1 Status migration (G1)

- **No DB migration required.** Status values remain unchanged; only UI labels change.
- Existing `approved` / `processing` batches display as "Unpaid" with no action required.
- **Test:** Seed history with each status; verify badge mapping.

### 7.2 Org settings migration (G2)

- **DB migration:** Extend existing `organization_settings.worker_payment_cycle_config` JSONB to include `timezone` field (IANA string). No new columns required — the `payment_frequency` field already supports `weekly | fortnightly | monthly`.
- **Default handling:** If `worker_payment_cycle_config` is NULL or `payment_frequency` is not set, UI shows "Not configured" and Overview uses current month (browser timezone) as fallback.
- **Edge function update:** Ensure `get-organization-settings` and `update-organization-settings` expose the full `worker_payment_cycle_config` (currently only partial fields are returned per subagent research).
- **Test:** Existing orgs load without error; new `timezone` field saves/loads correctly.

### 7.3 CSV export compatibility

- **No changes to CSV structure.** [Handoff S2](./S2-worker-payments-disbursement.md) contracts remain intact.
- Phase C accrual will produce the same `worker_payment` rows; export uses `list-worker-payments` → `payments[]`.

---

## 8. Open questions resolved (from S1 §8)

| ID      | Question                                                | Resolution                                                                                                                                                                                                                                                     |
| ------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O-1** | Exact definition of "confirmed by any other worker"     | **Resolved:** The S1 phrase was a hypothesis. Actual rule: use `job.approval_status === "approved"` as the accrual gate. This is set when **all** non-submitter colleagues confirm (or auto-approve runs). Solo jobs are `approved` immediately. See **§4.3**. |
| **O-2** | Should manual Calculate & Save remain forever?          | **Resolved:** **Yes.** Calculate & Save creates auditable batch snapshots for CSV export and reconciliation. Accrual populates running totals in Overview; explicit save creates the handoff artifact. Both coexist.                                           |
| **O-3** | Period boundary inclusive rules (cutoff time, timezone) | **Resolved:** Start inclusive, end inclusive (23:59:59.999 on last day). Use org IANA timezone. See **§4.2**.                                                                                                                                                  |
| **O-4** | Mark as paid granularity (batch vs line vs worker)      | **Resolved:** **Batch-level** for Phase A/B (unchanged from current). Per-worker marking deferred to Phase C+ if operators request it. Batch-level aligns with CSV handoff model.                                                                              |

---

## 9. Non-functional requirements

| NFR               | Target                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| **Correctness**   | Badge mapping matches DB status; period boundaries correct for all timezones (DST edge tests).       |
| **Performance**   | Overview renders in < 500ms for orgs with < 1000 jobs/period (client-side or materialised query).    |
| **PII**           | No new PII fields. Existing worker names visible (same as current).                                  |
| **Accessibility** | Badge text primary (not colour-only); settings form keyboard accessible; Overview table has caption. |
| **i18n**          | Period type labels localisable; timezone picker uses IANA IDs (universal).                           |

---

## 10. Testing strategy

| Layer           | Cases                                                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit**        | Status → badge mapping (batch: `calculated` … `completed` …; UI edge: `paid` on legacy if present); period boundaries; accrual predicate (`undefined` vs `pending` / `flagged` / `cancelled`); double-pay query (A-3). |
| **Component**   | History list renders correct badges; Approve button absent; Mark as Paid shows for unpaid.                                                                                                                             |
| **Integration** | Save → list → verify status; org settings save → load → Overview uses correct period.                                                                                                                                  |
| **Manual QA**   | DST transition (e.g., Australia Apr → Oct); month boundary (Feb 28/29); empty period; 100+ jobs in period.                                                                                                             |

---

## 11. Phased delivery (locked)

| Phase                  | Scope                                                            | Dependencies                                                                      |
| ---------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **A — IA + honesty**   | G1: Rename History, badges (§5.1), remove Approve                | None — can ship standalone                                                        |
| **B — Org period**     | G2: Settings UI + Overview period header (§5.2)                  | Extend `worker_payment_cycle_config` JSONB with `timezone`; update edge functions |
| **C — Accrual engine** | G3 + G5: Events, ledger, anti-duplicate, adjustments (§4.3–§4.6) | Separate S3 DAP; depends on event infrastructure                                  |
| **D — Overview**       | G4: Replace cards with period + outstanding + workers (§5.4)     | Phase B (period settings); Phase C (running totals from ledger)                   |

**Phase A** can ship immediately with [calculate-ux S3](./S3-worker-payments-calculate-ux.md) or standalone.

---

## 12. References

### Internal

- [S1 — Period accrual overview (triage)](./S1-worker-payments-period-accrual-overview.md)
- [S2 — Handoff v1 (disbursement)](./S2-worker-payments-disbursement.md) — CSV, reconciliation, M-1–M-4
- [S2 — Calculate UX](./S2-worker-payments-calculate-ux.md) — date presets, per-worker preview
- [S3 — Calculate UX DAP](./S3-worker-payments-calculate-ux.md) — implemented date presets
- [Operator: Worker payments handoff](../operator/worker-payments-handoff.md)
- `dashboard/lib/types.ts` — `Job`, `JobWorkerWithConfirmation`, `OrganizationSettings`
- `dashboard/components/worker-payments/payment-history-list.tsx` — current History UI
- `dashboard/lib/services/worker-payment.service.ts` — `updatePaymentStatus`, `PaymentRecord`

### External

- [IANA Time Zone Database](https://www.iana.org/time-zones) — timezone identifiers

---

## 13. Gold review — **completed** 2026-04-27

**Scope:** Cross-check §4.1–§4.6 and §7.2 against `database/schema.sql`, `dashboard/lib/types.ts`, `payment-history-list.tsx`, and `update-worker-payment-status/index.ts`.

| ID      | Finding                                                                                                                                                      | Severity   | Action                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------ |
| **G-1** | §4.1 claimed `paid` on batch, but DB constraint shows batch uses `completed`; `paid` is only on `worker_payment` line items                                  | **High**   | **Fixed:** §4.1 rewritten with correct batch/line-item status distinction                  |
| **G-2** | §4.1 missing `completed` status which exists in UI statusConfig                                                                                              | **Medium** | **Fixed:** Added `completed` row to mapping table                                          |
| **G-3** | §4.2 proposed new columns but `organization_settings.worker_payment_cycle_config` JSONB already exists with `payment_frequency`, `payment_day_of_week`, etc. | **High**   | **Fixed:** §4.2 rewritten to extend existing JSONB; only `timezone` is new                 |
| **G-4** | §7.2 migration targeted `organizations` table but settings are on `organization_settings`                                                                    | **Medium** | **Fixed:** §7.2 corrected to reference `organization_settings.worker_payment_cycle_config` |
| **G-5** | `JobApprovalStatus` enum verified: `approved`, `pending`, `flagged`, `cancelled`                                                                             | —          | Confirmed correct in §4.3                                                                  |
| **G-6** | UI `PaymentStatus` includes both `completed` and `paid` (7 values)                                                                                           | **Low**    | Clarified in §4.1 that both map to green "Paid" badge in different contexts                |

**Gate:** Gold **pass** — ready for adversarial review then S3 DAP.

---

## 14. Adversarial review — **completed** 2026-04-27

**Scope:** Stress-test assumptions, legal-adjacent copy, schema honesty, and UX edge cases not covered by Gold (facts vs design).

| ID       | Attack / risk                                                                                                   | Outcome / amendment                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **A-1**  | Optional `approval_status` blocks accrual for legacy jobs                                                       | **Fixed** §4.3: reject only `pending` \| `flagged` \| `cancelled`; allow `approved` and `undefined`                               |
| **A-2**  | `payment_day_of_week` — DB says "starts Monday", TS said `0 = Sunday`                                           | **Added** A-2.1: single convention in DAP + period math; no mixed schemes                                                         |
| **A-3**  | §4.5 SQL referenced non-existent `worker_payment.event_type`                                                    | **Replaced** with join to `worker_payment_batch` and real statuses                                                                |
| **A-4**  | Duplicate check vs `completed` batch — is second batch ever valid?                                              | **Noted** in §4.5: product must define _adjustment_ path vs hard block; DAP must not assume "never again" without explicit rule   |
| **A-5**  | "Unpaid" sounds like Tally or the org is in default (legal/comms risk)                                          | **M-9** amended: clarify _record_ not _transfer_ (non-custodial, M-1 alignment)                                                   |
| **A-6**  | Skip **Approve** → call **Mark as Paid** on `calculated` — does API allow?                                      | **Verified** `update-worker-payment-status` does not require prior `approved` for batch path; **U-11** note + orphan batch caveat |
| **A-7**  | "Move to History" implied physical row move                                                                     | **U-20** clarified: same row, status update, tab metaphor                                                                         |
| **A-8**  | Wireframe **Mark All Paid** — mis-click pays many batches                                                       | Defer to DAP: confirm each batch **or** single confirmation listing all batch IDs; not in v1 wireframe as committed scope         |
| **A-9**  | Concurrent **Calculate** in two tabs, same job — double batch                                                   | **Application-layer** only: optimistic UI + refetch; optional server idempotency key in later DAP (Article 2 VERIFY)              |
| **A-10** | `list-worker-payments` returns `status` for **batch**; if client ever mixed line `paid` with batch `calculated` | G1 uses **batch** status for History rows; DAP: single source in mapper (`PaymentRecord.status` = batch)                          |
| **A-11** | DST, orphan batch, CSV drift                                                                                    | Retained for **S3** QA matrix (§10 Manual QA) — no doc contradiction                                                              |

**Gate:** Adversarial **pass** with amendments above; **S3 Phase A** may proceed.

---

**Next step:** S3 DAP for **Phase A** (G1 — History rename, remove Approve, badge mapping, **M-9**). Then Phase B (org cycle config + timezone exposure). **Do not** start Phase C accrual build without a separate locked S3.

_**Scope lock (this S2):** Phase A = IA rename + badges; Phase B = org period settings; Phase C = accrual engine design (separate S3); Phase D = Overview redesign. Non-custodial boundary unchanged._
