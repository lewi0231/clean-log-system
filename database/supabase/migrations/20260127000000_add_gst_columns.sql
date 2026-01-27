-- Add GST/Tax configuration to organization_settings
-- Supports Australian tax invoice requirements: GST registration, inclusive/exclusive pricing, rate

ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS gst_registered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gst_inclusive BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS gst_rate_percent NUMERIC(5,2) DEFAULT 10;

-- Constraint: gst_rate_percent must be between 0 and 100
ALTER TABLE organization_settings
  DROP CONSTRAINT IF EXISTS check_gst_rate_percent;
ALTER TABLE organization_settings
  ADD CONSTRAINT check_gst_rate_percent
  CHECK (gst_rate_percent >= 0 AND gst_rate_percent <= 100);

-- Comments
COMMENT ON COLUMN organization_settings.gst_registered IS 'True if the organization is GST-registered (e.g. turnover >= $75k). When false, invoices show "Invoice" and no GST.';
COMMENT ON COLUMN organization_settings.gst_inclusive IS 'True = prices in pricing rules are GST-inclusive. False = prices are ex-GST; we add GST on top.';
COMMENT ON COLUMN organization_settings.gst_rate_percent IS 'GST rate as percentage (e.g. 10 for 10%). Used when gst_registered is true.';
