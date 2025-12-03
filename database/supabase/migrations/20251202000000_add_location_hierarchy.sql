-- -*- mode: sql; sql-product: postgres -*-
-- Location hierarchy to support organization → region → site nesting

CREATE TABLE IF NOT EXISTS location_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES location_hierarchy(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  type TEXT NOT NULL CHECK (type IN ('company', 'region', 'site')),
  sort_order INT DEFAULT 0,
  metadata JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_hierarchy_org ON location_hierarchy(organization_id);
CREATE INDEX IF NOT EXISTS idx_location_hierarchy_parent ON location_hierarchy(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_location_hierarchy_org_parent_name
  ON location_hierarchy(organization_id, parent_id, name);

ALTER TABLE location_hierarchy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage location_hierarchy" ON location_hierarchy;
CREATE POLICY "Service role can manage location_hierarchy"
ON location_hierarchy FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE location_hierarchy IS 'Supports organization → region → site nesting for pricing overrides.';
COMMENT ON COLUMN location_hierarchy.metadata IS 'Arbitrary metadata such as address, timezone, etc.';

-- Link existing physical locations to hierarchy nodes (typically site nodes)
CREATE TABLE IF NOT EXISTS location_hierarchy_assignment (
  location_id UUID PRIMARY KEY REFERENCES location(id) ON DELETE CASCADE,
  hierarchy_id UUID REFERENCES location_hierarchy(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_hierarchy_assignment_hierarchy ON location_hierarchy_assignment(hierarchy_id);

ALTER TABLE location_hierarchy_assignment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage location_hierarchy_assignment" ON location_hierarchy_assignment;
CREATE POLICY "Service role can manage location_hierarchy_assignment"
ON location_hierarchy_assignment FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE location_hierarchy_assignment IS 'Associates a location record with a hierarchy node (site).';

