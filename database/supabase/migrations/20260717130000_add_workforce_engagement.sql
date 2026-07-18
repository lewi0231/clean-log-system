-- Workforce engagement (org settlement mode) + worker engagement_type
-- S4: docs/stages/S4-workforce-engagement-contractor-tax-invoice.md Phase A

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS workforce_engagement text NOT NULL DEFAULT 'employees';

ALTER TABLE public.organization_settings
  DROP CONSTRAINT IF EXISTS organization_settings_workforce_engagement_check;

ALTER TABLE public.organization_settings
  ADD CONSTRAINT organization_settings_workforce_engagement_check
  CHECK (workforce_engagement IN ('employees', 'contractors', 'both'));

COMMENT ON COLUMN public.organization_settings.workforce_engagement IS
  'Settlement mode in Tally: employees (org calculate/remittance), contractors (tax invoices), both (per-worker). Not a legal employment classification.';

ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS engagement_type text NOT NULL DEFAULT 'employee';

ALTER TABLE public.worker
  DROP CONSTRAINT IF EXISTS worker_engagement_type_check;

ALTER TABLE public.worker
  ADD CONSTRAINT worker_engagement_type_check
  CHECK (engagement_type IN ('employee', 'contractor'));

COMMENT ON COLUMN public.worker.engagement_type IS
  'Product settlement type for this worker: employee vs contractor (gates tax-invoice submit when org workforce_engagement = both).';
