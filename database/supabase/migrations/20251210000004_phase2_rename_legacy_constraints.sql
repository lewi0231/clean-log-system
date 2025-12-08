-- -*- mode: sql; sql-product: postgres -*-
-- Phase 2: Rename legacy foreign key constraints that reference old table name 'car_yard'

-- Rename constraint referencing organization
ALTER TABLE location 
  RENAME CONSTRAINT car_yard_organization_id_fkey 
  TO location_organization_id_fkey;

-- Rename primary key constraint
ALTER TABLE location 
  RENAME CONSTRAINT car_yard_pkey 
  TO location_pkey;

