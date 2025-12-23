-- -*- mode: sql; sql-product: postgres -*-
-- Add pending_review status to invoice table
-- This status is used for auto-generated invoices that require admin review before sending

-- Drop the existing check constraint
ALTER TABLE invoice DROP CONSTRAINT IF EXISTS invoice_status_check;

-- Add the new constraint with pending_review status
ALTER TABLE invoice 
  ADD CONSTRAINT invoice_status_check 
  CHECK (status IN ('draft', 'pending_review', 'sent', 'paid', 'overdue', 'cancelled'));

-- Update the default status comment
COMMENT ON COLUMN invoice.status IS 'Invoice status: draft (manually created, not sent), pending_review (auto-generated, awaiting approval), sent (sent to customer), paid, overdue, or cancelled';

-- Add index for efficient querying of pending review invoices
CREATE INDEX IF NOT EXISTS idx_invoice_pending_review 
ON invoice(organization_id, status) 
WHERE status = 'pending_review';

