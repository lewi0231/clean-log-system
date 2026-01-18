-- -*- mode: sql; sql-product: postgres -*-
-- Ensure each job can only be invoiced once.

create unique index if not exists idx_invoice_job_job_id_unique
on invoice_job(job_id);

