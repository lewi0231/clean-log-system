-- -*- mode: sql; sql-product: postgres -*-
-- Invoice Template Configuration Table
-- Allows organizations to customize invoice display including Bill To mappings,
-- line item formatting, and invoice header settings

CREATE TABLE invoice_template_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Bill To Field Mappings (JSONB)
  -- Maps field_config names to Bill To fields
  -- Example: {"name": "contact_name", "email": "contact_email", "address": "address"}
  bill_to_mappings JSONB DEFAULT '{}',
  
  -- Line Item Display Settings (JSONB)
  -- Configuration for how line items are displayed
  -- Example: {"include_option_value": true, "description_format": "{field_label}: {option_value}"}
  line_item_display JSONB DEFAULT '{}',
  
  -- Invoice Display Settings
  invoice_title TEXT DEFAULT 'Tax Invoice', -- "Invoice" or "Tax Invoice"
  show_logo BOOLEAN DEFAULT true,
  show_abn BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_invoice_template_config_org ON invoice_template_config(organization_id);

-- Enable RLS
ALTER TABLE invoice_template_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage invoice template config
CREATE POLICY "Service role can manage invoice_template_config"
ON invoice_template_config FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comments for documentation
COMMENT ON TABLE invoice_template_config IS 'Invoice template configuration allowing organizations to customize invoice display';
COMMENT ON COLUMN invoice_template_config.bill_to_mappings IS 'JSONB mapping of field_config names to Bill To fields (name, email, phone, address, etc.)';
COMMENT ON COLUMN invoice_template_config.line_item_display IS 'JSONB configuration for line item display formatting';
COMMENT ON COLUMN invoice_template_config.invoice_title IS 'Invoice title displayed on invoice (default: "Tax Invoice")';

-- Create default configs for existing organizations
INSERT INTO invoice_template_config (organization_id, invoice_title, show_logo, show_abn, bill_to_mappings, line_item_display)
SELECT 
  id,
  'Tax Invoice',
  true,
  true,
  '{}'::jsonb,
  '{"include_option_value": true, "description_format": "{field_label}: {option_value}", "show_base_price_separately": true}'::jsonb
FROM organization
WHERE id NOT IN (SELECT organization_id FROM invoice_template_config);

