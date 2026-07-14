# S0 — Idea Intake: Worker payments liability tightening (copy, UX, and product boundaries)

| Field        | Value                                                                                                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Stage**    | S0 — Idea capture (not triage; no build commitment)                                                                                                                                                                                              |
| **Captured** | 2026-07-02                                                                                                                                                                                                                                       |
| **Product**  | Tally Runner (dashboard — Worker Payments, onboarding, remittance flows)                                                                                                                                                                         |
| **Source**   | Product owner — reduce legal/expectation risk on worker payments; align in-app behaviour with “calculate + export, pay elsewhere”                                                                                                                |
| **Related**  | [`S0-worker-payments-disbursement.md`](./S0-worker-payments-disbursement.md), [`S2-worker-payments-disbursement.md`](./S2-worker-payments-disbursement.md), [`docs/operator/worker-payments-handoff.md`](../operator/worker-payments-handoff.md) |
| **AU check** | Verified 2026-07-02 against Fair Work Ombudsman and ATO public guidance; see **§4.3**                                                                                                                                                            |

---

## 1. Idea (submitter language)

Worker payments in Tally Runner should stay **non-custodial**: the app **calculates** amounts from job data and pricing rules, **stores** an audit trail, and **exports** per-worker CSV for handoff to bank or payroll. It should **not** be read as payroll, wage compliance, or proof that money moved.

A codebase review (2026-07-02) found that **disclaimers and operator docs already state this boundary**, but several **UI flows, emails, and onboarding questions** create **expectation gaps** — users or workers may believe Tally **paid** someone, **computed hourly wages**, or issued a **legal payslip**.

This S0 captures the **changes required in the app** to **tighten** medium-liability surfaces and **document** high-liability capabilities we **must not** build without a deliberate payroll product decision.

**Guiding principle:** _Calculations and exports in Tally; settlement, tax, and compliance outside Tally._

**Regulatory tone:** This document records product risk and source-backed design principles. It is **not legal advice**. Final go-to-market copy, terms, and payroll-adjacent features should be reviewed by a qualified adviser for each launch jurisdiction.

---

## 2. Problem / opportunity (why this matters)

| Problem                                                                         | Who is affected                           | Risk                                                                   |
| ------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| **“Mark as paid”** reads like Tally sent money                                  | Org admins; workers if remittance follows | Trust disputes; workers chase payment that may not have left the bank  |
| **Remittance email/PDF** resembles payslip or payment confirmation              | Workers                                   | Misread as official pay advice or proof of transfer                    |
| **Onboarding “hourly / fixed salary”** implies in-app wage calculation          | New org admins                            | False product fit; support burden; liability through misrepresentation |
| **Equal-split fallback** without prominent warning                              | Org admins calculating pay                | Wrong per-worker amounts; under/overpayment disputes                   |
| **Settings toggles** (`auto_calculate`, `require_approval`) with no enforcement | Org admins                                | Feature promises that do not exist                                     |

**Opportunity:** A focused **copy + UX pass** (no new payroll APIs) materially reduces liability while preserving the core value: **accurate, exportable earnings calculations**.

---

## 3. Success (what “good” looks like — draft, non-binding)

_(Precise acceptance tests belong in S1/S2.)_

| Outcome                 | Measurement                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Settlement language** | No user-facing string says “Mark as paid” without clarifying **external** payment; primary action label is **“Record external payment”** (or equivalent) |
| **Worker-facing comms** | Remittance email/PDF cannot be read as “money was sent”; disclaimers match CSV export tone                                                               |
| **Onboarding honesty**  | Setup flow does not ask “hourly / salary” in a way that implies Tally computes wages                                                                     |
| **Split warnings**      | Equal-split fallback is **visible before save** when any selected job uses it                                                                            |
| **Boundary clarity**    | Product docs and in-app help remain consistent: **no STP, no tax withholding, no bank transfer, no payslip compliance**                                  |
| **AU-source alignment** | Copy reflects verified Australian guidance: employers remain responsible for wages, records, pay slips, PAYG/STP, super, and classification              |
| **No regression**       | CSV export, calculation engine, batch history, and rate cards continue to work (Article 1 PRESERVE)                                                      |

---

## 4. Current product snapshot (verified)

### 4.1 What already works (keep)

| Area                             | Location                                                            | Notes                                                                |
| -------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Non-custodial messaging**      | `dashboard/app/dashboard/worker-payments/page.tsx` (ContextualHelp) | States Tally does not transfer money; Fair Work link as context only |
| **CSV export + disclaimer**      | `dashboard/lib/worker-payments/export-batch-worker-csv.ts`          | Header disclaimer; reconciliation line                               |
| **Operator handoff doc**         | `docs/operator/worker-payments-handoff.md`                          | Clear “does / does not” boundary                                     |
| **Calculate dialog help**        | `dashboard/components/worker-payments/calculate-payment-dialog.tsx` | Save ≠ transfer; CSV handoff                                         |
| **Mark-paid dialog description** | `dashboard/components/worker-payments/mark-payment-paid-dialog.tsx` | Already says “Tally only stores this record”                         |
| **PDF footer disclaimer**        | `dashboard/lib/worker-payments/remittance-pdf.tsx`                  | “Not a bank statement or official payslip”                           |
| **Email footer disclaimer**      | `database/supabase/functions/send-worker-remittance-email/index.ts` | Same payslip disclaimer in footer                                    |

### 4.2 Gaps driving this S0

| Gap                                  | Location                                                                                                                | Issue                                                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **“Mark as paid” label**             | `worker-payment-summary.tsx`, `mark-worker-lines-paid-dialog.tsx`, `page.tsx`, toasts in `mark-payment-paid-dialog.tsx` | Action name suggests Tally executed payment                                                                                          |
| **Remittance email lead copy**       | `send-worker-remittance-email/index.ts` (~L133)                                                                         | “payment **has been recorded**” — workers may read as paid                                                                           |
| **Remittance email title**           | Same file                                                                                                               | “Remittance Advice” — payroll-adjacent                                                                                               |
| **Send to worker in mark-paid flow** | `mark-worker-lines-paid-dialog.tsx`                                                                                     | Worker-facing email from settlement dialog                                                                                           |
| **Onboarding payment method**        | `dashboard/components/onboarding/onboarding-wizard.tsx` (~L373–401)                                                     | “By the hour” / “Fixed salary” — stored in `onboarding_data.worker_payment_method` but **does not drive** `calculate-worker-payment` |
| **Equal-split visibility**           | `equal-split-badge.tsx` exists; used in preview/detail                                                                  | Badge may be missed in bulk calculate; no **pre-save** aggregate warning                                                             |
| **Unenforced settings**              | `worker-pay-period-settings-card.tsx`                                                                                   | `auto_calculate`, `require_approval` stored; no cron or approval gate in calculate/save path                                         |
| **Unused schema**                    | `worker_payment_allocation` table                                                                                       | Implies custom split UI that does not exist                                                                                          |

### 4.3 Australian source check (verified 2026-07-02)

These principles are drawn from official public guidance. They should shape product copy, not become in-app legal determinations.

| Source                                                                                                                                                                                                                                                                                                                                    | Verified principle                                                                                                                                                         | Product implication                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fair Work Ombudsman — [Record-keeping and pay slips fact sheet](https://www.fairwork.gov.au/tools-and-resources/fact-sheets/rights-and-obligations/record-keeping-pay-slips)                                                                                                                                                              | Employers must keep accurate and complete employee records and issue pay slips; pay slips must be issued within one working day of pay day.                                | Tally PDFs/emails must not be called **payslips** or imply payslip compliance. If worker-facing summaries remain, label them as **calculation summaries** or **records stored in Tally**, not statutory documents. |
| Fair Work Ombudsman — [Paying wages](https://www.fairwork.gov.au/pay-and-wages/paying-wages)                                                                                                                                                                                                                                              | Employers need to pay employees for all time spent working, keep pay records, and use ATO-required payroll information for payment summaries/income statements.            | Tally must avoid implying that job-based formulas prove wage compliance. The app can export data for employer review; it must not certify payment, minimum wage, or record-keeping compliance.                     |
| Fair Work Ombudsman — [Piece rates and commission payments](https://www.fairwork.gov.au/pay-and-wages/minimum-wages/piece-rates-and-commission-payments)                                                                                                                                                                                  | Piece rates are allowed only where permitted by an award/agreement or where no award/agreement applies; employees must still receive at least the applicable minimum wage. | Worker-side pricing rules and split weights are **allocation formulas**, not award/minimum wage calculators. Equal-split and rate-card copy should prompt users to verify obligations outside Tally.               |
| ATO — [Obligations when people work for you](https://www.ato.gov.au/businesses-and-organisations/hiring-and-paying-your-workers/engaging-a-worker/obligations-when-people-work-for-you)                                                                                                                                                   | Worker classification affects PAYG withholding, super, and other obligations; amounts withheld may need to be reported through STP-enabled payroll software and BAS.       | Tally must not classify workers as employees/contractors or calculate PAYG/STP/BAS obligations. Use neutral **worker** language and direct users to payroll/accounting systems.                                    |
| ATO — [Work out if you have to pay super](https://www.ato.gov.au/businesses-and-organisations/super-for-employers/work-out-if-you-have-to-pay-super) and [Super for independent contractors](https://www.ato.gov.au/businesses-and-organisations/super-for-employers/work-out-if-you-have-to-pay-super/super-for-independent-contractors) | Some independent contractors must receive super if paid mainly for their labour, even if they quote an ABN.                                                                | Do not treat “contractor” as outside payroll/super obligations. Avoid product copy suggesting contractors are simpler or exempt.                                                                                   |
| Fair Work Ombudsman — [Sham contracting](https://www.fairwork.gov.au/find-help-for/independent-contractors/sham-contracting)                                                                                                                                                                                                              | Misrepresenting employment as contracting can be illegal and penalties can apply.                                                                                          | Tally should not include classification quizzes, labels, or recommendations that tell an org whether a worker is a contractor or employee.                                                                         |

**AU design rule:** For Australian users, any worker-payment UI that mentions wages, piece rates, pay slips, tax, super, contractors, or payroll should use **context-only** language and direct the org to Fair Work, ATO, and a qualified adviser. Tally may show **how it calculated an amount**; it must not say the amount is legally payable, compliant, or final.

---

## 5. Proposed changes — medium liability (keep but tighten)

### 5.1 Record external payment (rename “Mark as paid”)

**Intent:** Keep settlement **record-keeping** for org ops; make it impossible to misread as in-app disbursement.

| Change                | Detail                                                                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primary label**     | Replace **“Mark as paid”** → **“Record external payment”** on buttons, dialog titles, toasts, and help text                                                                        |
| **Secondary subcopy** | Every entry point: _“Use this after you pay workers outside Tally through your bank, payroll system, or another process. Tally stores this record only.”_                          |
| **Confirmation step** | Before submit: checkbox or explicit confirm — _“I confirm payment was completed outside Tally and I am recording that external payment here.”_ (S1 to decide required vs optional) |
| **Success toast**     | Replace “Payment marked as paid successfully” → “External payment recorded”                                                                                                        |

**Files to update (inventory):**

| File                                                                     | Current strings / elements                       |
| ------------------------------------------------------------------------ | ------------------------------------------------ |
| `dashboard/components/worker-payments/worker-payment-summary.tsx`        | “Mark as paid” buttons; arrears helper copy      |
| `dashboard/components/worker-payments/mark-payment-paid-dialog.tsx`      | DialogTitle, submit button, success/error toasts |
| `dashboard/components/worker-payments/mark-worker-lines-paid-dialog.tsx` | Title, submit label, inline copy                 |
| `dashboard/app/dashboard/worker-payments/page.tsx`                       | ContextualHelp “mark as paid”                    |
| `docs/operator/worker-payments-handoff.md`                               | Align terminology                                |
| `dashboard/__tests__/components/worker-payments/*.test.tsx`              | Update role/name matchers                        |

**Preserve:** `update-worker-payment-status` edge function and `status: paid` in DB — **internal enum unchanged**; only **user-facing** copy changes (S1 to confirm).

---

### 5.2 Remittance PDF — admin-only, not worker-facing

**Intent:** PDF is an **org operator** artifact for records or manual forward; not a worker self-service payslip.

| Change                         | Detail                                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Access**                     | Keep **Download PDF** on admin dialogs (History, mark-paid success, payment detail)                                                      |
| **Remove or gate worker send** | Do not offer “email PDF to worker” from flows workers could interpret as official pay (see §5.3)                                         |
| **Title/copy**                 | Rename “Remittance Advice” → **“Worker earnings calculation summary”** or **“External payment record (not a payslip)”** in PDF header    |
| **Disclaimer**                 | Repeat a short disclaimer at the top and footer: _“This is not a payslip, bank statement, tax document, or wage-compliance assessment.”_ |

**Files:**

| File                                                                     | Notes                                        |
| ------------------------------------------------------------------------ | -------------------------------------------- |
| `dashboard/lib/worker-payments/remittance-pdf.tsx`                       | Title, disclaimer placement                  |
| `dashboard/components/worker-payments/mark-worker-lines-paid-dialog.tsx` | `handleDownloadRemittance` — keep admin-only |
| `dashboard/components/worker-payments/payment-history-list.tsx`          | History download — keep                      |
| `dashboard/components/worker-payments/payment-detail-dialog.tsx`         | Regenerate download — keep                   |

---

### 5.3 Remittance email — soften copy or remove worker-facing send

**Intent:** Email must not imply money was sent or that Tally is payroll.

**Option A (recommended for S1 triage): Soften + align disclaimer**

| Element           | Current                         | Proposed direction                                                                                                                             |
| ----------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Subject / title   | “Remittance Advice”             | “Worker earnings summary from {org}” (not “payment confirmed” or “pay slip”)                                                                   |
| Lead paragraph    | “payment **has been recorded**” | “The following **amounts were calculated in Tally** for {period} and recorded in {org}'s records. Payment is handled by {org} outside Tally.”  |
| Footer            | Short payslip disclaimer        | Add **full CSV-equivalent disclaimer**: no funds transfer, no payslip compliance, no tax/PAYG/STP/super calculation, no legal/financial advice |
| Send action label | “Send to worker”                | “Email earnings summary to worker” + confirm step showing recipient                                                                            |

**Option B (lower liability): Remove worker-facing email in v1**

- Remove **Send remittance email** from `mark-worker-lines-paid-dialog.tsx` and any History resend actions
- Admin downloads PDF/CSV and sends via their own mail client
- Deprecate or keep `send-worker-remittance-email` edge function dormant for future gated use

**Files:**

| File                                                                     | Notes                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------ |
| `database/supabase/functions/send-worker-remittance-email/index.ts`      | `buildEmailHtml`, `buildEmailText`, subject line |
| `dashboard/lib/services/worker-payment.service.ts`                       | `sendRemittanceEmail` client                     |
| `dashboard/components/worker-payments/mark-worker-lines-paid-dialog.tsx` | Send UI, post-mark-paid email path               |

**Preserve:** Email failure must **not** roll back recorded payment (existing S2 behaviour).

---

### 5.4 Rate cards / split weights — improve equal-split warnings

**Intent:** Wrong splits cause real money disputes; warnings must appear **before commit**.

| Change                         | Detail                                                                                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pre-save banner**            | In `calculate-payment-dialog.tsx`: if any preview row has `splitMode === "equal_split_fallback"`, show **Alert** — _“One or more jobs split equally because worker times were missing. Review before saving.”_ |
| **Stronger badge copy**        | Extend `equal-split-badge.tsx` tooltip (M-7 from S2): add _“Verify worker assignments, clock times, and any wage/minimum obligations before using this amount outside Tally.”_                                 |
| **Calculate warnings surface** | Surface engine `warnings` from `calculate-worker-payment` response in preview (if not already prominent)                                                                                                       |
| **CSV**                        | Keep `split_mode` column; no change required                                                                                                                                                                   |

**Files:**

| File                                                                                  | Notes                               |
| ------------------------------------------------------------------------------------- | ----------------------------------- |
| `dashboard/components/worker-payments/calculate-payment-dialog.tsx`                   | Pre-save alert; warning list        |
| `dashboard/components/worker-payments/equal-split-badge.tsx`                          | Tooltip copy                        |
| `dashboard/lib/worker-payments/build-worker-preview.ts`                               | Already tags `equal_split_fallback` |
| `database/supabase/functions/calculate-worker-payment/handlers/calculation-engine.ts` | Source warnings                     |

**Preserve:** Split math in `worker-payment-split.ts` and rate card modifiers — no calculation changes in this track unless S1 finds a bug.

---

### 5.5 Onboarding — reframe or remove hourly/salary question

**Intent:** Stop implying Tally computes hourly wages or salaries.

**Option A (recommended): Reframe question**

| Current                                    | Proposed                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| “How do you pay workers?”                  | “How do you **handle worker settlement outside Tally**?”                                                                                          |
| “By the hour” / “Per job” / “Fixed salary” | “Payroll system” / “Bank transfer” / “Cash or other” / “Export only — handled outside Tally”                                                      |
| Helper text                                | “Tally calculates job-based amounts from your pricing rules. It does not calculate legal wages, PAYG, super, payslips, or worker classification.” |

**Option B: Remove step**

- Drop `worker_payment_method` from onboarding UI
- Keep column in DB for analytics or migrate to nullable unused
- Pay frequency question may stay if it drives `worker_payment_cycle_config` display only

**Files:**

| File                                                       | Notes                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `dashboard/components/onboarding/onboarding-wizard.tsx`    | Step copy and radio options                                                                       |
| `dashboard/lib/types/api.ts`                               | `OnboardingData.worker_payment_method` type                                                       |
| `database/supabase/functions/complete-onboarding/index.ts` | Persists onboarding payload                                                                       |
| `dashboard/components/landing-page/industry-sections.tsx`  | “Flexible pricing (hourly, fixed, per job)” — align with **customer** pricing, not worker payroll |

**Data note:** `worker_payment_method` is **not consumed** by `calculate-worker-payment` today — safe to reframe without engine changes.

---

## 6. High liability — explicit product boundaries (do not build without payroll product decision)

These capabilities require **payroll infrastructure**, **legal/accounting review**, and **jurisdiction-specific compliance**. **Out of scope** for this tightening track; listed so S1 can **lock “never v1”** or **defer indefinitely**.

| Capability                                 | Why high liability                                                                                            | Current state                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Bank transfer / wallet payout**          | Custodial; financial services regulation                                                                      | Not implemented ✓                                                                                       |
| **ABA / NACHA / SEPA bank files**          | Payment initiation adjacent; worker bank PII; reconciliation and reversal expectations                        | Not implemented ✓                                                                                       |
| **STP / 1099 / BAS lodgement**             | Tax/payroll reporting obligations; ATO guidance ties PAYG withholding to STP-enabled payroll software and BAS | Not implemented ✓                                                                                       |
| **Superannuation / PAYG withholding**      | Statutory payroll; contractors mainly paid for labour may still trigger super obligations in Australia        | Not implemented ✓                                                                                       |
| **Award / minimum wage validation**        | Legal advice; piece-rate and commission arrangements may still require minimum wage checks                    | Not implemented ✓                                                                                       |
| **Employee vs contractor classification**  | Sham contracting risk; ATO and Fair Work both stress classification consequences                              | Neutral “workers” language only ✓                                                                       |
| **Legally compliant payslips**             | Australian employee pay slips have required content and timing rules                                          | PDF explicitly disclaims payslip ✓                                                                      |
| **Payroll provider APIs** (Xero/MYOB push) | Integration + reconciliation liability                                                                        | Not implemented; see [`S0-external-accounting-integration.md`](./S0-external-accounting-integration.md) |

### 6.1 Additional high-liability **changes that might be required** (if scope creep is detected)

| Trigger                                                              | Required response                                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Marketing claims “pay your workers in Tally”                         | **Remove** or gate behind real disbursement + legal review                                     |
| Workers get in-app “My pay” with amounts                             | Treat as **worker-facing pay advice / earnings statement** — legal review; likely out of scope |
| `auto_calculate` / `require_approval` shipped without implementation | **Remove toggles** or implement with explicit non-payroll semantics                            |
| `worker_payment_allocation` UI built                                 | Must not override engine silently; full audit + disclaimer                                     |
| Remittance email kept without copy fix                               | **Block send** until disclaimer parity with CSV                                                |
| Any field asks “employee or contractor?”                             | Do not classify; only record org-provided labels if legally reviewed and clearly non-advisory  |

### 6.2 Optional simplification tier (product decision for S1)

If owner wants **hard minimum surface**:

| Tier       | Scope                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Tier 1** | Copy/UX only (§5.1–5.5 Option A)                                                                                        |
| **Tier 2** | Tier 1 + **remove worker remittance email** (§5.3 Option B)                                                             |
| **Tier 3** | Tier 2 + remove settlement UI; **export-only** (calculate → CSV; no `paid` lifecycle in UI) — **large PRESERVE review** |

S0 does **not** recommend Tier 3 without explicit owner approval.

---

## 7. Change inventory summary

| Workstream                                                 | Priority | Effort (rough) | Depends on        |
| ---------------------------------------------------------- | -------- | -------------- | ----------------- |
| W1: Rename + confirm “Record external payment”             | P1       | Small          | None              |
| W2: Remittance email copy or removal                       | P1       | Small–Medium   | S1: Option A vs B |
| W3: Remittance PDF title/disclaimer                        | P2       | Small          | None              |
| W4: Equal-split pre-save warnings                          | P1       | Small          | None              |
| W5: Onboarding reframe                                     | P1       | Small          | S1: Option A vs B |
| W6: Hide or document `auto_calculate` / `require_approval` | P2       | Small          | Product call      |
| W7: Update tests + operator doc                            | P1       | Small          | W1–W5             |
| W8: Terms/marketing alignment pass                         | P2       | Medium         | Copy lock from S2 |
| W9: AU source-link copy pass                               | P1       | Small          | W1–W5             |

**No database migration required** for W1–W5 (copy/UX only). Enum `paid` unchanged.

---

## 8. Out of scope for this S0

- Implementation tasks, exact final strings, or DAP steps (S3/S4)
- Changes to **calculation engine** math or pricing rules
- Customer **invoice** GST copy (separate surface; lower priority)
- New payroll integrations
- Legal sign-off — product owner should still consult adviser for AU/US go-to-market copy; this doc only aligns product principles to official public guidance

---

## 9. Open questions for S1 (Triage)

| #   | Question                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Remittance email:** Option A (soften) or Option B (remove worker send)?                                                        |
| 2   | **Onboarding:** Reframe (A) or remove worker payment method step (B)?                                                            |
| 3   | **Confirmation checkbox** on record external payment: required every time or first-time only?                                    |
| 4   | **`auto_calculate` / `require_approval`:** hide, remove, or implement?                                                           |
| 5   | **Tier 1 vs 2 vs 3** simplification — owner preference?                                                                          |
| 6   | Should **History** retain any worker email action after this track?                                                              |
| 7   | Update **landing page** worker/pay language in same release or follow-up?                                                        |
| 8   | Should S2 require a **standard AU disclaimer block** reused in Worker Payments page, CSV, PDF, email, onboarding, and marketing? |
| 9   | Should the app hide any wording that asks for worker “hourly/salary” until a payroll integration exists?                         |

---

## 10. Post–S0 gate (Process Excellence)

> _If someone reads this idea in 6 months with no other context, will they understand what was meant?_

- **Yes, if:** reader sees (1) **problem** = expectation/legal gap on worker payments, (2) **solution** = tighten copy/UX not build payroll, (3) **inventory** of files and options, (4) **high-liability** list of things we do not build.
- **After S1:** link triage outcome (GO / partial / defer) and chosen options for §5.3 and §5.5.

---

## 11. Related documents

| Doc                                                                                                                                                                                     | Relationship                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`S2-worker-payments-disbursement.md`](./S2-worker-payments-disbursement.md)                                                                                                            | Locked v1 non-custodial CSV handoff — **do not contradict**                |
| [`S2-worker-payments-selective-settlement.md`](./S2-worker-payments-selective-settlement.md)                                                                                            | Built remittance/settlement — **this S0 amends UX/copy**, may remove email |
| [`docs/operator/worker-payments-handoff.md`](../operator/worker-payments-handoff.md)                                                                                                    | Update when W1 ships                                                       |
| [`docs/research/WORKER_PAYMENTS_AND_TERMINOLOGY_ISSUES.md`](../research/WORKER_PAYMENTS_AND_TERMINOLOGY_ISSUES.md)                                                                      | Historical; partially superseded by current DB-backed payments             |
| Fair Work Ombudsman — [Record-keeping and pay slips fact sheet](https://www.fairwork.gov.au/tools-and-resources/fact-sheets/rights-and-obligations/record-keeping-pay-slips)            | AU source for payslip/record-keeping boundaries                            |
| Fair Work Ombudsman — [Piece rates and commission payments](https://www.fairwork.gov.au/pay-and-wages/minimum-wages/piece-rates-and-commission-payments)                                | AU source for piece-rate/minimum wage caution                              |
| ATO — [Obligations when people work for you](https://www.ato.gov.au/businesses-and-organisations/hiring-and-paying-your-workers/engaging-a-worker/obligations-when-people-work-for-you) | AU source for PAYG/STP/classification caution                              |
| ATO — [Super for independent contractors](https://www.ato.gov.au/businesses-and-organisations/super-for-employers/work-out-if-you-have-to-pay-super/super-for-independent-contractors)  | AU source for contractor super caution                                     |
| Fair Work Ombudsman — [Sham contracting](https://www.fairwork.gov.au/find-help-for/independent-contractors/sham-contracting)                                                            | AU source for classification risk                                          |

---

_S0 — Worker payments liability tightening — Tally Runner — 2026-07-02_
