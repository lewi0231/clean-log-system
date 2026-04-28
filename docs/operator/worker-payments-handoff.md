# Worker payments: CSV handoff (operator guide)

**Confidentiality:** Exports include worker names and payment amounts. Treat downloaded files like any payroll or pay-advice report: store securely, limit sharing, and do not post contents in public channels.

## What Tally does

- Calculates worker payment amounts from your pricing rules and job data.
- Stores calculation and batch records in the app.
- Lets you download a per-worker **CSV** from **Payment history** to support manual entry into your bank portal, Xero, MYOB, or another payroll system.

## What Tally does not do

- Transfer money, run payroll on your behalf, or connect to your bank.
- File tax or statutory reports (e.g. STP, 1099, BAS) or remit superannuation.
- Generate payslips or provide legal, financial, or tax advice.

**Fair Work (Australia) — context, not a guarantee:** For minimum wages, award rates, and employee vs contractor questions, the [Fair Work Ombudsman](https://www.fairwork.gov.au/) is a useful starting point. Tally’s figures are **estimates** for your own checks; your obligations depend on your award, agreement, and circumstances—confirm with a qualified payroll or legal adviser.

**Other jurisdictions:** Verify local wage, contractor, and record-keeping rules yourself; Tally does not make jurisdiction-specific compliance claims.

## Using the CSV

- Prefer **importing** or **copy-paste** into your payroll tool rather than re-keying long lists.
- **Reconcile** the batch total against the per-worker lines before paying; the file includes a reconciliation line for this.
- In **Excel** or **Sheets**, if a name starts with `=`, `+`, `-`, or `@`, the app exports safe quoting so the cell is treated as text, not a formula—still **spot-check** a row after import.

## In-app help

- **Worker Payments** (help icon): product boundary and, for non-AUD organizations, a reminder to verify local rules.
- **Mark as paid:** Records that you completed payment **outside** Tally; the app only stores that record.

## Related

- Product specification: `docs/stages/S2-worker-payments-disbursement.md` (see §6 export format and §13 outline).
