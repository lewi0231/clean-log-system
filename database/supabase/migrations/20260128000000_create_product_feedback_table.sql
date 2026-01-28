-- -*- mode: sql; sql-product: postgres -*-
-- Product feedback table for in-app beta feedback (bugs, ideas, general).
-- See docs/decisions/beta-feedback-collection.md.

CREATE TABLE product_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id UUID REFERENCES organization_user(id) ON DELETE SET NULL,
  page_path TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_feedback_category_check CHECK (category IN ('bug', 'idea', 'general'))
);

COMMENT ON TABLE product_feedback IS 'In-app product/beta feedback from dashboard users (bugs, ideas, general)';
COMMENT ON COLUMN product_feedback.page_path IS 'Dashboard path when feedback was submitted (e.g. /dashboard/pricing)';
COMMENT ON COLUMN product_feedback.category IS 'Feedback type: bug, idea, or general';

CREATE INDEX idx_product_feedback_org_created ON product_feedback(organization_id, created_at DESC);

ALTER TABLE product_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage product_feedback"
  ON product_feedback
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
