-- Worker tax invoices (contractor → org). Separate from customer public.invoice.
-- S4: docs/stages/S4-workforce-engagement-contractor-tax-invoice.md Phase B

CREATE TABLE IF NOT EXISTS public.worker_tax_invoice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.worker(id) ON DELETE CASCADE,
  invoice_number text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'paid', 'cancelled')),
  subtotal numeric(12, 2) NOT NULL DEFAULT 0,
  total numeric(12, 2) NOT NULL DEFAULT 0,
  gst_amount numeric(12, 2),
  currency text NOT NULL DEFAULT 'AUD',
  calculation_snapshot jsonb,
  review_notes text,
  batch_id uuid REFERENCES public.worker_payment_batch(id) ON DELETE SET NULL,
  issued_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_tax_invoice_number_unique UNIQUE (organization_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_worker_tax_invoice_org_status
  ON public.worker_tax_invoice (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_tax_invoice_worker
  ON public.worker_tax_invoice (worker_id, status, created_at DESC);

COMMENT ON TABLE public.worker_tax_invoice IS
  'Contractor tax invoices (worker → organization). Not customer invoices.';

CREATE TABLE IF NOT EXISTS public.worker_tax_invoice_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.worker_tax_invoice(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.job(id) ON DELETE CASCADE,
  worker_payment_id uuid REFERENCES public.worker_payment(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_tax_invoice_line_invoice
  ON public.worker_tax_invoice_line (invoice_id);
CREATE INDEX IF NOT EXISTS idx_worker_tax_invoice_line_job
  ON public.worker_tax_invoice_line (job_id);

COMMENT ON TABLE public.worker_tax_invoice_line IS
  'Lines on a worker tax invoice; typically one per (worker, job).';

-- Active uniqueness for (worker, job) enforced in Edge transactions (D11).
-- Supporting index for conflict checks:
CREATE INDEX IF NOT EXISTS idx_wti_line_job_for_active_check
  ON public.worker_tax_invoice_line (job_id, invoice_id);

CREATE OR REPLACE FUNCTION public.generate_worker_tax_invoice_number(p_organization_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_code text;
  v_year int;
  v_last_invoice_number text;
  v_last_seq int := 0;
  v_match text[];
BEGIN
  SELECT org_code INTO v_org_code
  FROM organization
  WHERE id = p_organization_id;

  IF v_org_code IS NULL THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  v_year := extract(year FROM now())::int;

  PERFORM pg_advisory_xact_lock(hashtext(p_organization_id::text || ':WTI:' || v_year::text));

  SELECT invoice_number INTO v_last_invoice_number
  FROM worker_tax_invoice
  WHERE organization_id = p_organization_id
    AND invoice_number LIKE (v_org_code || '-WTI-' || v_year::text || '-%')
  ORDER BY invoice_number DESC
  LIMIT 1;

  IF v_last_invoice_number IS NOT NULL THEN
    v_match := regexp_match(v_last_invoice_number, '-(\d+)$');
    IF v_match IS NOT NULL AND array_length(v_match, 1) >= 1 THEN
      v_last_seq := v_match[1]::int;
    END IF;
  END IF;

  RETURN v_org_code || '-WTI-' || v_year::text || '-' || lpad((v_last_seq + 1)::text, 4, '0');
END;
$$;

ALTER FUNCTION public.generate_worker_tax_invoice_number(uuid) OWNER TO postgres;
GRANT ALL ON FUNCTION public.generate_worker_tax_invoice_number(uuid) TO anon;
GRANT ALL ON FUNCTION public.generate_worker_tax_invoice_number(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.generate_worker_tax_invoice_number(uuid) TO service_role;

ALTER TABLE public.worker_tax_invoice ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_tax_invoice_line ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage worker_tax_invoice" ON public.worker_tax_invoice;
CREATE POLICY "Service role can manage worker_tax_invoice"
  ON public.worker_tax_invoice FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage worker_tax_invoice_line" ON public.worker_tax_invoice_line;
CREATE POLICY "Service role can manage worker_tax_invoice_line"
  ON public.worker_tax_invoice_line FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
