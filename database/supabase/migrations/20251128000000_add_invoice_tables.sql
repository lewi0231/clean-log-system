-- -*- mode: sql; sql-product: postgres -*-
-- Invoice Tables
-- Supports creating invoices from completed jobs with full tracking

-- Invoice Table
CREATE TABLE invoice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  invoice_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
  currency TEXT DEFAULT 'USD',
  due_date TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, invoice_number)
);

-- Invoice-Job Junction Table (many-to-many)
CREATE TABLE invoice_job (
  invoice_id UUID REFERENCES invoice(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES job(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (invoice_id, job_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_invoice_org ON invoice(organization_id);
CREATE INDEX idx_invoice_number ON invoice(invoice_number);
CREATE INDEX idx_invoice_status ON invoice(status);
CREATE INDEX idx_invoice_created_at ON invoice(created_at);
CREATE INDEX idx_invoice_due_date ON invoice(due_date);
CREATE INDEX idx_invoice_job_invoice ON invoice_job(invoice_id);
CREATE INDEX idx_invoice_job_job ON invoice_job(job_id);

-- Enable RLS
ALTER TABLE invoice ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_job ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage invoices
CREATE POLICY "Service role can manage invoice"
ON invoice FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage invoice_job"
ON invoice_job FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comments for documentation
COMMENT ON TABLE invoice IS 'Invoices created from completed jobs with pricing calculations';
COMMENT ON COLUMN invoice.invoice_number IS 'Unique invoice number per organization, format: {ORG_CODE}-{YYYY}-{####}';
COMMENT ON COLUMN invoice.status IS 'Invoice status: draft, sent, paid, overdue, or cancelled';
COMMENT ON COLUMN invoice.subtotal IS 'Subtotal before base pricing adjustments';
COMMENT ON COLUMN invoice.total IS 'Final total after all pricing calculations';
COMMENT ON TABLE invoice_job IS 'Junction table linking invoices to jobs (one invoice can have multiple jobs)';

