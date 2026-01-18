-- -*- mode: sql; sql-product: postgres -*-
-- Transactional-ish outbox for invoice sending (audit + retries)

create table if not exists invoice_send_outbox (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoice(id) on delete cascade not null,
  organization_id uuid references organization(id) on delete cascade not null,
  resend boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed')),
  attempts int not null default 0,
  last_error text,
  recipients jsonb,
  email_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  next_retry_at timestamptz
);

create index if not exists idx_invoice_send_outbox_status_next_retry
on invoice_send_outbox(status, next_retry_at)
where status in ('pending', 'failed');

create index if not exists idx_invoice_send_outbox_invoice
on invoice_send_outbox(invoice_id);

comment on table invoice_send_outbox is 'Outbox records for invoice send attempts; supports audit and retry.';

