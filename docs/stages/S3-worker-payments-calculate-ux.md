# S3 — Detailed Action Plan (DAP): Calculate UX v1.1 (per-worker preview, date filters, detail modal)

| Field       | Value                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**   | S3 — Detailed Action Plan (execute in order; checkboxes for tracking)                                                                                               |
| **From S2** | [`S2-worker-payments-calculate-ux.md`](./S2-worker-payments-calculate-ux.md)                                                                                        |
| **Parent**  | [S3 handoff v1 (disbursement)](./S3-worker-payments-disbursement.md) — **implemented**; this DAP **extends** UI; **does not** change CSV / reconciliation contracts |
| **Created** | 2026-04-27                                                                                                                                                          |
| **Updated** | 2026-04-27                                                                                                                                                          |
| **Product** | Tally Runner (dashboard, Worker Payments — Calculate flow + Payment detail)                                                                                         |

---

## 1. Scope lock (v1.1)

Deliver everything in S2 **§2 (In scope)**, **§4 (messages M-5–M-7)**, **§5 (data rules)**, and **§6 (UI U-1–U-5)**:

- **U-1**: Per-worker roll-up in `CalculatePaymentDialog` preview (default view before "By job")
- **U-2**: Date filter + presets (This week / This fortnight / This month) + "Select all in range"
- **U-3**: Per-worker summary table in `PaymentDetailDialog` + "Details" modal with job lines
- **U-4**: Equal-split badge + M-7 tooltip on fallback rows
- **U-5**: Contextual help link (M-5) in Calculate dialog

**Do NOT implement:** G3a (per-worker "mark paid"), G4 (per-worker PDF), G5 (tax invoice), org timezone setting, second by-job-only CSV from Calculate.

**PRESERVE:** Existing job-level breakdown view (make it secondary tab/section, not removed); manual checkbox selection without date filters; reconciliation contracts from handoff S3.

---

## 2. Locked contracts (do not improvise)

### 2.1 Types: `WorkerPreviewRow` (preview before save)

New interface in `dashboard/lib/worker-payments/` (or adjacent):

```typescript
export interface WorkerPreviewRow {
  workerId: string;
  name: string; // Resolved from job.workers or calculation data
  total: number; // Sum of allocations for this worker across selected jobs
  splitMode: string; // 'time_based' | 'equal_split_fallback' | 'calculated' | 'mixed'
  hoursWorked: number; // Sum of hours from worker_splits; 0 if equal-split
  jobIds: string[]; // Jobs this worker appears in for this preview
}
```

### 2.2 Types: Extend `PaymentDetailDialogProps`

Current `payment-detail-dialog.tsx` has a **local** `PaymentRecord` interface. Extend props to accept:

```typescript
interface PaymentDetailDialogProps {
  // ... existing
  payments?: BatchWorkerPaymentRow[]; // From PaymentRecord.payments (list-worker-payments)
  currency?: string; // From PaymentRecord.currency
}
```

### 2.3 Export `splitModeFromRow`

Currently internal in `export-batch-worker-csv.ts` (line 72). **Export** it:

```typescript
export function splitModeFromRow(calculationDetails: unknown): string {
  // existing logic
}
```

Consumers: U-1 preview display, U-3 detail display, CSV export (existing).

### 2.4 Date presets (browser local timezone)

| Preset             | Logic                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **This week**      | Start = Monday 00:00 local of ISO week containing today; End = end of today local. Use `date-fns` `startOfISOWeek` or equivalent. |
| **This fortnight** | Start = today minus 13 days at 00:00 local; End = end of today local. Rolling window, not pay-period anchor.                      |
| **This month**     | Start = first day of current month 00:00 local; End = end of today local.                                                         |

Implementation: Single helper `getDatePresetRange(preset: 'week' | 'fortnight' | 'month'): { from: Date; to: Date }` in a new file `dashboard/lib/worker-payments/date-presets.ts` or inline in dialog.

### 2.5 Preview reconciliation check (unit test)

Preview per-worker rows **must** sum to `calculation.total_worker_payment` within minor-unit tolerance (same as handoff S3 §2.2). Unit test fixture with sample calculation JSON to catch divergence before ship.

---

## 3. Task sequence (dependency order)

### Task A — Pure helper: `buildWorkerPreviewRowsFromCalculation`

| Step | Action                                                                                                                                                                                                                                                                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1   | Create `dashboard/lib/worker-payments/build-worker-preview.ts`.                                                                                                                                                                                                                                                                                          |
| A2   | Implement `buildWorkerPreviewRowsFromCalculation(calc: CalculateWorkerPaymentsResponse, jobs: Job[]): WorkerPreviewRow[]`. Logic: iterate `job_calculations`; if `worker_splits` present, use `worker_splits[].final_payment` per worker; else equal-split `total_worker_payment / workers.length` for each worker on that job. Aggregate by `workerId`. |
| A3   | Resolve `name` from `job.workers` (first match by `worker_id`) or `worker_splits[].worker_name` if available. Fallback to `workerId` if no name found.                                                                                                                                                                                                   |
| A4   | Compute `splitMode`: if all rows for a worker are `time_based` → `time_based`; if all `equal_split_fallback` → `equal_split_fallback`; if mixed → `mixed`.                                                                                                                                                                                               |
| A5   | Sum `hoursWorked` from `worker_splits[].hours_worked` where available; 0 for equal-split rows.                                                                                                                                                                                                                                                           |
| A6   | Unit tests in `dashboard/__tests__/lib/worker-payments/build-worker-preview.test.ts`: fixture with `worker_splits`, fixture without (equal-split), mixed, single worker multiple jobs, multiple workers same job, name resolution fallback.                                                                                                              |
| A7   | Add reconciliation assertion: `sum(rows.map(r => r.total))` must equal `calc.calculation.total_worker_payment` within tolerance (fail test if not).                                                                                                                                                                                                      |

**Done when:** `npm test` passes for new test file; types compile.

---

### Task B — Export `splitModeFromRow` + shared util

| Step | Action                                                                                                                                                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1   | In `dashboard/lib/worker-payments/export-batch-worker-csv.ts`, change `function splitModeFromRow` to `export function splitModeFromRow`.                   |
| B2   | Verify existing callers within the file still work (`rollupByWorkerId`).                                                                                   |
| B3   | Import in `build-worker-preview.ts` if needed for post-save display consistency, or duplicate logic for preview-only path (document which pattern chosen). |

**Done when:** `splitModeFromRow` is exported; no TS errors.

---

### Task C — Date preset helper + UI controls

| Step | Action                                                                                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------- | ------ |
| C1   | Create `dashboard/lib/worker-payments/date-presets.ts` with `getDatePresetRange` and `type DatePreset = 'week'                                                                                          | 'fortnight'          | 'month'`.                        |
| C2   | Unit tests: `date-presets.test.ts` — test each preset at various "today" values (Monday, Sunday, mid-month, DST edge if time permits). Use `vi.useFakeTimers` or `date-fns/set`.                        |
| C3   | In `calculate-payment-dialog.tsx`, add state: `dateFrom: Date                                                                                                                                           | null`, `dateTo: Date | null`, `activePreset: DatePreset | null`. |
| C4   | Add UI controls above job list: **From** date picker, **To** date picker, preset buttons (This week / This fortnight / This month). Use existing `DatePicker` or `Popover` + `Calendar` from shadcn/ui. |
| C5   | When a preset is clicked: set `dateFrom`/`dateTo` from `getDatePresetRange`, set `activePreset`. When manual date changed: clear `activePreset`.                                                        |
| C6   | Filter `jobsWithWorkers` by `completed_at` within `[dateFrom, dateTo]` (inclusive). Show count: "{N} jobs in range / {M} selected".                                                                     |
| C7   | Add **"Select all in range"** button (enabled when `dateFrom` && `dateTo`): sets `selectedJobIds` to all visible filtered jobs. Clears preview (stale preview rule).                                    |
| C8   | Add M-6 hint text below date controls: _"Dates use your current timezone"_.                                                                                                                             |

**Done when:** Date filter narrows job list; presets work; select-all-in-range works; manual selection still works when no dates set.

---

### Task D — Per-worker view in `CalculatePaymentDialog` (U-1)

| Step | Action                                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1   | After preview is loaded, compute `workerPreviewRows` using `buildWorkerPreviewRowsFromCalculation(preview, jobs)`.                                               |
| D2   | Add tabs or collapsible sections: **"By Worker"** (default, first) and **"By Job"** (existing breakdown). Use `Tabs` from shadcn/ui or simple toggle state.      |
| D3   | **By Worker tab**: Render table/list with columns: Name, ID (secondary/muted), Total (formatted), Split Mode (badge), Hours (if > 0), Actions ("View lines").    |
| D4   | "View lines" action: inline expand or small modal showing the jobs for that worker with per-job amounts. Source = preview calculation only (not post-save data). |
| D5   | If all rows for a worker have `splitMode === 'equal_split_fallback'`, show U-4 badge next to split mode.                                                         |
| D6   | Responsive: on narrow viewport, render as stacked cards per S2 §6.2.                                                                                             |

**Done when:** Preview shows per-worker table first; By Job view is accessible; equal-split badge visible on fallback rows.

---

### Task E — Equal-split badge + tooltip (U-4)

| Step | Action                                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1   | Create a small component `EqualSplitBadge` (or inline) with `Badge` + `Tooltip` from shadcn/ui.                                                         |
| E2   | Badge text: "Equal split" (short). Tooltip (M-7): _"This amount was split equally among workers. No time-based allocation was available for this job."_ |
| E3   | Use in U-1 per-worker rows and U-3 detail modal rows where `splitMode` includes `equal_split_fallback`.                                                 |
| E4   | Ensure badge is not sole indicator: visible text or aria-label accompanies it.                                                                          |

**Done when:** Badge + tooltip visible on equal-split rows in preview and detail.

---

### Task F — `PaymentDetailDialog` per-worker table (U-3)

| Step | Action                                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1   | Extend `PaymentDetailDialogProps` to accept `payments?: BatchWorkerPaymentRow[]` and `currency?: string`.                                                                 |
| F2   | In parent (`payment-history-list.tsx` or equivalent), pass `payment.payments` and `payment.currency` to the dialog. If `payments` missing, refetch or show loading state. |
| F3   | Add a **"By Worker"** section/tab in the dialog (similar to U-1 structure). Use `rollupByWorkerId` from `export-batch-worker-csv.ts` to aggregate.                        |
| F4   | For each worker row, add "Details" button → opens modal with job-level breakdown (job name/date, amount, split mode). Re-use table component from D3/D4 if feasible.      |
| F5   | Match display labels to `splitModeFromRow` semantics (no ad-hoc strings).                                                                                                 |
| F6   | Keep existing "By Job" breakdown as secondary view.                                                                                                                       |

**Done when:** PaymentDetailDialog shows per-worker summary; Details modal shows job breakdown; data matches CSV export.

---

### Task G — Contextual help link in Calculate dialog (U-5)

| Step | Action                                                                                                                                                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1   | In `calculate-payment-dialog.tsx`, add a `ContextualHelp` block or info alert near the Save button.                                                                                                                               |
| G2   | Content (M-5): _"Save creates a stored pay run with per-worker line items. [Learn more about worker payments →](../operator/worker-payments-handoff.md)"_ + one line restating M-1: _"Tally does not transfer money to workers."_ |
| G3   | Link opens in new tab or uses existing help pattern from the codebase.                                                                                                                                                            |

**Done when:** Help block visible in Calculate dialog; link works.

---

### Task H — Stale preview handling (S2 §7)

| Step | Action                                                                                                                                                                                                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1   | When job selection changes (toggle, select-all, date filter change) **after** a preview has been fetched, either: (a) clear the preview and require re-click of "Preview Calculation", or (b) show a warning banner: _"Selection changed — run Preview again before Save."_ |
| H2   | Disable Save button if selection changed after preview.                                                                                                                                                                                                                     |
| H3   | Current code already clears preview on toggle (line 83-84); verify this extends to date filter changes.                                                                                                                                                                     |

**Done when:** No silent mismatch between on-screen preview and what Save will send.

---

### Task I — Tests + CI

| Step | Action                                                                                                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1   | `build-worker-preview.test.ts` (Task A6).                                                                                                                                         |
| I2   | `date-presets.test.ts` (Task C2).                                                                                                                                                 |
| I3   | Update `calculate-payment-dialog.test.tsx` (if exists) or create: mock calculation, verify per-worker table renders, preset buttons change date state, equal-split badge visible. |
| I4   | Update `payment-detail-dialog.test.tsx` (if exists) or create: verify per-worker section renders when `payments` prop provided.                                                   |
| I5   | Run `npm test` in `dashboard/` — all tests green.                                                                                                                                 |
| I6   | Run `npm run typecheck` — no TS errors.                                                                                                                                           |

**Done when:** CI green; new components have test coverage.

---

## 4. Rollback plan

- **Code revert:** Revert Tasks A–H together if critical bug. Date filter and per-worker view are additive; removing them leaves existing job-level view intact.
- **Feature flag (optional):** `NEXT_PUBLIC_ENABLE_WORKER_PREVIEW_V11` to hide per-worker tab and date controls if needed post-deploy.

---

## 5. Manual QA matrix (release)

| #   | Scenario                                           | Expected                                                                          |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | **Preview with time-based splits**                 | Per-worker table shows totals, hours, "time_based" split mode. Sum matches total. |
| 2   | **Preview with equal-split (no worker_splits)**    | Per-worker table shows equal amounts, "equal_split_fallback" badge + tooltip.     |
| 3   | **Mixed batch (some jobs time-based, some equal)** | Workers with mixed jobs show "mixed" split mode.                                  |
| 4   | **Date filter: This week preset**                  | Jobs outside current week hidden; "Select all in range" selects visible only.     |
| 5   | **Date filter: This fortnight preset**             | Rolling 14-day window correct; e.g., on Wed Apr 15, range Apr 2–15.               |
| 6   | **Date filter: This month preset**                 | Jobs from month start through today.                                              |
| 7   | **Manual date range**                              | Custom from/to filters job list correctly.                                        |
| 8   | **Stale preview warning**                          | Change selection after preview → warning or preview cleared; Save disabled.       |
| 9   | **PaymentDetailDialog per-worker**                 | After save, open detail → per-worker table visible; "Details" modal shows jobs.   |
| 10  | **Equal-split badge in detail**                    | Detail modal shows badge on equal-split rows.                                     |
| 11  | **Contextual help link**                           | M-5 visible in Calculate dialog; link opens operator doc.                         |
| 12  | **Responsive: narrow viewport**                    | Per-worker list renders as cards, not table.                                      |
| 13  | **Week boundary (Sun/Mon)**                        | "This week" preset on Sunday includes Mon-Sun; on Monday includes Mon-Sun.        |

---

## 6. Post-implementation PR checklist (copy to PR)

- [ ] Pure helper `buildWorkerPreviewRowsFromCalculation` + unit tests (**Task A**)
- [ ] `splitModeFromRow` exported (**Task B**)
- [ ] Date preset helper + unit tests (**Task C**)
- [ ] Per-worker view in CalculatePaymentDialog (**Task D**)
- [ ] Equal-split badge + tooltip (**Task E**)
- [ ] PaymentDetailDialog per-worker table + Details modal (**Task F**)
- [ ] Contextual help link M-5 (**Task G**)
- [ ] Stale preview handling (**Task H**)
- [ ] All tests pass (**Task I**)
- [ ] Manual QA **§5** done
- [ ] S2 header updated to "Implemented" after ship

---

## 7. References (build)

- [`S0-worker-payments-disbursement.md`](./S0-worker-payments-disbursement.md)
- [`S1-worker-payments-calculate-ux.md`](./S1-worker-payments-calculate-ux.md)
- [`S2-worker-payments-calculate-ux.md`](./S2-worker-payments-calculate-ux.md) — product spec, UI features §6, data rules §5
- [`S3-worker-payments-disbursement.md`](./S3-worker-payments-disbursement.md) — handoff v1 contracts (reconciliation, CSV, types)
- `dashboard/components/worker-payments/calculate-payment-dialog.tsx`
- `dashboard/components/worker-payments/payment-detail-dialog.tsx`
- `dashboard/lib/worker-payments/export-batch-worker-csv.ts` — `rollupByWorkerId`, `splitModeFromRow`
- `dashboard/lib/services/worker-payment.service.ts` — `CalculateWorkerPaymentsResponse`
- `dashboard/hooks/use-jobs.ts`

---

## 8. Adversarial checklist (build)

| ID      | Risk                                                      | Mitigation                                                                       |
| ------- | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **X-1** | Preview total diverges from what Save will persist        | Task A7 reconciliation assertion in unit test.                                   |
| **X-2** | User trusts stale preview after selection change          | Task H: clear or warn; disable Save.                                             |
| **X-3** | Equal-split badge read as "payroll approved"              | M-7 tooltip clarifies; M-1 link in U-5.                                          |
| **X-4** | Date preset off-by-one on week boundaries                 | Task C2 unit tests for Sun + Mon; use ISO week.                                  |
| **X-5** | 100+ jobs not all returned by `useJobs`                   | S2 §7 edge case: show "Showing N loaded jobs" or escalate to server-side filter. |
| **X-6** | `splitModeFromRow` diverges between preview and post-save | Task B: single export; both paths import same function.                          |

---

**After v1.1 ships:** Update S2 header to "Implemented"; treat S1 §10 (Deferred) as backlog for G3a/G4/G5/org timezone.
