# S2 — Features & Functions: Calculate flow, pay periods & per-worker surface (v1.1)

| Field                                    | Value                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**                                | S2 — Features & Functions (scope lock before S3 DAP / HLP)                                                                                                                                                                                                                                                             |
| **From S1**                              | [`S1-worker-payments-calculate-ux.md`](./S1-worker-payments-calculate-ux.md) (2026-04-28)                                                                                                                                                                                                                              |
| **Parent product**                       | [S2 handoff v1 (disbursement)](./S2-worker-payments-disbursement.md) — **implemented**; **does not** change **CSV** / **reconciliation** contracts **unless** this file adds an explicit **amendment** (none in v1.1).                                                                                                 |
| **Created**                              | 2026-04-28                                                                                                                                                                                                                                                                                                             |
| **Updated**                              | 2026-04-27 (Gold **§12** + Adversarial **§13** + Pre-impl **§14**)                                                                                                                                                                                                                                                     |
| **Product**                              | Tally Runner — **Worker Payments** (calculate → preview → save; job selection; history / detail)                                                                                                                                                                                                                       |
| **Scope name**                           | **v1.1** “**Calculate UX**” = **calculate-ux S1** **G1** + **G2** (**per-worker preview**, **date range** + **bulk select**, **read-only** **per-worker** **detail** in **Payment detail** + **modal**). **(Not** the same as [disbursement S1 G1](./S1-worker-payments-disbursement.md) **(handoff** **v1** **GO).)** |
| **Gold review (calculate-ux S2)**        | **Completed** 2026-04-28 — see **§12**                                                                                                                                                                                                                                                                                 |
| **Adversarial review (calculate-ux S2)** | **Completed** 2026-04-28 — see **§13**                                                                                                                                                                                                                                                                                 |
| **Pre-impl review**                      | **Completed** 2026-04-27 — see **§14**                                                                                                                                                                                                                                                                                 |
| **S3 DAP**                               | [`S3-worker-payments-calculate-ux.md`](./S3-worker-payments-calculate-ux.md) (2026-04-27)                                                                                                                                                                                                                              |

---

## 1. S1 recap (locked for this delivery)

| S1 gate                                                                                               | v1.1 (this S2)                                  |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **G1** — Per-worker **surface** in **Calculate** + **Payment detail** (read-only, same math as today) | **In scope**                                    |
| **G2** — **Pay period** / **range** + **select all in range**                                         | **In scope**                                    |
| **G3a** — Per-worker **“mark paid”** / **partial** settlement                                         | **Out of scope** — separate S1/S2 when approved |
| **G4** — Per-worker **PDF** / “remittance” **summary** file                                           | **Out of scope** (Phase B; own S2 slice or DAP) |
| **G5** — **Tax invoice** / **official** **tax** **docs** from Tally                                   | **Out of scope** (DEFER)                        |

**Open items (S1 §9) — incorporated:** timezone approach (**browser local** for MVP; hint copy); **equal-split** **badge** + **tooltip**; **operator** **link** in **Calculate**; **responsive** **per-worker** **layout** — see **§6–7** below.

---

## 2. Product boundaries

| In scope (v1.1)                                                                                                                                                                                            | Out of scope (v1.1)                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Preview** **after** “**Preview** **calculation**” shows a **per-worker** **roll-up** (and optional expand to per-job under a worker) **sourced** from the **`calculate-worker-payment`** **response**    | **Re-calling** **calculate** on the **server** for **display-only** (avoid **divergent** **totals**); **no** second **truth** for money |
| **Job list** **filters** by **completion** **date** **range** + **presets** + **“Select all** **(visible** **/ in** **range)**”                                                                            | **Org**-wide **pay** **calendar** **entity** (no **“week** **ending** **Friday**” **engine** **required**)                              |
| **`PaymentDetailDialog`** (and/or **history**): **per-worker** **read-only** **table**; **“View** **breakdown**” **→** **modal** with **lines** **consistent** with **saved** **batch** **after** **save** | **Per-worker** **“Mark** **paid**” (batch-level **unchanged** per S1)                                                                   |
| **Copy** that **Save** **persists** **lines** **per** **worker** **×** **job** **(as** **today)** and **post-save** **handoff** **CSV** **from** **History**                                               | **ABA**, **payslip**, **STP**, **tax** **invoice**, **remittance** **as** **bank** **proof**                                            |
| **Accessibility**: **table** / **list** + **modals** **keyboard** **reachable**; **tooltips** for **split** **semantics**                                                                                  | **Worker** **mobile** **app** **pay** **view**                                                                                          |

**Relationship to [handoff S2 **§7**](./S2-worker-payments-disbursement.md#7-ui-features-v1):** The handoff spec **U-4** (_optional_ **PaymentDetailDialog** **per-worker** **table** **+** **download\*) is **fulfilled** for **v1.1** by **this\*\* **file’s** **U-3** (per-worker table + **Details** **modal**). **Handoff** **U-1…U-3** and **M-1…M-4** **remain** **unchanged**; **this** **doc** **does** **not** renumber them.

**Numbering (this S2 only):** **U-1**–**U-5** **below** are **v1.1** **“Calculate** **UX**” **features** — **do** **not** **merge** with **handoff** **S2** **U-1**–**U-4** **in** **issue** **trackers** **without** a **prefix** (e.g. `CX-1` for **Calculate** **UX**).

---

## 3. Personas & user stories

| ID                                                                   | Persona       | Story                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-6**                                                              | **Org admin** | Before I **Save**, I need to **see** **how** **much** **each** **worker** is **owed** in **this** **run** (not only line items), so I can **align** with **who** I **pay**.                                                                  |
| **F-7**                                                              | **Org admin** | I need to **select** **jobs** for a **date** **range** (e.g. **this** **fortnight**) and **select** **all** **matching** **jobs** **without** **clicking** **each** **one**.                                                                 |
| **F-8**                                                              | **Org admin** | After **save** (or from **History**), I need a **per-worker** **drill-down** (amounts, jobs, **split** **type**) that **matches** the **handoff** **CSV**, so I can **verify** before **marking** **the** **batch** **paid** **externally**. |
| **F-2** (extends [handoff S2](./S2-worker-payments-disbursement.md)) | **Org admin** | The **preview** should **reinforce** the **same** **worker** **totals** I will get **in** **the** **CSV** after **save** (within **float** / **reconciliation** **expectations**).                                                           |

**Non-stories (v1.1):** **Per-worker** **paid** **flags**; **PDF**; **email**; **worker's** **self-service** **download**.

---

## 4. Message & copy inventory (v1.1) — _exact strings in implementation PR_

| #       | Where                                                                                                            | Content intent                                                                                                                                                                                                                                                               |
| ------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M-5** | **Calculate** **dialog** — **ContextualHelp** (new or extended) + optional short line under **Save**             | **Clarify** that **Save** **creates** a **stored** **pay** **run** with **per-worker** **lines**; **link** to [operator: Worker payments handoff](../operator/worker-payments-handoff.md). **One** **line** may **restate** M-1: _Tally does not transfer money to workers._ |
| **M-6** | **Date** **filter** / **presets**                                                                                | **Hint** _“Dates use your current timezone”_ (or **equivalent** per S1 **O-1**).                                                                                                                                                                                             |
| **M-7** | **Equal-split** **badge** + **tooltip** (S1 **O-2** / [handoff S2 **§8**](./S2-worker-payments-disbursement.md)) | **Short** **badge**; **tooltip** **explains** **equal** **split** **vs** **time-based**; **no** false **“time** **based**” **label** on **fallback** **rows**.                                                                                                               |

_Final microcopy in implementation PR; **M-1**–**M-4** on the **page** and **mark-paid** **remain** **as** in **handoff** S2._

---

## 5. Data rules (facts for build)

| Fact                                   | Implication                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preview** (before **save**)          | **Data** = **`CalculateWorkerPaymentsResponse`**, **in-memory** from **`calculate-worker-payment`**. **Per-worker** **roll-up** = **sum** of **`worker_splits[].final_payment`** per **(job,** **worker)** from **`job_calculations`**, **or** **equal**-**split** **logic** **mirroring** `save-worker-payment` for jobs **without** `worker_splits` (split-weights S1/S2). **Implement** a **single** **pure** **helper** `buildWorkerPreviewRowsFromCalculation(calc: CalculateWorkerPaymentsResponse): WorkerPreviewRow[]` in **DAP**; **return** **shape** `WorkerPreviewRow { workerId: string; name: string; total: number; splitMode: string; hoursWorked: number; jobIds: string[] }`; **unit**-**test** **fixtures** **against** **expected** `worker_payment` **shapes** **where** **possible**.                                                                        |
| **After** **save**                     | **Detail** **modal** **uses** **`payment.payments`** (**`BatchWorkerPaymentRow`**) from **`list-worker-payments`**, **rolled** **up** with **`rollupByWorkerId`** in `dashboard/lib/worker-payments/export-batch-worker-csv.ts` (or **shared** **import**). **If** **nested** `payments` **missing**, **refetch** (same as **export**). **Do** **not** use **`aggregateByWorker`** for **payout** **amounts** (see [handoff S2 **D4**](./S2-worker-payments-disbursement.md)). **Display** **labels** for **split** **mode** should **align** with **persisted** **semantics** **`time_based`**, `equal_split_fallback`, **`calculated`**, **`mixed`** — **DAP** must **export** `splitModeFromRow` from `export-batch-worker-csv.ts` (currently **internal**) or **extract** to a **shared** **util** **—** not **hand**-**waving** “time-based” on **equal**-**split** **rows**. |
| **Reconciliation (preview** **check)** | **Post-save,** [handoff S2 **§6.3**](./S2-worker-payments-disbursement.md#63-reconciliation-must) / **`reconcileBatchTotal`** **already** **govern** **CSV** **download**. **v1.1** **DAP** **should** **assert** **in** **unit** **tests** that **preview** **per-worker** **rows** **sum** to **`calculation.calculation.total_worker_payment`** (same **numeric** **story** as **will** be **split** to **`worker_payment`** **—** if **divergent**, **fix** **helper** **before** **ship**). **Minor** **unit** **tolerance** **matches** **handoff** / **S3** **§2.2** **(not** **dollar**-**size** **slop**).                                                                                                                                                                                                                                                                |
| **Job** **date** for **filter**        | **`Job.completed_at`** (ISO) — **inclusive** **range** in **browser** **local** **timezone** (S1 **O-1**). **DST** **edges:** follow **one** **implementation** in **DAP**; **or** use **date-only** **string** **compare** in **org** **locale** if **jobs** **store** **UTC** and **UI** **shows** **local** **dates** **only**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **`dateRange` on** `PaymentRecord`     | **May** **still** **mirror** `calculated_at` per [handoff S2 **§5**](./S2-worker-payments-disbursement.md). **v1.1** **optional** **stretch:** _“Job completion window: {min} – {max}”_ from **selected** `jobIds` **+** **`jobs[]`** at **open** **detail** **time**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

---

## 6. UI features (v1.1) — _normative screen list_

| #       | Area                                                    | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **U-1** | `CalculatePaymentDialog` (or equivalent)                | **After** “**Preview** **calculation**,” **default** **tab** or **section** = **“By** **worker**” **first**; **“By** **job** / **line** **items**” **second** (collapsible or second tab). **Columns** (worker): name, id (secondary), **total** **for** **this** **run**, **split** **mode** **summary**, **hours** (if any), **actions** “**View** **lines**” **→** **inline** **expand** or **small** **modal** **(preview** **source** **=** **calc** **only**).                                                                                   |
| **U-2** | **Job** **picker** **(same** **dialog** **/** **flow**) | **Controls:** **from** / **to** **date** **(optional;** when **set,** **filter** **list**); **presets** **This** **week** / **This** **fortnight** / **This** **month** (definitions in **§6.1**); **Select** **all** **in** **range** (only **enabled** when **from/to** set **or** **preset** **active**). **Show** **count** _N_ **jobs** **selected** / **M** **visible** **(filtered)**. **M-6** **hint** for **TZ**.                                                                                                                             |
| **U-3** | `PaymentDetailDialog`                                   | **Add** **per-worker** **summary** **table** (read-only) + **per-row** or **per-worker** open **“Details”** **→** **modal** **with** **job** **lines** and **amounts** **(post-save** **data**). **Re-use** **components** with **U-1** where **props** differ **(preview** **vs** **saved**). **DAP:** extend `PaymentDetailDialogProps` to accept `payments?: BatchWorkerPaymentRow[]` and `currency?: string` from `PaymentRecord` (the **local** **type** in current file **omits** **these**; **align** with `list-worker-payments` **payload**). |
| **U-4** | **Equal-split** (S1 O-2)                                | On **any** **row** **(worker** or **job** **subsection)** **driven** by **equal**-**split** **path**, show **badge** + **M-7** **tooltip**.                                                                                                                                                                                                                                                                                                                                                                                                            |
| **U-5** | **Contextual** **link** (S1 O-3)                        | **M-5** **help** **block** **with** **link** to **operator** **handoff** + **M-1** **boundary**.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

**Accessibility (§2):** **Modal** **focus** **trap**; **table** has **`caption`** or **aria** **labels**; **badge** not **sole** **indicator** (tooltip/visible text for **split** **type**).

### 6.1 Preset definitions (browser local date)

| Preset             | Definition (informative)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **This week**      | **Default (recommended):** **Start** = **00:00** **local** on the **Monday** of the **ISO** **week** **(Monday**-**as**-**first** **day** **of** **week)** that **contains** **“today”**; **end** = **end** of **today** **local** **(inclusive)**. **(E.g.** **on** **Sunday,** the **window** is **the** **Monday** **six** **days** **earlier** **through** **Sunday.)** **Implement** **via** **one** **library** **or** **helper** **in** **DAP** to **avoid** **off-by-one** **across** **locales** **(test** **Sun** + **Mon**). |
| **This fortnight** | **Default (recommended):** **rolling** **14** **calendar** **days** **inclusive** **ending** **end** of **today** **(local** **browser** **time)**—**start** = **today** **minus** **13** **days** at **start** of **day** **local**. **(E.g.** on **Wed Apr 15**, range is **Apr 2 – Apr 15**.) **Revisit** a **true** pay-period **anchor** only if org **timezone** / payroll **calendar** is added later.                                                                                                                           |
| **This month**     | **Default (recommended):** **first** **day** of **current** **month** **00:00** **local** through **end** of **today** **(inclusive).**                                                                                                                                                                                                                                                                                                                                                                                                 |

**PRESERVE:** **Manual** **checkbox** **selection** **without** **dates** **unchanged**; **date** **filter** **narrows** **list** **only** **(does** **not** **auto**-**change** **org** **data**).

### 6.2 Responsive (S1 O-4)

- **Narrow** **viewport** **(below** **Tailwind** **`md` if** **used**): **per-worker** **block** **as** **stacked** **cards**; **primary** **amount** + **name**; **chevron** to **expand** **detail**.
- **Wide:** **Data** **table** **with** **same** **fields** **(see** U-1**)**.

---

## 7. Degraded & edge behavior

| Condition                                                                                         | Product behavior                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Calculation** **returns** **no** `worker_splits` **(equal** **split** **on** **a** **job**)\*\* | **Show** U-4 **badge**; **totals** **still** **sum** to **job** **totals** **/ batch** (same **as** **save**).                                                                                                                                                                                                                                                                                                                                 |
| **Preview** **vs** **saved** **row** **count**                                                    | **Before** **save,** only **show** what **calc** **returned**; **after** **refetch,** use **`payments`**. If **mismatch** **(rare)**, show **“Refresh”** or **toasts** **(same** **class** **as** **export** **handoff**).                                                                                                                                                                                                                     |
| **Stale** **preview**                                                                             | If **the** **user** **changes** **job** **selection** (or **date** **filter**) **after** a **successful** **Preview** **without** **running** **Preview** **again**, **either** **clear** **the** **preview** **or** show a **non-blocking** **warning:** _“Selection changed — run Preview again before Save.”_ **PRESERVE** **no** **silent** **mismatch** **between** **on-screen** **totals** **and** **what** **Save** **will** **send**. |
| **Double** **Save** / **double** **click**                                                        | **DAP** may **disable** **Save** **while** **request** **in** **flight**; **idempotency** of **`save-worker-payment`** **is** **server-owned** **—** **do** **not** **assume** **two** **batches** **if** **the** **user** **retries** **(document** **actual** **edge** **function** **behaviour** **in** **S3-calculate-ux** **(to be created)** **if** **needed**).                                                                         |
| **Many** **jobs** **(100+)** in **org**                                                           | **MVP** **client**-**side** **filter** on **jobs** **returned** by **`useJobs`** **(see** `dashboard/hooks/use-jobs.ts` **—** **confirm** **limits** / **includeTests** in **DAP**). If **the** **hook** does **not** **return** **all** **jobs,** show **“Showing** **N** **loaded** **jobs**”** or **add\*\* **S3** **server**-**side** **date** **query**.                                                                                  |
| **Equal** **split** **+** **zero** **workers** on **job**                                         | **Unchanged** from **edge** **functions**; **UI** may **empty**-**state** **a** **job** **section**.                                                                                                                                                                                                                                                                                                                                           |

---

## 8. Non-functional requirements

| NFR             | Target                                                                                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Correctness** | **Preview** **worker** **totals** **=** **what** `save-worker-payment` **will** **materialize** **(within** **known** **float** **/** **reconciliation** **—** if **in** **doubt,** **add** **unit** **test** on **fixture** **JSON**). |
| **PII**         | **Same** as **handoff** S2: **no** new **PII** **fields**; **names** **visible** in **UI** **(already** **true** **for** **jobs**). **Do** **not** **log** full **calculation** **payload** in **prod**.                                |
| **Performance** | **O(jobs** **+** **workers**)** for **roll-up\*\* **on** **preview**; **no** **N+1** **new** **network** **calls** **for** **modal** **(use** **loaded** **batch**).                                                                    |

---

## 9. Testing strategy

| Layer                      | Cases                                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit**                   | **Pure** **helper** **from** **calc** **JSON** **→** **per-worker** **totals** (with **/ without** `worker_splits`); **date** **filter** on **job** list **(fixtures)**.                  |
| **Component**              | **Calculate** **dialog:** **presets** **change** **selection**; **worker** **table** **visible** after **mock** **calc**; **equal-split** **badge** **present** on **mock** **fallback**. |
| **Integration** (optional) | **Save** **→** **open** **detail** **→** **modal** **totals** **match** **CSV** **handoff** **for** **same** **batch** (or **e2e** when **ready**).                                       |

---

## 10. Out of scope (explicit **defer** list)

- **G3a** per-worker / partial **paid** — [S1](./S1-worker-payments-calculate-ux.md) **G3a**.
- **G4** per-worker **download** **PDF** / **“remittance”** **file** — own **DAP** (may **reuse** **CSV** **strings**).
- **G5** **tax** **invoice** / **tax** **document** **generation** — **legal** **+** S1.
- **Org** `timezone` **setting** — **future**; **MVP** uses **S1** **O-1** (browser + hint).
- **Second** **CSV** **(by-job** **only)** for **from** **Calculate** **—** **not** **required** **for** v1.1; **remains** in [handoff S2 **§6.4**](./S2-worker-payments-disbursement.md) **optional**.

---

## 11. References

### Internal

- [S1 — Calculate UX triage](./S1-worker-payments-calculate-ux.md) (resolved **O-1**–**O-4**)
- [S2 — Handoff v1 (disbursement)](./S2-worker-payments-disbursement.md) — **CSV,** **reconciliation,** M-1–M-4, **operator** **§13**
- [S1 — Split weights](./S1-worker-payment-split-weights.md) / [S2 — Split weights](./S2-worker-payment-split-weights.md) if **present**
- [S3 — Disbursement DAP](./S3-worker-payments-disbursement.md) — **edge** function **semantics** **not** **changed** **here** **unless** **amendment** **(none** for **v1.1**)
- [Operator: Worker payments handoff](../operator/worker-payments-handoff.md)
- `dashboard/components/worker-payments/calculate-payment-dialog.tsx` (path **may** **vary**)
- `dashboard/components/worker-payments/payment-detail-dialog.tsx`
- `database/supabase/functions/save-worker-payment`, `calculate-worker-payment`, `list-worker-payments`
- `dashboard/lib/worker-payments/export-batch-worker-csv.ts` (**rollup** **reference** for **post-save**)

### External (context)

- (None **required** for **v1.1**).

---

## 12. Gold review (calculate-ux S2) — completed 2026-04-28

**Scope:** **This** **S2** vs **repo** (`rollupByWorkerId`, `splitModeFromRow`, `CalculatePaymentDialog`, `useJobs`), **handoff** S2 **§5** / **§6.3**, **S1** **calculate-ux** **§9**, and **internal** **U-** **numbering**.

| ID        | Finding                                                                                                                                                               | Severity   | Action taken                                                                                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G2X-1** | **Handoff** **S2** **U-4** **vs** **this** **doc’s** **U-4** **(different** **meaning)** **—** **reader** **confusion**                                               | **High**   | **§2** **relationship** **+** **numbering** **note** **(prefix** **/** **disambiguation**); **this** **U-4** = **equal-split** **badge** **only** |
| **G2X-2** | **`split_mode` labels** in **UI** must **match** **`export-batch-worker-csv` / `splitModeFromRow`** (do **not** invent **ad-hoc** strings for **post-save** **rows**) | **Medium** | **§5** **Data** **rules,** “**After** **save**” **row**                                                                                           |
| **G2X-3** | **“This** **week”** **wording** **(Sun/Mon** **edge)** **ambiguous**                                                                                                  | **Medium** | **§6.1** **This** **week** **—** **ISO** **week** **containing** **today**                                                                        |
| **G2X-4** | **Preview** **totals** **vs** **save** **—** **needed** **explicit** **reconciliation** **/** **test** **hook**                                                       | **Medium** | **§5** **Reconciliation** **row** **+** **§8** **NFR**                                                                                            |
| **G2X-5** | **Wrong** **link** **to** **S3** **in** **draft** **reconciliation** **row** **(removed** **during** **edit**)\*\*                                                    | **High**   | **Replaced** **with** **handoff** **§6.3** **+** **`reconcileBatchTotal`** **reference**                                                          |
| **G2X-6** | **`payment-detail-dialog.tsx`** / **`calculate-payment-dialog.tsx`** **paths** **valid**                                                                              | —          | **Confirmed** **in** **repo**                                                                                                                     |

**Gate:** **Gold** **pass** **(first** **pass)** **—** **ready** **for** **S3** **/ DAP** **unless** **jobs** **API** **limits** **invalidate** **§7** **(verify** **in** **DAP** **spike**).

---

## 13. Adversarial review (calculate-ux S2) — completed 2026-04-28

| ID        | Attack / risk                                                                                                   | Outcome / amendment                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **A2X-1** | **User** **trusts** **preview** **after** **changing** **jobs** **without** **re-preview**                      | **§7** **Stale** **preview** **row** **—** **clear** **or** **warn**                                       |
| **A2X-2** | **Two** **batches** **from** **double** **submit**                                                              | **§7** **Double** **Save**; **UI** **disable** **+** **S3** **server** **truth**                           |
| **A2X-3** | **Equal-split** **tooltip** **still** **read** as **“payroll** **approved”**                                    | **M-7** **+** **handoff** **M-1** **link** **(U-5**)**;** **no** **new** **compliance** **claim**          |
| **A2X-4** | **100+** **jobs** **—** **client** **filter** **hides** **reality**                                             | **§7** **Many** **jobs** **—** **disclose** **N** **loaded** / **S3** **query**                            |
| **A2X-5** | **Screen** **reader** **only** **hears** **“U-1”** **in** **tickets** **and** **confuses** **with** **handoff** | **§2** **naming** + **use** **CX-** or **“Calc-UX-1”** **in** **issues** **(recommendation** **only**)\*\* |

---

**Next step (DAP / build):** Create **S3-worker-payments-calculate-ux.md** (distinct from existing `S3-worker-payments-disbursement.md`): **(1)** **pure** **preview** **helper** `buildWorkerPreviewRowsFromCalculation` + **tests,** **(2)** **dialog** **UI,** **(3)** **date** **filter,** **(4)** **detail** **+** **modal** with **type** **extension,** **(5)** **export** `splitModeFromRow`, **(6)** **copy,** **(7)** **manual** **QA** **matrix** (incl. **stale** **preview**, **week** **boundary**).

_**Scope lock (this S2):** v1.1 = **per-worker** **first** in **preview**, **job** **period** **UX**, **read-only** **per-worker** **in** **detail** + **modal**; **no** **per-worker** **paid**; **no** **tax** **docs**; **no** **new** **payment** **rails**._

---

## 14. Pre-implementation review — completed 2026-04-27

**Scope:** Verify codebase alignment, section numbering, type contracts, and cross-references prior to S3/DAP.

| ID      | Finding                                                                                                         | Severity   | Action taken                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| **R-1** | **Section numbering collision** — two `## 11` headings (References + Gold review)                               | **High**   | Renumbered: References **§11**, Gold **§12**, Adversarial **§13**, this review **§14**; header updated |
| **R-2** | **`splitModeFromRow` not exported** from `export-batch-worker-csv.ts` — §5 references it but DAP cannot import  | **High**   | Added explicit DAP instruction in §5 "After save" row                                                  |
| **R-3** | **`PaymentDetailDialog` local type** missing `payments` and `currency` — U-3 assumes these exist                | **Medium** | Added type extension note to U-3                                                                       |
| **R-4** | **`buildWorkerPreviewRowsFromCalculation` return shape undefined** — §5 says "implement helper" but no contract | **Medium** | Added explicit `WorkerPreviewRow` interface spec to §5 "Preview" row                                   |
| **R-5** | **Forward reference to S3** ambiguous (existing `S3-disbursement` vs future `S3-calculate-ux`)                  | **Low**    | Clarified in §7 "Double Save" and "Next step" that S3-calculate-ux is to be created                    |
| **R-6** | **"This fortnight" definition** — "rolling 14 days" may confuse AU users expecting fixed pay-period             | **Low**    | Added example "(E.g. on Wed Apr 15, range is Apr 2 – Apr 15)" to §6.1                                  |

**Gate:** Pre-implementation **pass** — document ready for S3 / DAP creation.

---

## Appendix: Terminology

| Term                 | Meaning here                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preview**          | In-memory result of **Calculate** before **Save**.                                                                                                                |
| **Per-worker total** | Sum over all selected jobs in the run of that worker’s **allocated** **amounts** (splits or equal fallback), **same** **definition** as **persistence** will use. |
| **Preset**           | **Shortcut** to **set** **date** **filter** (browser **local** **TZ** for **MVP**).                                                                               |
