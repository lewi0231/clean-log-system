-- -*- mode: sql; sql-product: postgres -*-
-- Add team_percentage modifier type to worker_rate_card
-- This allows supervisors/team leads to earn a percentage of other workers' earnings

-- Step 1: Drop the existing check constraint
ALTER TABLE worker_rate_card 
  DROP CONSTRAINT IF EXISTS worker_rate_card_modifier_type_check;

-- Step 2: Add updated check constraint with team_percentage
ALTER TABLE worker_rate_card 
  ADD CONSTRAINT worker_rate_card_modifier_type_check 
  CHECK (modifier_type IN ('per_unit', 'flat', 'multiplier', 'team_percentage'));

-- Step 3: Update column comment
COMMENT ON COLUMN worker_rate_card.modifier_type IS 'Type of modifier: per_unit (bonus per output unit), flat (fixed per job), multiplier (percentage boost), team_percentage (percentage of team earnings)';
