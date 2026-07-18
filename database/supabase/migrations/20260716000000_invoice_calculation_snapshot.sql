-- -*- mode: sql; sql-product: postgres -*-
-- Persist full calculation at invoice creation so PDF/preview match sent amounts
-- even if pricing rules change later. Also extend create_invoice_atomic.

alter table public.invoice
  add column if not exists calculation_snapshot jsonb;

comment on column public.invoice.calculation_snapshot is
  'Immutable calculate-invoice payload stored at creation time for PDF/preview fidelity.';

-- Migrate deprecated email recipient source on existing template configs
update public.invoice_template_config
set email_recipient_config = jsonb_set(
  email_recipient_config,
  '{location_email_source}',
  '"location_email"'::jsonb,
  true
)
where email_recipient_config->>'location_email_source' = 'location_contact_email';

create or replace function public.create_invoice_atomic(
  p_organization_id uuid,
  p_job_ids uuid[],
  p_due_date timestamptz,
  p_notes text,
  p_subtotal numeric,
  p_total numeric,
  p_currency text,
  p_status text,
  p_snapshot_records jsonb default '[]'::jsonb,
  p_calculation_snapshot jsonb default null
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
    sent_at,
    calculation_snapshot
  ) values (
    p_organization_id,
    v_invoice_number,
    p_status,
    p_subtotal,
    p_total,
    p_currency::currency_code,
    p_due_date,
    nullif(p_notes, ''),
    case when p_status = 'sent' then now() else null end,
    p_calculation_snapshot
  )
  returning id into v_invoice_id;

  insert into invoice_job (invoice_id, job_id)
  select v_invoice_id, unnest(p_job_ids);

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
