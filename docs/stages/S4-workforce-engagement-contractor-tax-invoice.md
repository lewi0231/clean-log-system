# S4 — Detailed Action Plan: Workforce engagement + contractor tax invoices

| Field                       | Value                                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**                   | S4 — Detailed Action Plan (execution-ready; S5 build)                                                                                                       |
| **From**                    | Product direction (session 2026-07-17): engagement gating + mobile contractor tax invoices                                                                  |
| **S3 HLP**                  | Skipped — scope locked in this DAP (same pattern as email-domain onboarding DAP)                                                                            |
| **Created**                 | 2026-07-17                                                                                                                                                  |
| **Updated**                 | 2026-07-17 — Gold (§9) + **Adversarial (§10)**                                                                                                              |
| **Gold review (S4)**        | **Completed** 2026-07-17 — see **§9**                                                                                                                       |
| **Adversarial review (S4)** | **Completed** 2026-07-17 — see **§10**                                                                                                                      |
| **Product**                 | Tally Runner                                                                                                                                                |
| **Stakeholder locks**       | (1) No elaborate backfill — local reset OK; migration **DEFAULT**s only. (2) Feature name: **tax invoice** (worker → org). (3) Build **Phase A + Phase B**. |

**Normative locks:** If prose conflicts with **§2 / §4.0**, those sections win. Adversarial locks in **§10.2** amend Gold where noted.

**Scope lock**

| In scope                                                            | Out of scope                                         |
| ------------------------------------------------------------------- | ---------------------------------------------------- |
| Org `workforce_engagement` + worker `engagement_type`               | Multi-org workers / nested subcontractor roll-up     |
| Onboarding + Settings + worker create/invite/update                 | ABA / STP / super / bank payout (disbursement track) |
| New `worker_tax_invoice` (+ lines); mobile submit; dashboard review | Reusing customer `invoice` / `invoice_job`           |
| Gate tax-invoice UI by engagement (§2.3)                            | Claiming ATO “valid tax invoice” legal compliance    |
| Approve → optional link to mark-paid attestation                    | Changing `calculate-worker-payment` **math**         |
| Shared gate helper (+ Deno re-export)                               | Require tax invoice before mark-paid (deferred)      |
| **B0 spike:** calc-engine reuse path                                | Auto-creating payment batches on approve             |

**Verify discipline:** Run listed **verify** after each step group before merging. **One PR per phase** (A then B). Phase B starts with **B0 spike** before schema UI sprawl.

**Prior doc tension:** [`S0-worker-payments-liability-tightening.md`](./S0-worker-payments-liability-tightening.md) and calculate-UX **G5 defer** advised against employee/contractor classification UI and tax-invoice claims. **This DAP supersedes that for product gating only**, with mandatory §2.4 copy. Remittance advice ≠ tax invoice.

---

## 0. Prerequisites

| #   | Prerequisite                                                                                                                                           | Verify                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| P0  | Read **§1–§2**, **§4.0**, **§9**, **§10**                                                                                                              | N/A                                                      |
| P1  | Local Supabase + dashboard + mobile runnable; OK to reset local DB                                                                                     | `supabase status`                                        |
| P2  | Smoke: customer invoicing + worker payment calculate/save on base branch                                                                               | Manual                                                   |
| P3  | `public.generate_invoice_number(org_id)` exists — contractor numbers use a **sibling** RPC                                                             | schema / migrations                                      |
| P4  | Mobile worker via **`list-workers`** + `auth_user_id` (`use-current-worker.ts`)                                                                        | Read hook                                                |
| P5  | Know Deno shares code via **`_utils/*` re-export** of `shared/utils/*` (e.g. `invoice-line-item-display.ts`) — not npm `@clean-log/shared` inside Edge | Read `_utils/invoice-line-item-display.ts`               |
| P6  | Jobs use **`approval_status`**: `approved` \| `pending` \| `flagged` \| `cancelled` (+ colleague `confirmation_status`)                                | `20260214100000_job_colleague_confirmation_workflow.sql` |

---

## 1. PRESERVE (Article 1)

| ID        | Must remain true after ship                                                                                                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PR-1**  | Customer **`invoice` / `invoice_job` / auto-send / Stripe / bank-on-invoice** unused by contractor flow.                                                                                                                                     |
| **PR-2**  | **`calculate-worker-payment` math** unchanged. Tax-invoice draft/submit uses the **same engine** (extract/re-export); no forked pricing.                                                                                                     |
| **PR-3**  | **Mark as paid** = attestation only. Approving a tax invoice does **not** move money or auto-mark paid.                                                                                                                                      |
| **PR-4**  | Job logging / colleague confirmations available to **all** workers regardless of engagement.                                                                                                                                                 |
| **PR-5**  | Org GST settings mean **org → customer** only.                                                                                                                                                                                               |
| **PR-6**  | DEFAULT engagement = **`employees`** / worker **`employee`**.                                                                                                                                                                                |
| **PR-7**  | Checklist **`payment`** = Stripe / customer payments.                                                                                                                                                                                        |
| **PR-8**  | Remittance PDF/email remains for employee-style settlement.                                                                                                                                                                                  |
| **PR-9**  | **Double bookkeeping risk:** org may still calculate + mark-paid **and** approve a tax invoice for overlapping jobs. v1 does **not** hard-block that. UI must not imply they are the same ledger. (Hard link / mutual exclusion = deferred.) |
| **PR-10** | **`list-workers`** today returns **all active workers** to any org member (including mobile). Do not expand PII on that payload for this feature; engagement_type is OK; do not add bank details.                                            |

---

## 2. Product model (locked)

### 2.1 Org setting — `workforce_engagement`

| Value         | Meaning                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `employees`   | Org calculate → remittance / mark paid. **No** worker tax-invoice **submit** UI. Admin historical TI view still allowed if rows exist. |
| `contractors` | Tax-invoice features **on** for all workers (gate ignores per-worker type).                                                            |
| `both`        | Submit UI only when `worker.engagement_type = 'contractor'`.                                                                           |

**Column:** `organization_settings.workforce_engagement TEXT NOT NULL DEFAULT 'employees'`  
**CHECK:** `IN ('employees', 'contractors', 'both')`

**Upsert:** `get`/`update`/`complete-onboarding` must upsert `organization_settings` if missing.

### 2.2 Worker field — `engagement_type`

| Value        | Meaning                                          |
| ------------ | ------------------------------------------------ |
| `employee`   | Cannot submit when org is `employees` or `both`. |
| `contractor` | May submit when org is `contractors` or `both`.  |

**Column:** `worker.engagement_type TEXT NOT NULL DEFAULT 'employee'`  
**CHECK:** `IN ('employee', 'contractor')`

**Defaults on create**

| Org engagement | Worker default                                |
| -------------- | --------------------------------------------- |
| `employees`    | `employee` (selector hidden or read-only)     |
| `contractors`  | `contractor`                                  |
| `both`         | **Required** explicit choice on create/invite |

**Note:** `create-worker` already inserts the worker row before invite accept — set `engagement_type` at **create**, not at accept.

### 2.3 Gate (single helper)

```ts
canSubmitTaxInvoice(orgEngagement, workerEngagement): boolean {
  if (orgEngagement === 'employees') return false;
  if (orgEngagement === 'contractors') return true;
  return workerEngagement === 'contractor'; // both
}
```

**Admin queue visibility (≠ submit gate):**

```ts
canAdminSeeTaxInvoiceQueue(orgEngagement): boolean {
  return orgEngagement === 'contractors' || orgEngagement === 'both';
  // Also true if org has any historical worker_tax_invoice rows when flipped to employees (optional stretch);
  // v1: hide create/submit; allow read-only history if count > 0 OR always show read-only when rows exist.
}
```

**v1 lock (Adversarial A14):** Admin **Tax invoices** tab visible when `canAdminSeeTaxInvoiceQueue` **OR** org has ≥1 `worker_tax_invoice` row (so flip → `employees` does not strand admins). Submit controls remain gated by `canSubmitTaxInvoice`.

**Shared code pattern (Adversarial A1):**

1. Canonical: `shared/utils/workforce-engagement.ts` (+ unit tests in shared or dashboard).
2. Deno: `database/supabase/functions/_utils/workforce-engagement.ts` **re-exports** shared (same pattern as `invoice-line-item-display.ts`).
3. Dashboard/mobile import from `@clean-log/shared` / shared path used elsewhere.

### 2.4 Copy (mandatory — Settings + onboarding + PDF footer)

> This setting controls how worker settlement works in Tally Runner. It does not determine employment status for tax, superannuation, or Fair Work purposes. Seek your own advice.

PDF additional line: documents generated here are a **workflow aid**, not a guarantee of ATO tax-invoice validity.

### 2.5 Settings / worker flip policy

| Change                           | Behaviour                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Org → `employees`                | No new submits. Do not delete rows. Admin history per **§2.3**. Pending `submitted` still reviewable. |
| Org → `contractors`              | Gate opens for all workers; no bulk-update of `engagement_type`.                                      |
| Org → `both`                     | Existing workers stay `employee` until edited — Settings helper text required.                        |
| Worker `contractor` → `employee` | That worker loses submit immediately; their `submitted` TIs remain reviewable.                        |
| Worker `employee` → `contractor` | Submit allowed if org gate passes.                                                                    |

### 2.6 ABN gate

Submit requires `worker.abn` non-empty. Draft allowed without ABN; submit → **400**.

### 2.7 Job eligibility for draft/submit (Adversarial A3 — locked)

A job may appear on a tax invoice **only if all** of:

1. `job.organization_id` = worker’s org
2. Row in `job_worker` for this `worker_id`
3. `job.approval_status = 'approved'` (not `pending`, `flagged`, or `cancelled`)
4. This worker’s `job_worker.confirmation_status` ≠ `'flagged'`
5. Not already on an **active** TI line for this `(worker_id, job_id)` (statuses: `draft` \| `submitted` \| `approved` \| `paid`)
6. Request contains ≤ **100** `job_ids` (hard cap; **400** if over)

Zero-amount lines after calc: **allow** in draft but **block submit** if `total <= 0` (**400**).

### 2.8 Draft lifecycle (Adversarial A7)

| Actor         | Allowed                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Owning worker | Create draft, edit job set (re-calc), cancel own `draft`, submit own `draft`                     |
| Owning worker | **Cannot** cancel/reject `submitted` (admin only)                                                |
| Admin         | Review submit; approve/reject; cancel per status machine; mark TI paid; PDF                      |
| Viewer role   | **Read-only** list/detail if they can open Worker payments; **no** approve/reject/paid (**403**) |

**Amount freshness (Adversarial A4):** Draft stores provisional calc. **Submit re-runs** the calculate engine for the draft’s job set, writes **`calculation_snapshot`**, and persists final totals. If re-calc fails eligibility (e.g. job no longer approved), **400** with message — do not submit stale draft quietly.

**Invoice number (Adversarial A8):** Assign **`invoice_number` only on submit** (not on draft) to avoid burning sequence numbers.

---

## 3. Phase A — Foundation (engagement flags)

**Complexity:** MEDIUM  
**Goal:** Ask, store, edit engagement; shared helper + Deno re-export; **no** tax-invoice screens.

### 3.1 Database

| Step | ID        | Action                                                                   | File(s)                                           | Verify                    |
| ---- | --------- | ------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------- |
| A1   | **DA-A1** | Migration: columns + CHECKs + DEFAULTs + comments. No backfill `UPDATE`. | `.../YYYYMMDDHHMMSS_add_workforce_engagement.sql` | `supabase db reset` clean |
| A2   | **DA-A2** | Sync `database/schema.sql` if project habit.                             | `database/schema.sql`                             | Diff matches              |

### 3.2 Shared helper + settings API

| Step | ID         | Action                                                                                                     | File(s)                                                      | Verify                    |
| ---- | ---------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------- |
| A3   | **DA-A3**  | `canSubmitTaxInvoice`, `canAdminSeeTaxInvoiceQueue`, enums; unit tests (org×worker matrix + admin helper). | `shared/utils/workforce-engagement.ts` + tests               | Test pass                 |
| A3b  | **DA-A3b** | Deno re-export `_utils/workforce-engagement.ts`.                                                           | `database/supabase/functions/_utils/workforce-engagement.ts` | Deno test or import smoke |
| A4   | **DA-A4**  | `get-organization-settings`: return `workforce_engagement`.                                                | `get-organization-settings/index.ts`                         | Invoke get                |
| A5   | **DA-A5**  | `update-organization-settings`: validate + **upsert**.                                                     | `update-organization-settings/index.ts`                      | No prior row works        |
| A6   | **DA-A6**  | Dashboard types.                                                                                           | `dashboard/lib/types.ts`, `api.ts`                           | `tsc --noEmit`            |

### 3.3 Onboarding + Settings UI

| Step | ID        | Action                                                                              | File(s)                                              | Verify     |
| ---- | --------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------- |
| A7   | **DA-A7** | Require `workforce_engagement` when workers exist; §2.4 disclaimer.                 | `onboarding-wizard.tsx`, `CompleteOnboardingRequest` | Validation |
| A8   | **DA-A8** | `complete-onboarding` upserts setting; mirror JSON; no workers → write `employees`. | `complete-onboarding/index.ts`                       | DB check   |
| A9   | **DA-A9** | Payments tab control + flip helper text (§2.5).                                     | settings card / page                                 | Persist    |

### 3.4 Workers + mobile type

| Step | ID         | Action                                                                                                                                                                                                                 | File(s)                                                                  | Verify                       |
| ---- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------- |
| A10  | **DA-A10** | `create-worker` defaults / require when `both`.                                                                                                                                                                        | `create-worker/index.ts`                                                 | API cases                    |
| A11  | **DA-A11** | `update-worker` allows type change (admin only — preserve existing authz).                                                                                                                                             | `update-worker/index.ts`                                                 | Non-admin unchanged          |
| A12  | **DA-A12** | Users UI selector when `both`.                                                                                                                                                                                         | `users/page.tsx`, service, types                                         | Manual                       |
| A13  | **DA-A13** | `list-workers` / `get-worker` return `engagement_type`; mobile type (**no** PIN).                                                                                                                                      | edges, `mobile-app/types/worker.ts`                                      | Typecheck                    |
| A14  | **DA-A14** | **D9 lock:** extend **`get-organization-id`** JSON with `workforce_engagement` (read from settings, default `employees`). Safe for workers — single field, not full settings. Update mobile org bootstrap to store it. | `get-organization-id/index.ts`, mobile `useOrganization` (or equivalent) | Mobile logs / UI reads field |

**Phase A exit gate:** Engagement end-to-end; helper + re-export tested; mobile can read org engagement via **get-organization-id**; no TI UI; smoke customer invoice + calculate.

**Rollback:** Revert migration + commits.

---

## 4. Phase B — Contractor tax invoices

**Complexity:** HIGH  
**Dependencies:** Phase A merged  
**Naming:** **Tax invoice** (worker → organisation)

### 4.0 Locked design decisions

| #   | Decision                 | Lock                                                                                                                                                                                         |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Persistence              | New `worker_tax_invoice` + `worker_tax_invoice_line`. Never `public.invoice`.                                                                                                                |
| D2  | Amount source            | Shared calculate engine for selected jobs × worker. **Submit re-calcs** and freezes snapshot (§2.8). No prior batch required. No second pricing impl.                                        |
| D3  | Line identity            | Active uniqueness on `(worker_id, job_id)` (§2.7).                                                                                                                                           |
| D4  | Terminal statuses        | `cancelled`, `rejected` free the pair; active = `draft`\|`submitted`\|`approved`\|`paid`.                                                                                                    |
| D5  | Numbering                | `generate_worker_tax_invoice_number(org_id)` sibling RPC; assign **on submit only**.                                                                                                         |
| D6  | Status machine           | §4.1.                                                                                                                                                                                        |
| D7  | Approve ≠ paid           | Explicit TI paid status only in v1; optional mark-paid CTA is separate.                                                                                                                      |
| D8  | Mobile entry             | Settings → Tax invoices stack; show iff `canSubmitTaxInvoice`.                                                                                                                               |
| D9  | Org engagement on mobile | **Locked path:** `get-organization-id` returns `workforce_engagement` (Phase A **A14**).                                                                                                     |
| D10 | Eligibility              | §2.7.                                                                                                                                                                                        |
| D11 | Uniqueness enforcement   | **v1:** enforce inside Edge **transaction** (select conflicting lines → 409; then insert). Add supporting indexes. Defer exotic Postgres exclusion constraints unless spike shows clean win. |
| D12 | Double ledger            | **PR-9** — warn in admin UI; no hard mutex in v1.                                                                                                                                            |

### 4.1 Data model + status machine

```text
draft ──submit──► submitted ──approve──► approved ──mark TI paid──► paid
   │                  │                      │
   └─cancel► cancelled └──reject──► rejected └──cancel──► cancelled
```

Worker may **cancel** only from `draft`. Admin may **reject** from `submitted`. Admin may **cancel** `draft`/`submitted`/`approved` (not `paid` without explicit reverse — **v1: paid is terminal**; no unpay TI).

| Table                     | Purpose                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `worker_tax_invoice`      | Header fields; `calculation_snapshot` on/after submit; `invoice_number` null while draft |
| `worker_tax_invoice_line` | `job_id`, amounts, optional `worker_payment_id` null in v1                               |

| Step | ID        | Action                                                                                                                                                                                            | File(s)          | Verify                                        |
| ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------- |
| B0   | **DA-B0** | **Spike (≤0.5–1 day):** import/call `calculateWorkerPayment` (or extract) from a throwaway Edge/script for 1 worker + N jobs. Record approach in PR. **Stop** if blocked — escalate before B1 UI. | spike notes / PR | Engine returns amounts without HTTP self-call |
| B1   | **DA-B1** | Migration tables/indexes/CHECKS; `invoice_number` nullable on draft.                                                                                                                              | migration        | `db reset`                                    |
| B2   | **DA-B2** | Number RPC + grants.                                                                                                                                                                              | migration        | Concurrent submit unique                      |

### 4.2 Edge functions

| Step | ID         | Action                                                                                                 | File(s)                            | Verify          |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------- | --------------- |
| B3   | **DA-B3**  | `draft-worker-tax-invoice` — gate; eligibility §2.7; calc; draft+lines; 409 on conflict; max 100 jobs. | `draft-worker-tax-invoice/`        | Cases           |
| B4   | **DA-B4**  | `submit-worker-tax-invoice` — re-calc; ABN; number; snapshot; draft→submitted.                         | `submit-worker-tax-invoice/`       | Stale job → 400 |
| B5   | **DA-B5**  | `list-worker-tax-invoices` — worker own; admin/viewer org-wide read.                                   | `list-worker-tax-invoices/`        | IDOR            |
| B6   | **DA-B6**  | `get-worker-tax-invoice`                                                                               | `get-worker-tax-invoice/`          | Authz           |
| B7   | **DA-B7**  | `review-worker-tax-invoice` — **admin only** approve/reject.                                           | `review-worker-tax-invoice/`       | Viewer 403      |
| B8   | **DA-B8**  | Status updates: cancel, mark TI paid (admin); worker cancel draft only.                                | fold or thin edge                  | Transitions     |
| B9   | **DA-B9**  | PDF generate.                                                                                          | `generate-worker-tax-invoice-pdf/` | Opens           |
| B10  | **DA-B10** | `config.toml`, inventory, contracts, `api.ts`.                                                         | those files                        | Types           |

### 4.3 Dashboard UI

| Step | ID         | Action                                                                                           | File(s)            | Verify                                          |
| ---- | ---------- | ------------------------------------------------------------------------------------------------ | ------------------ | ----------------------------------------------- |
| B11  | **DA-B11** | Worker payments sub-tab “Tax invoices”; queue; detail; actions by role.                          | `worker-payments/` | Manual                                          |
| B12  | **DA-B12** | Optional “Record payment…” after approve; copy that remittance/mark-paid is separate (**PR-9**). | mark-paid          | Skip OK                                         |
| B13  | **DA-B13** | Tab visibility per **§2.3 admin helper** (not submit gate).                                      | same               | `both` shows queue; `employees` + history rules |

### 4.4 Mobile UI

| Step | ID         | Action                                                                     | File(s)          | Verify               |
| ---- | ---------- | -------------------------------------------------------------------------- | ---------------- | -------------------- |
| B14  | **DA-B14** | Settings → Tax invoices; job picker filtered by §2.7.                      | settings + stack | Hidden for employees |
| B15  | **DA-B15** | Gate from worker.engagement_type + org field from **get-organization-id**. | hooks            | `both` matrix        |

### 4.5 PDF honesty

| Step | ID         | Action                                                                              | Verify |
| ---- | ---------- | ----------------------------------------------------------------------------------- | ------ |
| B16  | **DA-B16** | Tax Invoice title; worker + org ABNs; lines; total; nullable GST; disclaimers §2.4. | Visual |
| B17  | **DA-B17** | No “ATO validated” copy.                                                            | Grep   |

**Phase B exit gate:** Draft→submit→approve→PDF; eligibility + IDOR + viewer 403; employees-only submit hidden; customer invoicing untouched; B0 spike documented.

---

## 5. Build order

```text
1. A1–A3b   DB + shared helper + Deno re-export
2. A4–A6    Settings API + types
3. A7–A9    Onboarding + Settings UI
4. A10–A14  Workers + get-organization-id engagement field
   --- Phase A merge ---
5. B0       Calc-engine spike (gate for rest of B)
6. B1–B2    Schema + number RPC
7. B3–B10   Edges
8. B11–B13  Dashboard
9. B14–B17  Mobile + PDF
```

---

## 6. Test plan (acceptance)

### Phase A

- [ ] Onboarding persists `workforce_engagement`
- [ ] Settings upsert when no row
- [ ] `both` create without type → 400
- [ ] `contractors` create → `contractor`
- [ ] Helper unit tests (submit gate + admin queue helper)
- [ ] Mobile receives `workforce_engagement` from `get-organization-id`
- [ ] Job submit + customer invoice smoke

### Phase B

- [ ] B0 spike merged or linked before feature PR
- [ ] Pending/flagged/cancelled jobs excluded from picker and draft
- [ ] Flagged `job_worker` excluded for that worker
- [ ] > 100 jobs → 400
- [ ] total ≤ 0 → cannot submit
- [ ] Duplicate active (worker, job) → 409
- [ ] Submit re-calcs; job flipped to flagged between draft and submit → 400
- [ ] Number null on draft; set on submit
- [ ] Worker cannot cancel `submitted`
- [ ] Viewer cannot approve
- [ ] IDOR list/get
- [ ] Approve ≠ mark-paid
- [ ] Admin tab visible for `both` even if admin is not a contractor worker
- [ ] Flip to `employees`: no submit; history accessible per §2.3
- [ ] Customer invoice still possible for same job
- [ ] PDF disclaimers present

---

## 7. Deferred (not in v1)

| Item                                                     | Note                       |
| -------------------------------------------------------- | -------------------------- |
| Worker GST registration + breakdown                      | Follow-up                  |
| Email on submit                                          | After core                 |
| Require TI before mark-paid / hard mutex with remittance | Policy later               |
| DB exclusion constraint for uniqueness                   | If txn checks insufficient |
| Insurance certificates                                   | Separate                   |
| Multi-principal                                          | Out                        |
| Auto-create `worker_payment` on approve                  | Out                        |
| Unpay / reverse `paid` TI                                | Out                        |

---

## 8. Approval status

| Decision                                             | Status                   |
| ---------------------------------------------------- | ------------------------ |
| Defaults / no backfill                               | **Locked**               |
| Name: tax invoice                                    | **Locked**               |
| Phase A + B                                          | **Locked**               |
| Separate tables                                      | **Locked** (D1)          |
| Calc engine at draft; **re-calc on submit**          | **Locked** (D2 + A4)     |
| `get-organization-id` carries `workforce_engagement` | **Locked** (D9 / A14)    |
| Job eligibility §2.7                                 | **Locked** (A3)          |
| Admin queue ≠ submit gate                            | **Locked** (A14 / §2.3)  |
| Soft double-ledger (PR-9)                            | **Locked** accepted risk |

**Ready for S5 Phase A.** Phase B blocked on **B0 spike** success.

---

## 9. Gold review (2026-07-17)

### 9.1 Method

Senior pass against codebase facts, S4 executability, and week-2 failure modes.

### 9.2 Findings → resolutions

| ID  | Finding                                   | Severity | Resolution                                |
| --- | ----------------------------------------- | -------- | ----------------------------------------- |
| G1  | Payment-line-only vs mobile job invoicing | Critical | D2 calc engine                            |
| G2  | Job vs job×worker uniqueness              | High     | D3                                        |
| G3  | Org flip mid-flight                       | High     | §2.5                                      |
| G4  | Gate triplication                         | High     | Shared helper                             |
| G5  | Missing settings row                      | Medium   | Upsert                                    |
| G6  | Mobile org engagement                     | High     | D9 (refined in §10 → get-organization-id) |
| G7  | Optional checklist                        | Low      | Removed                                   |
| G8  | Shared invoice numbers                    | Medium   | D5                                        |
| G9  | Paid vs mark-paid                         | High     | D7                                        |
| G10 | ABN                                       | Medium   | §2.6                                      |
| G11 | GST ambiguity                             | Medium   | Nullable gst                              |
| G12 | Open confirms                             | Low      | §8                                        |
| G13 | Liability docs                            | Info     | Supersede + disclaimer                    |
| G14 | IDOR                                      | Medium   | §6                                        |

### 9.3 Residual risks (Gold)

| Risk                       | Mitigation                        |
| -------------------------- | --------------------------------- |
| Rate change draft→submit   | Re-calc on submit (§2.8 / Adv A4) |
| Partial unique in Postgres | D11 txn + indexes                 |
| Legal title “Tax Invoice”  | Disclaimers                       |
| Calc extract size          | **B0 spike**                      |

### 9.4 Gold verdict

**PASS with locks.** Phase A ready; Phase B high risk on D2/D9 — addressed further in §10.

---

## 10. Adversarial review (2026-07-17)

### 10.1 Method

Hostile reviewer stance: contradict locks, find authz holes, race conditions, IA bugs, “implementer will guess wrong,” and conflicts with real schema (`approval_status`, Deno shared import pattern, `list-workers` breadth, `get-organization-id` payload).

### 10.2 Attacks → outcomes

| ID      | Attack / gap                                                                                                            | Severity     | Outcome / doc change                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------ |
| **A1**  | “Put helper in `@clean-log/shared` and use from Deno” — Edge does **not** import package name; uses `_utils` re-exports | **High**     | **§2.3** + **A3b** re-export pattern locked                              |
| **A2**  | D9 left “or extend get-organization-id **or** narrowed settings” — implementer forks                                    | **High**     | **D9/A14 locked:** only `get-organization-id`                            |
| **A3**  | No job eligibility — workers invoice `pending`/`flagged` jobs                                                           | **Critical** | **§2.7** locked to `approval_status=approved`, not flagged participation |
| **A4**  | Snapshot only on submit but draft never refreshed → silent under/over claim                                             | **High**     | **Submit re-calcs**; stale → 400                                         |
| **A5**  | B13 used `canSubmitTaxInvoice` for **admin** tab → `both` org with employee-only admin account hides queue              | **Critical** | Separate **`canAdminSeeTaxInvoiceQueue`** + history exception            |
| **A6**  | Unbounded `job_ids` → calc DoS                                                                                          | **High**     | Cap **100**                                                              |
| **A7**  | Worker cancels `submitted` / viewer approves                                                                            | **High**     | **§2.8** actor matrix; viewer 403 on review                              |
| **A8**  | Number on draft burns sequence when drafts abandoned                                                                    | **Medium**   | Number **on submit only**                                                |
| **A9**  | Double pay: remittance mark-paid + TI approve for same jobs                                                             | **High**     | **PR-9** accepted; admin copy; hard mutex deferred                       |
| **A10** | Concurrent drafts same jobs — race on uniqueness                                                                        | **High**     | **D11** transactional check; 409                                         |
| **A11** | `paid` TI reversed / unclear terminal                                                                                   | **Medium**   | `paid` terminal in v1; no unpay                                          |
| **A12** | Zero-total submit                                                                                                       | **Medium**   | Block submit if `total <= 0`                                             |
| **A13** | Calc extract underestimated — Phase B starts with UI and stalls                                                         | **High**     | Mandatory **B0 spike** before B1+                                        |
| **A14** | Worker type flip mid `submitted`                                                                                        | **Medium**   | §2.5 worker flip row                                                     |
| **A15** | `list-workers` already leaks full roster to mobile — feature must not worsen                                            | **Medium**   | **PR-10**                                                                |
| **A16** | Status machine allowed cancel from `approved` but not specified who                                                     | **Low**      | Clarified admin-only; worker draft-only cancel                           |
| **A17** | “Optional stretch” history when flipped to employees was waffle                                                         | **Medium**   | v1 rule: show tab if queue helper **OR** any TI rows exist               |

### 10.3 Adversarial verdict

**PASS after amendments above.** Remaining accepted risks: **PR-9** double ledger, legal naming, calc spike failure (escalation gate).

**Do not start Phase B UI until B0 proves engine reuse.** Phase A may proceed immediately.

---

**Next:** S5 Phase A (engagement). After A merge → **B0 spike** → rest of Phase B.
