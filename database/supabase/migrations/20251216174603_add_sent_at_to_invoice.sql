-- Add sent_at column to track when an invoice was actually sent
-- This is populated when the status changes to 'sent' and an email is sent

ALTER TABLE invoice
ADD COLUMN sent_at TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN invoice.sent_at IS 'Timestamp when the invoice was sent to the customer (email sent)';

-- Add index for querying sent invoices by date
CREATE INDEX idx_invoice_sent_at ON invoice(sent_at) WHERE sent_at IS NOT NULL;

