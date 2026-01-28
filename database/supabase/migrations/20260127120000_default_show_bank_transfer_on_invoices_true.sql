-- Default "show bank transfer on invoices" to true for new organisations.
-- Bank transfer is the primary payment method until Stripe is enabled; this
-- makes details visible on invoices once BSB/account are entered without
-- requiring an extra toggle. Invoices only render bank details when
-- show_bank_transfer_on_invoices AND BSB AND account_number are set.

ALTER TABLE organization_settings
  ALTER COLUMN show_bank_transfer_on_invoices SET DEFAULT true;
