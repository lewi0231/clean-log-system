-- Restrict field configs to specific locations (optional)

CREATE TABLE location_field_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES location(id) ON DELETE CASCADE NOT NULL,
  field_config_id UUID REFERENCES organization_field_configs(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, field_config_id)
);

CREATE INDEX idx_location_field_config_location ON location_field_config(location_id);
CREATE INDEX idx_location_field_config_field ON location_field_config(field_config_id);

COMMENT ON TABLE location_field_config IS 'Optional restriction of field configs to specific locations. If no rows exist for a field config, it is available to all locations.';

