-- -*- mode: sql; sql-product: postgres -*-
-- Add rating configuration to organization table
-- This allows organizations to choose between single rating or multi-dimensional ratings

-- Add rating_config JSONB column to organization table
ALTER TABLE organization 
  ADD COLUMN IF NOT EXISTS rating_config JSONB DEFAULT '{"type": "single", "dimensions": ["overall"]}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN organization.rating_config IS 'Configuration for feedback ratings. Options: single (overall rating only), three_dimensions (quality, communication, value), or rater (reliability, assurance, tangibles, empathy, responsiveness)';

-- Update feedback table to support multiple ratings
-- Add ratings JSONB column to store dimension-based ratings
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS ratings JSONB;

-- Add comment for documentation
COMMENT ON COLUMN feedback.ratings IS 'JSONB object storing dimension-based ratings. Format: {"overall": 5, "quality": 4, "communication": 5, "value": 4} or {"overall": 5} for single rating mode. The "rating" column remains for backward compatibility and stores the overall rating.';

-- Create index for ratings queries
CREATE INDEX IF NOT EXISTS idx_feedback_ratings ON feedback USING GIN (ratings);

-- Update existing feedback records to have ratings matching the rating column
UPDATE feedback
SET ratings = jsonb_build_object('overall', rating)
WHERE ratings IS NULL;

