-- -*- mode: sql; sql-product: postgres -*-
-- Consolidate location hierarchy: locations become the actual sites
-- Hierarchy nodes (company, region) remain for organizational grouping
-- Sites are removed from hierarchy - locations take their place

-- Step 1: Add hierarchy_parent_id to location table
-- This allows locations to belong to a region for pricing inheritance
ALTER TABLE location 
ADD COLUMN IF NOT EXISTS hierarchy_parent_id UUID REFERENCES location_hierarchy(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_location_hierarchy_parent ON location(hierarchy_parent_id);

COMMENT ON COLUMN location.hierarchy_parent_id IS 'Optional reference to a location_hierarchy node (company or region) for pricing inheritance.';

-- Step 2: Migrate existing site assignments to the new column
-- For each location that has an assignment, set hierarchy_parent_id to the assigned site's parent
UPDATE location l
SET hierarchy_parent_id = (
  SELECT lh.parent_id
  FROM location_hierarchy_assignment lha
  JOIN location_hierarchy lh ON lha.hierarchy_id = lh.id
  WHERE lha.location_id = l.id
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM location_hierarchy_assignment lha WHERE lha.location_id = l.id
);

-- Step 3: For locations assigned to sites, if the site has no parent, 
-- assign directly to the site (which should be a region or company)
UPDATE location l
SET hierarchy_parent_id = (
  SELECT lha.hierarchy_id
  FROM location_hierarchy_assignment lha
  JOIN location_hierarchy lh ON lha.hierarchy_id = lh.id
  WHERE lha.location_id = l.id
  AND lh.parent_id IS NULL
  LIMIT 1
)
WHERE hierarchy_parent_id IS NULL
AND EXISTS (
  SELECT 1 FROM location_hierarchy_assignment lha WHERE lha.location_id = l.id
);

-- Step 4: Drop the assignment table (no longer needed)
DROP TABLE IF EXISTS location_hierarchy_assignment;

-- Step 5: Remove 'site' type nodes from hierarchy (they're now redundant)
-- First, update any pricing rules that reference site nodes to reference the parent instead
UPDATE pricing_rule pr
SET location_hierarchy_id = lh.parent_id
FROM location_hierarchy lh
WHERE pr.location_hierarchy_id = lh.id
AND lh.type = 'site';

-- Step 6: Delete site nodes from hierarchy
DELETE FROM location_hierarchy WHERE type = 'site';

-- Step 7: Update the type constraint to only allow company and region
ALTER TABLE location_hierarchy 
DROP CONSTRAINT IF EXISTS location_hierarchy_type_check;

ALTER TABLE location_hierarchy 
ADD CONSTRAINT location_hierarchy_type_check 
CHECK (type IN ('company', 'region'));

-- Update table comments
COMMENT ON TABLE location_hierarchy IS 'Organizational hierarchy (company, region) for pricing inheritance. Locations reference these nodes via hierarchy_parent_id.';

