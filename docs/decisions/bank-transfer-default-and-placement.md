# Bank transfer: default behaviour and settings placement

## Context

- Organisation settings include BSB, account number, account name, and a toggle **Show Bank Transfer Details on Invoices** (`show_bank_transfer_on_invoices`).
- Stripe is not yet enabled; bank transfer is the practical way customers pay today.
- We want to default to showing bank transfer details on invoices, and clarify where this is configured.

## Research: where should it live?

### Current state

- **Invoicing tab:** Sending/behaviour (send immediately, auto-generate), due days, GST, invoice template, and **Bank Transfer on Invoices** (BSB, account number, “show on invoices”).
- **Payments tab:** Stripe connection only (“Connect Stripe”, “Coming soon” for other providers). No bank transfer UI.

### Recommendation: put it under Payments

**Reasons:**

1. **Conceptual fit**  
   Payments is “how we get paid”: Stripe, bank transfer, future providers.  
   Configuring bank details and whether they appear on invoices is part of payment method setup, not invoice layout or timing.

2. **Common product pattern**  
   “Payments” or “Payment methods” usually holds all ways to receive money (Stripe, bank, PayPal, etc.).  
   “Invoicing” holds template, terms, due days, branding.  
   “Bank transfer” sits with other payment methods.

3. **Future Stripe parity**  
   When Stripe is added, both “Connect Stripe” and “Bank transfer” live in one place. Users configure “how customers can pay” in a single tab.

4. **Clear mental model**  
   “Invoicing” = when and how invoices are created/sent and how they look.  
   “Payments” = how customers pay (Stripe vs bank transfer, and for bank: BSB/account + “show on invoices”).

So the **Bank Transfer** block (BSB, account number, account name, “Show Bank Transfer Details on Invoices”) is better in the **Payments** tab.

## Recommendation: default to showing bank transfer on invoices

**Current behaviour:** `show_bank_transfer_on_invoices` defaults to `false` (DB and API).

**Proposed behaviour:** Default to `true` when the value is unset.

**Rationale:**

- Until Stripe exists, bank transfer is the main payment path.
- Defaulting to “show” means: once BSB and account number are entered, they appear on invoices without an extra toggle.
- Invoices only show the bank section when **all** of `show_bank_transfer_on_invoices`, `bank_transfer_bsb`, and `bank_transfer_account_number` are set. So defaulting “show” to true does not expose details before they are configured.
- Orgs that explicitly turn it off keep it off (we only change the default for null/unset).

**Implementation:**

1. **DB:** New rows get `show_bank_transfer_on_invoices DEFAULT true` (migration).
2. **API:** When reading org settings, treat null/absent as `true` (e.g. `?? true`).
3. **UI:** Initial/fallback logic for that flag uses `true` where it currently uses `false`.

Existing orgs that never set the flag will effectively default to “show” after the API change; those that set it to false remain unchanged.
