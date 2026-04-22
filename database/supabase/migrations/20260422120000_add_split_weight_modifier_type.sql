-- Add split_weight modifier: relative share of the job worker payment pool (hours × weight).

ALTER TABLE worker_rate_card
  DROP CONSTRAINT IF EXISTS worker_rate_card_modifier_type_check;

ALTER TABLE worker_rate_card
  ADD CONSTRAINT worker_rate_card_modifier_type_check
  CHECK (modifier_type IN ('per_unit', 'flat', 'multiplier', 'team_percentage', 'split_weight'));

COMMENT ON COLUMN worker_rate_card.modifier_type IS 'Type of modifier: per_unit, flat, multiplier, team_percentage, split_weight (relative pool share; effective with hours × weight)';
