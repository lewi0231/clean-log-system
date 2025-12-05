-- Service-specific pricing mode overrides
-- Allows a location to use fixed pricing for specific service type values while keeping field-based pricing for others

CREATE TABLE service_pricing_mode (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES location(id) ON DELETE CASCADE,
  service_type_field_config_id UUID REFERENCES organization_field_configs(id) ON DELETE CASCADE NOT NULL,
  service_type_value TEXT NOT NULL,
  pricing_mode TEXT NOT NULL CHECK (pricing_mode IN ('field_based', 'fixed_price')),
  fixed_customer_price DECIMAL(12, 4),
  fixed_worker_payment DECIMAL(12, 4),
  fixed_price_currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- If pricing_mode is fixed_price, fixed amounts and currency must be present
  CONSTRAINT service_pricing_mode_fixed_check CHECK (
    (pricing_mode = 'fixed_price' AND fixed_customer_price IS NOT NULL AND fixed_worker_payment IS NOT NULL AND fixed_price_currency IS NOT NULL)
    OR (pricing_mode = 'field_based')
  )
);

-- Unique per org/location/service type value
CREATE UNIQUE INDEX idx_service_pricing_mode_unique
ON service_pricing_mode (
  organization_id,
  COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
  service_type_field_config_id,
  service_type_value
);

CREATE INDEX idx_service_pricing_mode_lookup
  ON service_pricing_mode (organization_id, service_type_field_config_id, service_type_value);

COMMENT ON TABLE service_pricing_mode IS 'Overrides pricing mode per service type for a location (or org default).';
COMMENT ON COLUMN service_pricing_mode.pricing_mode IS 'field_based uses standard pricing rules; fixed_price uses fixed amounts for this service at the given location.';

