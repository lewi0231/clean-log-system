-- -*- mode: sql; sql-product: postgres -*-
-- Organization Field Configs
-- Stores custom field configurations for mobile app forms per organization
CREATE TABLE organization_field_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  
  -- Field definition
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  description TEXT,
  required BOOLEAN DEFAULT false,
  order_position INT NOT NULL,
  
  -- Validation rules
  validation_rules JSONB,
  
  -- For select fields
  options JSONB,
  
  -- Status tracking
  version INT DEFAULT 1,
  active BOOLEAN DEFAULT true,
  archived_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, name)
);

-- Add index for organization_id queries
CREATE INDEX idx_organization_field_configs_org ON organization_field_configs(organization_id);
CREATE INDEX idx_organization_field_configs_active ON organization_field_configs(organization_id, active) WHERE active = true;
CREATE INDEX idx_organization_field_configs_order ON organization_field_configs(organization_id, order_position);

-- Enable RLS
ALTER TABLE organization_field_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage field configs
CREATE POLICY "Service role can manage organization_field_configs"
ON organization_field_configs FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Add use_predefined_locations to organization table
ALTER TABLE organization ADD COLUMN IF NOT EXISTS use_predefined_locations BOOLEAN DEFAULT true;

