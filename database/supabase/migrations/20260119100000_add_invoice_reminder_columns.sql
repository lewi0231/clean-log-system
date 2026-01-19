-- -*- mode: sql; sql-product: postgres -*-
-- Add reminder tracking columns to invoice table
-- Supports overdue invoice reminder functionality

-- Add reminder_count column to track number of reminders sent
ALTER TABLE invoice 
ADD COLUMN reminder_count INTEGER DEFAULT 0;

-- Add last_reminder_sent_at column to track when last reminder was sent
ALTER TABLE invoice 
ADD COLUMN last_reminder_sent_at TIMESTAMPTZ;

-- Add constraint to ensure reminder_count is non-negative
ALTER TABLE invoice 
ADD CONSTRAINT invoice_reminder_count_non_negative 
CHECK (reminder_count >= 0);

-- Create index for efficient overdue invoice queries
-- Used by mark-overdue-invoices cron job
CREATE INDEX idx_invoice_overdue_candidates 
ON invoice (status, due_date, paid_at) 
WHERE status = 'sent' AND paid_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN invoice.reminder_count IS 'Number of payment reminder emails sent for this invoice';
COMMENT ON COLUMN invoice.last_reminder_sent_at IS 'Timestamp of when the last payment reminder was sent';
