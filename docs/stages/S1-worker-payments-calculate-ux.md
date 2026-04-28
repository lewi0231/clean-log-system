# S1 — Triage: Calculate flow, pay periods, per-worker surface, and settlement artifacts

| Field                                    | Value                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**                                | S1 — Triage (feasibility, risk, strategic fit, phased scope)                                                                                                                                                                                                                                                                                                              |
| **From**                                 | Product / UX review after [S2 v1 handoff implementation](./S2-worker-payments-disbursement.md) (2026-04) — _Calculate → Preview_ emphasizes **jobs and line items**; **admins** think in **workers** and **pay periods**; v1 **batch** “Mark as Paid” and **per-batch CSV** do not yet match that mental model in the **pre-save** and **per-worker attestation** layers. |
| **Parent track**                         | [S0 — Disbursement / handoff](./S0-worker-payments-disbursement.md) → [S1 — Original disbursement triage](./S1-worker-payments-disbursement.md) → [S2 — F&F v1](./S2-worker-payments-disbursement.md) (implemented: messaging + per-worker **CSV** from saved **`worker_payment`** rows + operator doc).                                                                  |
| **Triaged**                              | 2026-04-28                                                                                                                                                                                                                                                                                                                                                                |
| **Product**                              | Tally Runner — **Worker Payments** (calculate dialog, job selection, history, exports)                                                                                                                                                                                                                                                                                    |
| **Gold review (calculate-ux S1)**        | **Completed** 2026-04-28 — see **§11**                                                                                                                                                                                                                                                                                                                                    |
| **Adversarial review (calculate-ux S1)** | **Completed** 2026-04-28 — see **§12**                                                                                                                                                                                                                                                                                                                                    |
| **Diamond**                              | _Optional_ second pass if **S2 calculate-ux** **§11–12** adds **new** build **risks**                                                                                                                                                                                                                                                                                     |
| **F&F (locked to)**                      | [S2 — Calculate & period UX (v1.1)](./S2-worker-payments-calculate-ux.md)                                                                                                                                                                                                                                                                                                 |

---

## 1. Recap: what v1 already does

- **Save payment** persists a **batch** and **`worker_payment`** line rows (per job×worker split or equal-split fallback) from `save-worker-payment`. **Source of truth for amounts** is those rows + stored calculation JSON — not a re-derive from `aggregateByWorker` (see S2 / S3).
- **Handoff v1** adds a **per-worker roll-up CSV** for a **saved** batch (Payment History **Download**), with **reconciliation** and **orphan-batch** protection.
- **“Mark as Paid”** in v1 is **batch-level** attestation (method / date / reference), with copy that Tally does **not** move money.
- **Gap:** The **Calculate** → **Preview** experience still presents **job** and **pricing line items** first; **per-worker amounts** (already in calculation payload as `worker_splits` where available) are **not** the primary table. **Job selection** is **per job**, not “**this fortnight**” in one action.

This S1 **does not** re-open **v1 handoff** scope; it **triages the next** slice so S2+ can lock **F&F** without mixing “CSV shipped” with “preview UX + periods + per-worker paid + tax docs.”

---

## 2. Problem / opportunity (submitter language)

1. **Individual breakdown in the flow:** The admin pays **people**, not “jobs” in the abstract. The UI should make **per-worker totals** (and, where useful, per-job under each worker) **obvious before Save** and in **Payment detail**, not only in the exported file after save.
2. **Pay periods:** Many orgs run **fortnightly or monthly** pay. Selecting jobs **one-by-one** for a large period is **tedious and error-prone**; a **date range and/or pay-period preset** plus **“select all jobs in range”** reduces friction and mismatches.
3. **Clarity of “Save payment”:** Operators need to see that save creates **per-worker line items in the database**, not an opaque blob. Short helper copy and a **per-worker summary block** can bridge that.
4. **Granularity of “paid”:** v1 is **one batch = one paid attestation**. Real life may need **per-worker** or **partial** settlement over time. That implies **new product rules** and possibly **schema** (worker-level status, amounts, dates).
5. **Detail in a modal:** A **per-worker** drill-down (hours, split mode, per-job lines) should be **one click** from preview or history — reusing the same structured data as CSV/handoff, not a second calculation path.
6. **Artifacts beyond CSV:** “**Remittance**” (proof-of-payment style PDF/CSV) and “**tax invoice**” are **attractive** but **legally and tax-weighted**; practice varies (employee vs subcontractor, who issues, GST, jurisdiction). This must be **separate gates** from “show the right numbers in the UI.”

---

## 3. S1 decision: strategic recommendation (gates)

| Gate                                                                                           | **Outcome (this triage)**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1 — Per-worker surface in Calculate + Payment detail (read-only, same math as today)**      | **GO** for **v1.1** F&F — high value, **low** new compliance surface if we only **display** `worker_splits` / roll-ups already returned by `calculate-worker-payment` and stored in `worker_payment`.                                                                                                                                                                                                                                                                                                                                 |
| **G2 — Pay period / range selection for jobs (filter + “select all in range”)**                | **GO** for **v1.1** — **UI + query/filter** on job list (e.g. `completed_at`); no mandatory backend pay-calendar entity in v1.1 unless product insists.                                                                                                                                                                                                                                                                                                                                                                               |
| **G3 — Per-worker “mark paid” / partial settlement**                                           | **RE-Triage** as **G3a** — **schema + workflow**; do **not** commit in the same F&F as G1+G2 without a **dedicated** S2 on **state machine** (batch vs worker vs line). **Default recommendation:** keep **batch** attestation for v1.1; add **per-worker** only after UX research or anchor customer.                                                                                                                                                                                                                                |
| **G4 — Per-worker remittance / payment-advice download (naming, PDF, one worker × one batch)** | **GO (narrow)** for **v1.2+** as **“payment summary / remittance advice (informational only)”** — not a bank file, **not** a tax invoice — with **dedicated** **F&F** / **operator** **copy** (a **future** **S2** slice or **operator** **doc** **amendment**), not _only_ the [handoff disbursement S2](./S2-worker-payments-disbursement.md).                                                                                                                                                                                      |
| **G5 — Tax invoice / official tax documents generated by Tally**                               | **DEFER (re-triage)** — **jurisdiction + legal + product** sign-off. **Not** unblocked by a **vague** “**G1**” **label**; requires **explicit** **re-triage** (see **[disbursement S1](./S1-worker-payments-disbursement.md)** on **custodial** / **v2+** **payouts**) **or** a **standalone** **legal** **gate**. **Stub:** _Subcontractor may issue their own invoice; Tally can show **amounts** for **reconciliation** only_ unless a **templated** output is **legally** **cleared** with **no** **implied** **tax** **advice**. |

**Rationale:** **Show the right numbers in the right place** (G1+G2) matches how admins work and reuses **existing** calculation persistence. **Money-movement and tax** outputs (G5) **multiply** **regulatory** and **wording** risk; they should not block **G1+G2**.

---

## 4. S1 product decisions (for the next S2 / F&F)

### 4.1 Calculate / Preview

| Topic                        | S1 choice                                                                                                                                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primary table in Preview** | Add a **“By worker”** section: **name**, **worker_id**, **total for this run**, **split_mode** (time-based / equal fallback / mixed), **hours** if present. Job-level line items may remain as **secondary** (expand) for “why is this number.” |
| **Order of sections**        | **Worker totals first** (or **tabs**: Workers \| Jobs) — _exact layout_ in S2.                                                                                                                                                                  |
| **Save helper copy**         | One line: e.g. _Saving creates a pay run with one stored line per worker per job (splits as calculated); you can download a per-worker handoff from Payment History after save._                                                                |
| **Payment detail dialog**    | **v1.1+** (S2 had this as [deferred U-4](../stages/S2-worker-payments-disbursement.md)): **per-worker** read-only table + link to same breakdown modal.                                                                                         |

### 4.2 Job selection and periods

| Topic                   | S1 choice                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP**                 | **Date range** filter on the job list (from–to) + **“Select all visible”** (or all in range). **Presets** optional: _This week / This fortnight / This month_ using **browser-local** **timezone** for **MVP** (same as **S1** **§9** **O-1**; **org**-level **IANA** **timezone** = **future** if settings gain a field). |
| **Data**                | Use **`job.completed_at`** (or agreed canonical field) — align with S2 **§5** on honest **dateRange** in batches (may still differ from “pay period” label until server derives range from job rows).                                                                                                                      |
| **Pay calendar entity** | **Not required** for v1.1; optional v1.2 if “Week ending Friday” is common.                                                                                                                                                                                                                                                |

### 4.3 Paid status and modals

| Topic     | S1 choice                                                                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v1.1**  | **Keep** **batch-level** “Mark as Paid” unless G3a is **approved** in a follow-on S1.                                                                       |
| **Modal** | **Worker detail modal**: **read-only** breakdown (amounts, jobs, split metadata); **no** new “mark paid per worker” in the same story unless G3a is **GO**. |

### 4.4 Downloads / artifacts

| Topic                          | S1 choice                                                                                                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Per-worker one-off PDF/CSV** | **Candidate for v1.2** — “**Worker payment summary**” for _one worker_ × _one batch_ (same numbers as handoff, smaller surface area than full batch CSV). **Disclaimer:** informational; not a payslip, not STP, not tax advice. |
| **Tax invoice**                | **Out of scope** until **G5** re-triage; product must **name** the document type with **legal** review.                                                                                                                          |

---

## 5. Phased delivery (proposal)

| Phase                                        | Scope                                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A — UX clarity (v1.1 candidate)**          | **G1** + **G2**: per-worker **preview**; **date range** + **select all in range**; **Payment detail** / **modal** for **per-worker** breakdown (read-only).                                                        |
| **B — Hardening**                            | **G4** narrow: single-worker **remittance / summary** download; **export metadata** / versioning line if not already (see [handoff S2 **§14**](./S2-worker-payments-disbursement.md#14-deferred-v11) **/ v1.1+**). |
| **C — Settlement granularity (re-triage)**   | **G3a**: per-worker or **partial** paid; **data model** + **UI**; **separate S2** + migration story.                                                                                                               |
| **D — Tax / official documents (re-triage)** | **G5** only after **legal** + **product** sign-off; **if** **coupled** to **payouts**, align with [disbursement S1](./S1-worker-payments-disbursement.md) **G1 (v2+)**.                                            |

---

## 6. Technical feasibility (initial)

| Area                  | Notes                                                                                                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preview data**      | `calculate-worker-payment` already returns **job_calculations** with **`worker_splits`** when present; equal-split path uses fallback — **same** rules as `save-worker-payment`. **UI** = projection only. |
| **List/filter jobs**  | Client-side filter on loaded jobs in MVP; **large orgs** may need **server** filter (existing jobs API) — S2 to **verify** **limits**.                                                                     |
| **Per-worker status** | **New** columns or child table if G3a — **not** in Phase A.                                                                                                                                                |
| **PDF**               | New dependency or print CSS — **F&F** choice in S2.                                                                                                                                                        |

**Gold to run before build:** Re-read [S1 worker payment split weights](./S1-worker-payment-split-weights.md) and [S2 §5](./S2-worker-payments-disbursement.md) so **display** does not imply **time-based** when **equal_split_fallback** (S2 **§8**).

---

## 7. Risk assessment

| Risk                                                    | Likelihood        | Impact                                 | Mitigation                                                                                                     |
| ------------------------------------------------------- | ----------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **User thinks “remittance” = bank accepted**            | Medium            | **Wrong** **payment** if misread       | **Name** **artifacts** _informational_; **link** to M-1 **boundary**; **no** ABA from Tally.                   |
| **Per-worker “paid”** **without** **schema** **design** | High if rushed    | **Data** **corruption** / **disputes** | **G3a** only with **S2** **state** **model**.                                                                  |
| **Tax invoice** **wording**                             | Low until shipped | **Legal** / **reputational**           | **G5** **DEFER** until sign-off.                                                                               |
| **Period select** **misses** **jobs**                   | Medium            | **Underpay** / **re-run**              | **Clear** **range** **label**; show **count** of jobs **selected**; **optional** “include jobs with status X”. |

---

## 8. Acceptance criteria

**Superseded by** [S2 — Calculate & period UX](./S2-worker-payments-calculate-ux.md) **§8 (NFR)** and **§9 (testing strategy)**. **At triage** level, the **intent** was:

1. **Preview** shows **per-worker** totals **consistent** with **Save** (within **float** / **reconciliation** rules — see **S2** **NFR**).
2. **Bulk** **select** for jobs in a **date** **range** (MVP: client filter + select all in range/visible).
3. **Read-only** **per-worker** **drill-down** from **History** / **Detail** using **batch** + **`worker_payment`**, not a **divergent** recalc.
4. **No** new **tax** / **payslip** / **compliance** **claims** **unless** **G5** is **re-triaged**.

---

## 9. Open items — **resolved (recommendations for S2)**

| #       | Open item                                                                                                        | **Recommendation**                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O-1** | **Timezone** for week / fortnight / month **presets**                                                            | **MVP:** Use the **user’s browser (local) timezone** for “start of day / end of day” when mapping presets to `Date` bounds and when comparing to `job.completed_at`. **Show** a short hint: e.g. _“Date filters use your current timezone.”_ **Later (if product adds `organization.timezone` to settings):** switch presets to org TZ without changing the job comparison contract (S2 documents migration). **Do not** block v1.1 on a new org setting.  |
| **O-2** | **Equal-split** **rows** — **disclaimer** / **tooltip** (handoff S2 **§8** / **D2**)                             | **Yes.** For any worker row (or job subsection) where the **allocation is equal-split fallback** (no `worker_splits` in that job’s calculation), show a **visual indicator** (badge _Equal split_ or _Estimated split_) and a **tooltip** in plain language: e.g. _“This job split the total equally across listed workers. For time-based splits, ensure workers and times are on the job before calculating.”_ **Do not** label those rows _time-based_. |
| **O-3** | **Link** to **operator** [worker-payments-handoff.md](../operator/worker-payments-handoff.md) from **Calculate** | **Add** a “**What happens when I save?**” or “**Handoff CSV**” line in `CalculatePaymentDialog` **ContextualHelp** (or a text link) pointing to the operator doc **and** the existing Worker Payments M-1 boundary. Makes operator guidance (outlined in [handoff S2 **§13**](./S2-worker-payments-disbursement.md)) discoverable at save time.                                                                                                            |
| **O-4** | **Mobile** / **narrow** **layout** for **per-worker** **table**                                                  | **Responsive pattern:** On **viewports &lt; `md`**, render **per-worker** summary as a **stacked list** (card per worker: name, amount, expand for detail). On **`md+`**, use a **table** with the same columns. **Preserve** read order (workers first) on all breakpoints. **Touch targets** ≥ 44px for row expand and modal triggers.                                                                                                                   |

These are **normative** in [S2 — Calculate & period UX](./S2-worker-payments-calculate-ux.md) **§6–7**.

---

## 10. References

### Internal

- [S0 — Worker payments (disbursement)](./S0-worker-payments-disbursement.md)
- [S1 — Original disbursement triage (v1 handoff GO)](./S1-worker-payments-disbursement.md)
- [S2 — F&F v1 (implemented scope)](./S2-worker-payments-disbursement.md)
- [S3 — DAP / contracts](./S3-worker-payments-disbursement.md)
- [S4 — Execution (handoff v1)](./S4-worker-payments-disbursement.md)
- [S1 — Worker payment split weights](./S1-worker-payment-split-weights.md)
- [S2 — Calculate & period UX (v1.1) — F&F](./S2-worker-payments-calculate-ux.md) **(this track’s build spec)**
- [Operator: Worker payments handoff](../operator/worker-payments-handoff.md)

### External (context only)

- (None required for S1; **G5** may reference **AU** **ATO** / **accounting** **bodies** **later**.)

---

## 11. Gold review (calculate-ux S1) — completed 2026-04-28

**Scope:** Internal consistency of this S1, alignment with **§9** vs **§4.2**, gate wording (G4/G5), and repo reality (`CalculatePaymentDialog`, `useJobs`).

| ID       | Finding                                                                                                                                                                     | Severity   | Action taken                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| **GX-1** | **§4.2** referenced **org** **timezone** for **presets** while **§9** **O-1** and [S2 calculate-ux](./S2-worker-payments-calculate-ux.md) specify **browser-local** **MVP** | **High**   | **§4.2** **updated**; **org** **IANA** **timezone** = **optional** **later**                                                |
| **GX-2** | **G4** “S2 **copy**” and **G5** “until **G1**” were **ambiguous** (which **S2**? which **G1**?)                                                                             | **Medium** | **G4**/**G5** **rows** **rewritten** (see [§3](#3-s1-decision-strategic-recommendation-gates))                              |
| **GX-3** | **Phase** **B** **pointer** to **handoff** **§14** was **vague**                                                                                                            | **Low**    | [§5](#5-phased-delivery-proposal) **now** **links** [handoff **§14**](./S2-worker-payments-disbursement.md#14-deferred-v11) |
| **GX-4** | **§8** **duplicated** acceptance **rows** that **S2** **calculate-ux** **now** **owns**                                                                                     | **Low**    | **§8** **redirects** to **S2**; **triage** **bullets** **kept**                                                             |
| **GX-5** | **`dashboard/components/worker-payments/calculate-payment-dialog.tsx`** and **`useJobs`** **exist**                                                                         | —          | **Confirms** **technical** **feasibility** **claims**                                                                       |

**Gate:** **Gold** **pass** for **this** **S1** **(first** **pass)**.

---

## 12. Adversarial review (calculate-ux S1) — completed 2026-04-28

| ID       | Attack / risk                                                                                                               | Outcome / amendment                                                                                                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AX-1** | **G1** **name** **collision** between **this** **track** and [disbursement S1](./S1-worker-payments-disbursement.md) **G1** | **Disambiguate** in **prose** (**“calculate-ux** **G1”** **vs** **“disbursement** **G1”**); **S2** [calculate-ux](./S2-worker-payments-calculate-ux.md) **§2** **notes** **UI** **feature** **numbering** |
| **AX-2** | **G4** **“remittance”** **implies** **bank**-**accepted** **file**                                                          | **G4** **narrow** **+** **S2** **§2** **boundary**; **remains** **informational** **document** **only**                                                                                                   |
| **AX-3** | **G5** **stub** **read** as **legal** / **tax** **advice**                                                                  | **G5** **DEFER**; **stub** **=** **reconciliation** **context** **only**                                                                                                                                  |
| **AX-4** | **Match** **preview** **to** **save** **without** **shared** **code**                                                       | **Escalated** to **S2** **NFR** **(pure** **helper** **+** **tests**)**; **S1\*\* **stays** **strategic** **GO** only                                                                                     |

---

**Next step (build):** [S2 — Calculate & period UX (v1.1)](./S2-worker-payments-calculate-ux.md) (F&F + **§11–12** **reviews**) → [S3](./S3-worker-payments-disbursement.md) _addendum_ or **new S3** if **API** contracts change → DAP / execution. **Handoff** [S2 disbursement](./S2-worker-payments-disbursement.md) remains the **source** for **CSV** / **reconciliation** unless **amended**.

_S1 triage: **GO** **Phase A**; **DEFER** **G5**; **G3a** and **G4** are **follow-on** **gates**._
