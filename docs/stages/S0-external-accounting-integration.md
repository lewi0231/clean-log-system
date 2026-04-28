# S0 — Idea Intake: External accounting & payroll software (Xero, MYOB, etc.)

| Field        | Value                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**    | S0 — Idea capture (not triage)                                                                                                                                              |
| **Captured** | 2026-04-28                                                                                                                                                                  |
| **Updated**  | 2026-04-28 — cross-check with [S2 selective settlement](./S2-worker-payments-selective-settlement.md) Gold + Adversarial (remains **out of scope** for that track)          |
| **Product**  | Tally Runner — orgs that pay workers **and** run books in Xero, MYOB, QuickBooks, or similar                                                                                |
| **Source**   | Stakeholder question from [S2 selective settlement](./S2-worker-payments-selective-settlement.md) track: _should Tally update external systems when payments are recorded?_ |

---

## 1. Idea (submitter language)

Some operators **do not** pay from Tally (non-custodial) but **do** use **Xero**, **MYOB**, **QuickBooks Online**, or **payroll** products that create **bills** / **spend money** / **pays** transactions. They want:

- **Less double entry:** When Tally records **"mark as paid"** (or a **remittance** is issued), the **accounting** or **payroll** system should **update automatically** (create bill, mark paid, attach reference), **or** at least **export** in a form those tools import.

This might include:

- **OAuth** connection to a provider
- **Webhooks** or **scheduled sync** of worker payments → bills / expenses
- **Rules** (map org → Xero org, map worker → supplier/contact)
- **Failure handling** (sync queue, manual retry)

---

## 2. Why this is a separate track

- **Selective settlement** [S2](./S2-worker-payments-selective-settlement.md) ships **Tally-only** **recording** + **remittance** **PDF** **/** **email** without depending on a third party’s API, SLAs, or customer OAuth consent.
- **Accounting integration** is a **separate** **product** **surface** (compliance, pricing tier, per-region chart of accounts) and can block or balloon scope if mixed into worker-payments v1.
- **Technical** **risk** is high: each vendor has different objects (Bills, Pay Runs, Journals, Bank Feeds) and idempotency rules.

---

## 3. S1 triage (when ready)

| Direction                  | S1 will answer                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Which** **integrations** | v1: none **or** one (e.g. Xero only) with narrow scope (e.g. **export CSV** for bank import **only**)                                         |
| **Read** vs **write**      | Read bank balance from Xero? **Unlikely** for v1. **Write** bill when worker paid? **Or** one-way **export** only                             |
| **Security**               | OAuth per org, token storage, **least** privilege, audit                                                                                      |
| **Boundary**               | Tally still **does** **not** **move** **money**; Xero may record **spend** **after** user confirms in Xero or via **unreconciled** **export** |

---

## 4. Out of scope for selective-settlement S2

Automatic updates to Xero / MYOB / QBO are **out of scope** for [`S2-worker-payments-selective-settlement.md`](./S2-worker-payments-selective-settlement.md). **CSV** and **remittance** **PDF** remain the **portable** **outputs** for manual import or email attachment.

---

## 5. Next step

When prioritised, create **S1-external-accounting-integration.md** (triage) then **S2** (F&F) with a **staged** **MVP** (e.g. **generic** **CSV** **or** **Xero** **bills** **CSV** **template** before live API).

---

_Project stage doc — S0 only._
