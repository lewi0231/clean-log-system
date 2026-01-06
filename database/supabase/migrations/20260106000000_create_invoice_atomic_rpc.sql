-- -*- mode: sql; sql-product: postgres -*-
-- Atomic invoice creation helpers
-- Creates invoice + invoice_job + pricing_snapshot in a single transaction to avoid partial writes.

-- Generate invoice numbers safely under concurrency (per org/year).
create or replace function public.generate_invoice_number(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_code text;
  v_year int;
  v_last_invoice_number text;
  v_last_seq int := 0;
  v_match text[];
begin
  select org_code into v_org_code
  from organization
  where id = p_organization_id;

  if v_org_code is null then
    raise exception 'Organization not found';
  end if;

  v_year := extract(year from now())::int;

  -- Prevent concurrent callers from generating the same invoice number
  perform pg_advisory_xact_lock(hashtext(p_organization_id::text || ':' || v_year::text));

  select invoice_number into v_last_invoice_number
  from invoice
  where organization_id = p_organization_id
    and invoice_number like (v_org_code || '-' || v_year::text || '-%')
  order by invoice_number desc
  limit 1;

  if v_last_invoice_number is not null then
    v_match := regexp_match(v_last_invoice_number, '-(\d+)$');
    if v_match is not null and array_length(v_match, 1) >= 1 then
      v_last_seq := v_match[1]::int;
    end if;
  end if;

  return v_org_code || '-' || v_year::text || '-' || lpad((v_last_seq + 1)::text, 4, '0');
end;
$$;

-- Create invoice and related rows atomically.
create or replace function public.create_invoice_atomic(
  p_organization_id uuid,
  p_job_ids uuid[],
  p_due_date timestamptz,
  p_notes text,
  p_subtotal numeric,
  p_total numeric,
  p_currency text,
  p_status text,
  p_snapshot_records jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_invoice_number text;
begin
  v_invoice_number := public.generate_invoice_number(p_organization_id);

  insert into invoice (
    organization_id,
    invoice_number,
    status,
    subtotal,
    total,
    currency,
    due_date,
    notes,
    sent_at
  ) values (
    p_organization_id,
    v_invoice_number,
    p_status,
    p_subtotal,
    p_total,
    p_currency,
    p_due_date,
    nullif(p_notes, ''),
    case when p_status = 'sent' then now() else null end
  )
  returning id into v_invoice_id;

  -- Link invoice to jobs (DB constraint should prevent double-invoicing a job)
  insert into invoice_job (invoice_id, job_id)
  select v_invoice_id, unnest(p_job_ids);

  -- Persist pricing snapshots (optional)
  if p_snapshot_records is not null and jsonb_typeof(p_snapshot_records) = 'array' and jsonb_array_length(p_snapshot_records) > 0 then
    insert into pricing_snapshot (
      organization_id,
      invoice_id,
      job_id,
      pricing_rule_id,
      field_config_id,
      line_item_key,
      snapshot_data
    )
    select
      p_organization_id,
      v_invoice_id,
      (elem->>'job_id')::uuid,
      nullif(elem->>'pricing_rule_id', '')::uuid,
      nullif(elem->>'field_config_id', '')::uuid,
      nullif(elem->>'line_item_key', ''),
      coalesce(elem->'snapshot_data', '{}'::jsonb)
    from jsonb_array_elements(p_snapshot_records) as elem
    where elem ? 'job_id';
  end if;

  return v_invoice_id;
end;
$$;

