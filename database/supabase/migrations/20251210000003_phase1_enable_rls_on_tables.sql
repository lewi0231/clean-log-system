-- -*- mode: sql; sql-product: postgres -*-
-- Phase 1: Enable Row Level Security on tables that currently have it disabled

-- Enable RLS
ALTER TABLE location_field_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_pricing_mode ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for service role access
CREATE POLICY "Service role can manage location_field_config"
ON location_field_config FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage service_pricing_mode"
ON service_pricing_mode FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage organization_settings"
ON organization_settings FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

