-- -*- mode: sql; sql-product: postgres -*-
-- Add invoice email recipient configuration to invoice_template_config
-- This allows organizations to configure where invoice emails should be sent

-- The configuration is stored in invoice_template_config.email_recipient_config as JSONB:
-- {
--   "location_email_source": "location_email" | "hierarchy_billing_email" | "location_contact_email",
--   "form_field_email": "field_config_id" | null,  -- Field config ID (not name) that contains email for jobs without location
--   "default_email": "email@example.com" | null
-- }

-- Email recipient precedence:
-- 1. If job has location_id:
--    - If hierarchy has billing_email → use that
--    - Else if location.email exists → use that
--    - Else → use default_email or don't send
-- 2. If job has no location_id:
--    - If form_field_email configured and exists in submission_data → use that
--    - Else → use default_email or don't send

ALTER TABLE invoice_template_config
  ADD COLUMN IF NOT EXISTS email_recipient_config JSONB DEFAULT NULL;

COMMENT ON COLUMN invoice_template_config.email_recipient_config IS 'Email recipient configuration for invoices: {location_email_source: "location_email"|"hierarchy_billing_email"|"location_contact_email", form_field_email: string|null, default_email: string|null}';

-- Set default config for existing rows
UPDATE invoice_template_config
SET email_recipient_config = jsonb_build_object(
  'location_email_source', 'location_email',
  'form_field_email', NULL,
  'default_email', NULL
)
WHERE email_recipient_config IS NULL;

