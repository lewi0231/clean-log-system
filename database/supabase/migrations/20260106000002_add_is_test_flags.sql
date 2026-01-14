-- -*- mode: sql; sql-product: postgres -*-
-- First-class flags for test data to avoid relying on JSON fields.

alter table job
  add column if not exists is_test boolean not null default false;

alter table invoice
  add column if not exists is_test boolean not null default false;

create index if not exists idx_job_org_completed_not_test
on job(organization_id, completed_at desc)
where is_test = false;

create index if not exists idx_invoice_org_created_not_test
on invoice(organization_id, created_at desc)
where is_test = false;

comment on column job.is_test is 'True for jobs created for test/preview purposes (should be excluded from normal operations)';
comment on column invoice.is_test is 'True for invoices created for test/preview purposes (should not be sent to customers)';

