-- -*- mode: sql; sql-product: postgres -*-
-- Phase 1: Add service address and billing address configuration to invoice template
-- This enables configuration of which location fields to display and optional billing address

-- Add service address configuration (which location fields to show)
ALTER TABLE invoice_template_config 
ADD COLUMN IF NOT EXISTS service_address_config JSONB DEFAULT '{
  "source": "auto",
  "location_fields": ["name", "address", "contact_person", "email", "phone"]
}'::jsonb;

-- Add billing address configuration (enable/disable and auto-detect)
ALTER TABLE invoice_template_config 
ADD COLUMN IF NOT EXISTS billing_address_config JSONB DEFAULT '{
  "enabled": false,
  "source": "auto"
}'::jsonb;

-- Update comments
COMMENT ON COLUMN invoice_template_config.service_address_config IS 'JSONB config for service address display: {source: "auto"|"location"|"form_fields", location_fields: ["name", "address", "contact_person", "email", "phone"]}';
COMMENT ON COLUMN invoice_template_config.billing_address_config IS 'JSONB config for billing address display: {enabled: boolean, source: "auto"|"organization"|"hierarchy"|"form_fields"}';

