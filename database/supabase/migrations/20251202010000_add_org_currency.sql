-- -*- mode: sql; sql-product: postgres -*-
-- Add currency and locale settings to organization table

ALTER TABLE organization 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'AUD' 
CHECK (currency IN ('AUD', 'USD', 'GBP', 'EUR', 'CAD', 'NZD'));

ALTER TABLE organization 
ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en-AU';

COMMENT ON COLUMN organization.currency IS 'Default currency for pricing and invoicing (ISO 4217 code)';
COMMENT ON COLUMN organization.locale IS 'Locale for number/date formatting (BCP 47 tag)';

