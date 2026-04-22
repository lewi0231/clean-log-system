-- Per-organization Resend sending domain (S4 org-resend-email-domain)
-- -*- mode: sql; sql-product: postgres -*-

ALTER TABLE public.organization
  ADD COLUMN IF NOT EXISTS custom_email_domain_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organization.custom_email_domain_enabled IS
  'When true, org may register a verified custom Resend domain for Edge mail From (entitlement / billing).';

CREATE TABLE IF NOT EXISTS public.organization_sending_domain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  resend_domain_id TEXT,
  domain_name TEXT NOT NULL,
  resend_status TEXT NOT NULL DEFAULT 'not_started',
  display_status TEXT NOT NULL DEFAULT 'pending_setup'
    CHECK (display_status IN (
      'pending_setup',
      'pending_dns',
      'verified',
      'error',
      'disabled'
    )),
  dns_records_snapshot JSONB,
  sending_region TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organization_sending_domain_one_per_org UNIQUE (organization_id),
  CONSTRAINT organization_sending_domain_domain_name_unique UNIQUE (domain_name)
);

CREATE INDEX IF NOT EXISTS idx_organization_sending_domain_org
  ON public.organization_sending_domain(organization_id);

COMMENT ON TABLE public.organization_sending_domain IS
  'At most one custom Resend domain per org; Edge-only; no API keys stored.';

CREATE TRIGGER update_organization_sending_domain_updated_at
  BEFORE UPDATE ON public.organization_sending_domain
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.organization_sending_domain ENABLE ROW LEVEL SECURITY;

-- Dashboard: org admins can read their org's row; mutations are Edge (service role) only
CREATE POLICY organization_sending_domain_select_org_admin
  ON public.organization_sending_domain
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_user ou
      WHERE ou.organization_id = organization_sending_domain.organization_id
        AND ou.auth_user_id = auth.uid()
        AND ou.role = 'admin'
        AND ou.status = 'active'
    )
  );
