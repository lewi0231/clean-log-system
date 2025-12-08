-- -*- mode: sql; sql-product: postgres -*-
-- Phase 1: Remove legacy pricing_rules table
-- The unified pricing_rule table replaces this functionality
-- Verified: Table is empty and not referenced in application code

DROP TABLE IF EXISTS pricing_rules CASCADE;

