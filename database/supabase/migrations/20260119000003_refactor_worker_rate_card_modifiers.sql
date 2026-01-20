-- -*- mode: sql; sql-product: postgres -*-
-- Refactor Worker Rate Card to Support Modifier Types (Additive Bonuses)
-- Changes from hourly_rate to modifier_type + modifier_value
-- Adds field mapping for per_unit bonuses
-- Adds time tracking to job_worker

-- Step 1: Drop the old constraint that references rate_type
ALTER TABLE worker_rate_card 
  DROP CONSTRAINT IF EXISTS worker_rate_card_no_overlap;

-- Step 2: Rename hourly_rate to modifier_value and change check constraint
ALTER TABLE worker_rate_card 
  DROP CONSTRAINT IF EXISTS worker_rate_card_hourly_rate_check;

ALTER TABLE worker_rate_card 
  RENAME COLUMN hourly_rate TO modifier_value;

-- Allow more decimal places for modifier_value (e.g., $0.0050 per unit)
ALTER TABLE worker_rate_card 
  ALTER COLUMN modifier_value TYPE DECIMAL(10, 4);

-- Add modifier_value check (must be positive)
ALTER TABLE worker_rate_card 
  ADD CONSTRAINT worker_rate_card_modifier_value_check CHECK (modifier_value > 0);

-- Step 3: Add modifier_type column
-- 'per_unit' - Bonus per unit of output (e.g., $0.50/car)
-- 'flat' - Fixed bonus per job (e.g., $20/job)
-- 'multiplier' - Percentage boost to time-share (e.g., 1.2 = 20% more)
ALTER TABLE worker_rate_card 
  ADD COLUMN modifier_type TEXT NOT NULL DEFAULT 'flat';

ALTER TABLE worker_rate_card 
  ADD CONSTRAINT worker_rate_card_modifier_type_check 
  CHECK (modifier_type IN ('per_unit', 'flat', 'multiplier', 'team_percentage'));

-- Step 4: Drop rate_type column (no longer needed - was standard/overtime/holiday)
ALTER TABLE worker_rate_card 
  DROP COLUMN IF EXISTS rate_type;

-- Step 5: Update EXCLUDE constraint (now based on modifier_type instead of rate_type)
-- One active rate card per worker per modifier type
ALTER TABLE worker_rate_card 
  ADD CONSTRAINT worker_rate_card_no_overlap EXCLUDE USING gist (
    worker_id WITH =,
    modifier_type WITH =,
    daterange(effective_from, effective_to, '[]') WITH &&
  ) WHERE (is_active = TRUE);

-- Step 6: Update comments
COMMENT ON COLUMN worker_rate_card.modifier_type IS 'Type of modifier: per_unit (bonus per output unit), flat (fixed per job), multiplier (percentage boost), team_percentage (percentage of team earnings)';
COMMENT ON COLUMN worker_rate_card.modifier_value IS 'The value of the modifier (amount for per_unit/flat, multiplier for multiplier type)';

-- Step 7: Update index (remove rate_type reference)
DROP INDEX IF EXISTS idx_worker_rate_card_lookup;
CREATE INDEX idx_worker_rate_card_lookup 
  ON worker_rate_card(worker_id, modifier_type, effective_from DESC) 
  WHERE is_active = TRUE;

-- ============================================================
-- Rate Card Field Mapping (for per_unit bonuses)
-- ============================================================

CREATE TABLE worker_rate_card_field (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL REFERENCES worker_rate_card(id) ON DELETE CASCADE,
  field_config_id UUID NOT NULL REFERENCES organization_field_configs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(rate_card_id, field_config_id)
);

COMMENT ON TABLE worker_rate_card_field IS 'Maps rate cards to fields for per-unit bonuses (e.g., which fields the bonus applies to)';
COMMENT ON COLUMN worker_rate_card_field.rate_card_id IS 'The rate card this field mapping belongs to';
COMMENT ON COLUMN worker_rate_card_field.field_config_id IS 'The field config this bonus applies to (e.g., cars_cleaned)';

-- Index for lookups
CREATE INDEX idx_worker_rate_card_field_rate_card ON worker_rate_card_field(rate_card_id);
CREATE INDEX idx_worker_rate_card_field_field_config ON worker_rate_card_field(field_config_id);

-- RLS for rate card field mapping
ALTER TABLE worker_rate_card_field ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage worker_rate_card_field"
  ON worker_rate_card_field
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- Worker Time Tracking on Jobs
-- ============================================================

-- Add time tracking columns to job_worker table
ALTER TABLE job_worker 
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

COMMENT ON COLUMN job_worker.start_time IS 'When this worker started working on the job';
COMMENT ON COLUMN job_worker.end_time IS 'When this worker finished working on the job';

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_job_worker_times 
  ON job_worker(job_id) 
  WHERE start_time IS NOT NULL;
