drop trigger if exists "update_form_section_updated_at" on "public"."form_section";

drop trigger if exists "update_location_hierarchy_updated_at" on "public"."location_hierarchy";

drop trigger if exists "trg_pricing_condition_audit" on "public"."pricing_condition";

drop trigger if exists "update_pricing_condition_updated_at" on "public"."pricing_condition";

drop trigger if exists "trg_pricing_rule_audit" on "public"."pricing_rule";

drop trigger if exists "update_pricing_rule_updated_at" on "public"."pricing_rule";

drop trigger if exists "update_worker_payment_updated_at" on "public"."worker_payment";

drop trigger if exists "update_worker_payment_batch_updated_at" on "public"."worker_payment_batch";

drop policy "Anyone can submit feedback" on "public"."feedback";

drop policy "Users can create sections for their organization" on "public"."form_section";

drop policy "Users can delete their organization's sections" on "public"."form_section";

drop policy "Users can update their organization's sections" on "public"."form_section";

drop policy "Users can view their organization's sections" on "public"."form_section";

alter table "public"."base_pricing" drop constraint "base_pricing_job_type_field_config_id_fkey";

alter table "public"."base_pricing" drop constraint "base_pricing_location_id_fkey";

alter table "public"."base_pricing" drop constraint "base_pricing_organization_id_fkey";

alter table "public"."feedback" drop constraint "feedback_job_id_fkey";

alter table "public"."field_pricing" drop constraint "field_pricing_field_config_id_fkey";

alter table "public"."field_pricing" drop constraint "field_pricing_location_id_fkey";

alter table "public"."field_pricing" drop constraint "field_pricing_organization_id_fkey";

alter table "public"."form_section" drop constraint "form_section_organization_id_fkey";

alter table "public"."invoice" drop constraint "invoice_organization_id_fkey";

alter table "public"."invoice" drop constraint "invoice_payment_link_id_fkey";

alter table "public"."invoice_job" drop constraint "invoice_job_invoice_id_fkey";

alter table "public"."invoice_job" drop constraint "invoice_job_job_id_fkey";

alter table "public"."invoice_send_outbox" drop constraint "invoice_send_outbox_invoice_id_fkey";

alter table "public"."invoice_send_outbox" drop constraint "invoice_send_outbox_organization_id_fkey";

alter table "public"."invoice_template_config" drop constraint "invoice_template_config_organization_id_fkey";

alter table "public"."job" drop constraint "job_location_id_fkey";

alter table "public"."job" drop constraint "job_organization_id_fkey";

alter table "public"."job_edits" drop constraint "job_edits_job_id_fkey";

alter table "public"."job_worker" drop constraint "job_worker_job_id_fkey";

alter table "public"."job_worker" drop constraint "job_worker_worker_id_fkey";

alter table "public"."location" drop constraint "location_hierarchy_parent_id_fkey1";

alter table "public"."location" drop constraint "location_organization_id_fkey";

alter table "public"."location_field_config" drop constraint "location_field_config_field_config_id_fkey";

alter table "public"."location_field_config" drop constraint "location_field_config_location_id_fkey";

alter table "public"."location_hierarchy" drop constraint "location_hierarchy_organization_id_fkey";

alter table "public"."location_hierarchy" drop constraint "location_hierarchy_parent_id_fkey";

alter table "public"."option_pricing" drop constraint "option_pricing_field_config_id_fkey";

alter table "public"."option_pricing" drop constraint "option_pricing_location_id_fkey";

alter table "public"."option_pricing" drop constraint "option_pricing_organization_id_fkey";

alter table "public"."organization_field_configs" drop constraint "organization_field_configs_organization_id_fkey";

alter table "public"."organization_field_configs" drop constraint "organization_field_configs_section_id_fkey";

alter table "public"."organization_settings" drop constraint "organization_settings_organization_id_fkey";

alter table "public"."organization_user" drop constraint "organization_user_organization_id_fkey";

alter table "public"."payment" drop constraint "payment_invoice_id_fkey";

alter table "public"."payment" drop constraint "payment_organization_id_fkey";

alter table "public"."payment" drop constraint "payment_reconciled_by_fkey";

alter table "public"."payment_link" drop constraint "payment_link_invoice_id_fkey";

alter table "public"."payment_link" drop constraint "payment_link_organization_id_fkey";

alter table "public"."pricing_condition" drop constraint "pricing_condition_condition_field_config_id_fkey";

alter table "public"."pricing_condition" drop constraint "pricing_condition_pricing_rule_id_fkey";

alter table "public"."pricing_rule" drop constraint "pricing_rule_field_config_id_fkey";

alter table "public"."pricing_rule" drop constraint "pricing_rule_location_hierarchy_id_fkey";

alter table "public"."pricing_rule" drop constraint "pricing_rule_location_id_fkey";

alter table "public"."pricing_rule" drop constraint "pricing_rule_organization_id_fkey";

alter table "public"."pricing_snapshot" drop constraint "pricing_snapshot_field_config_id_fkey";

alter table "public"."pricing_snapshot" drop constraint "pricing_snapshot_invoice_id_fkey";

alter table "public"."pricing_snapshot" drop constraint "pricing_snapshot_job_id_fkey";

alter table "public"."pricing_snapshot" drop constraint "pricing_snapshot_organization_id_fkey";

alter table "public"."pricing_snapshot" drop constraint "pricing_snapshot_pricing_rule_id_fkey";

alter table "public"."service_pricing_mode" drop constraint "service_pricing_mode_location_id_fkey";

alter table "public"."service_pricing_mode" drop constraint "service_pricing_mode_organization_id_fkey";

alter table "public"."service_pricing_mode" drop constraint "service_pricing_mode_service_type_field_config_id_fkey";

alter table "public"."worker" drop constraint "worker_organization_id_fkey";

alter table "public"."worker_invitation" drop constraint "worker_invitation_organization_id_fkey";

alter table "public"."worker_invitation" drop constraint "worker_invitation_worker_id_fkey";

alter table "public"."worker_payment" drop constraint "worker_payment_batch_id_fkey";

alter table "public"."worker_payment" drop constraint "worker_payment_job_id_fkey";

alter table "public"."worker_payment" drop constraint "worker_payment_organization_id_fkey";

alter table "public"."worker_payment" drop constraint "worker_payment_paid_by_fkey";

alter table "public"."worker_payment" drop constraint "worker_payment_worker_id_fkey";

alter table "public"."worker_payment_batch" drop constraint "worker_payment_batch_calculated_by_fkey";

alter table "public"."worker_payment_batch" drop constraint "worker_payment_batch_organization_id_fkey";

drop view if exists "public"."job_summary";

alter table "public"."base_pricing" alter column "currency" set default 'USD'::public.currency_code;

alter table "public"."base_pricing" alter column "currency" set data type public.currency_code using "currency"::text::public.currency_code;

alter table "public"."field_pricing" alter column "currency" set default 'USD'::public.currency_code;

alter table "public"."field_pricing" alter column "currency" set data type public.currency_code using "currency"::text::public.currency_code;

alter table "public"."invoice" alter column "currency" set default 'USD'::public.currency_code;

alter table "public"."invoice" alter column "currency" set data type public.currency_code using "currency"::text::public.currency_code;

alter table "public"."job_edits" alter column "id" set default nextval('public.job_edits_id_seq'::regclass);

alter table "public"."location" alter column "fixed_price_currency" set default 'USD'::public.currency_code;

alter table "public"."location" alter column "fixed_price_currency" set data type public.currency_code using "fixed_price_currency"::text::public.currency_code;

alter table "public"."option_pricing" alter column "currency" set default 'USD'::public.currency_code;

alter table "public"."option_pricing" alter column "currency" set data type public.currency_code using "currency"::text::public.currency_code;

alter table "public"."organization" alter column "currency" set default 'AUD'::public.currency_code;

alter table "public"."organization" alter column "currency" set data type public.currency_code using "currency"::text::public.currency_code;

alter table "public"."pricing_condition" alter column "action_type" set data type public.pricing_action_type using "action_type"::text::public.pricing_action_type;

alter table "public"."pricing_condition" alter column "operator" set data type public.pricing_condition_operator using "operator"::text::public.pricing_condition_operator;

alter table "public"."pricing_condition_audit" alter column "id" set default nextval('public.pricing_condition_audit_id_seq'::regclass);

alter table "public"."pricing_rule" alter column "currency" set default 'USD'::public.currency_code;

alter table "public"."pricing_rule" alter column "currency" set data type public.currency_code using "currency"::text::public.currency_code;

alter table "public"."pricing_rule" alter column "pricing_type" set data type public.pricing_type_enum using "pricing_type"::text::public.pricing_type_enum;

alter table "public"."pricing_rule" alter column "scope" set data type public.pricing_scope using "scope"::text::public.pricing_scope;

alter table "public"."pricing_rule_audit" alter column "id" set default nextval('public.pricing_rule_audit_id_seq'::regclass);

alter table "public"."service_pricing_mode" alter column "fixed_price_currency" set default 'USD'::public.currency_code;

alter table "public"."service_pricing_mode" alter column "fixed_price_currency" set data type public.currency_code using "fixed_price_currency"::text::public.currency_code;

alter table "public"."base_pricing" add constraint "base_pricing_job_type_field_config_id_fkey" FOREIGN KEY (job_type_field_config_id) REFERENCES public.organization_field_configs(id) ON DELETE CASCADE not valid;

alter table "public"."base_pricing" validate constraint "base_pricing_job_type_field_config_id_fkey";

alter table "public"."base_pricing" add constraint "base_pricing_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.location(id) ON DELETE CASCADE not valid;

alter table "public"."base_pricing" validate constraint "base_pricing_location_id_fkey";

alter table "public"."base_pricing" add constraint "base_pricing_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."base_pricing" validate constraint "base_pricing_organization_id_fkey";

alter table "public"."feedback" add constraint "feedback_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.job(id) not valid;

alter table "public"."feedback" validate constraint "feedback_job_id_fkey";

alter table "public"."field_pricing" add constraint "field_pricing_field_config_id_fkey" FOREIGN KEY (field_config_id) REFERENCES public.organization_field_configs(id) ON DELETE CASCADE not valid;

alter table "public"."field_pricing" validate constraint "field_pricing_field_config_id_fkey";

alter table "public"."field_pricing" add constraint "field_pricing_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.location(id) ON DELETE CASCADE not valid;

alter table "public"."field_pricing" validate constraint "field_pricing_location_id_fkey";

alter table "public"."field_pricing" add constraint "field_pricing_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."field_pricing" validate constraint "field_pricing_organization_id_fkey";

alter table "public"."form_section" add constraint "form_section_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."form_section" validate constraint "form_section_organization_id_fkey";

alter table "public"."invoice" add constraint "invoice_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."invoice" validate constraint "invoice_organization_id_fkey";

alter table "public"."invoice" add constraint "invoice_payment_link_id_fkey" FOREIGN KEY (payment_link_id) REFERENCES public.payment_link(id) not valid;

alter table "public"."invoice" validate constraint "invoice_payment_link_id_fkey";

alter table "public"."invoice_job" add constraint "invoice_job_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES public.invoice(id) ON DELETE CASCADE not valid;

alter table "public"."invoice_job" validate constraint "invoice_job_invoice_id_fkey";

alter table "public"."invoice_job" add constraint "invoice_job_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.job(id) ON DELETE CASCADE not valid;

alter table "public"."invoice_job" validate constraint "invoice_job_job_id_fkey";

alter table "public"."invoice_send_outbox" add constraint "invoice_send_outbox_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES public.invoice(id) ON DELETE CASCADE not valid;

alter table "public"."invoice_send_outbox" validate constraint "invoice_send_outbox_invoice_id_fkey";

alter table "public"."invoice_send_outbox" add constraint "invoice_send_outbox_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."invoice_send_outbox" validate constraint "invoice_send_outbox_organization_id_fkey";

alter table "public"."invoice_template_config" add constraint "invoice_template_config_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."invoice_template_config" validate constraint "invoice_template_config_organization_id_fkey";

alter table "public"."job" add constraint "job_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.location(id) not valid;

alter table "public"."job" validate constraint "job_location_id_fkey";

alter table "public"."job" add constraint "job_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."job" validate constraint "job_organization_id_fkey";

alter table "public"."job_edits" add constraint "job_edits_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.job(id) ON DELETE CASCADE not valid;

alter table "public"."job_edits" validate constraint "job_edits_job_id_fkey";

alter table "public"."job_worker" add constraint "job_worker_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.job(id) ON DELETE CASCADE not valid;

alter table "public"."job_worker" validate constraint "job_worker_job_id_fkey";

alter table "public"."job_worker" add constraint "job_worker_worker_id_fkey" FOREIGN KEY (worker_id) REFERENCES public.worker(id) ON DELETE CASCADE not valid;

alter table "public"."job_worker" validate constraint "job_worker_worker_id_fkey";

alter table "public"."location" add constraint "location_hierarchy_parent_id_fkey1" FOREIGN KEY (hierarchy_parent_id) REFERENCES public.location_hierarchy(id) ON DELETE SET NULL not valid;

alter table "public"."location" validate constraint "location_hierarchy_parent_id_fkey1";

alter table "public"."location" add constraint "location_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."location" validate constraint "location_organization_id_fkey";

alter table "public"."location_field_config" add constraint "location_field_config_field_config_id_fkey" FOREIGN KEY (field_config_id) REFERENCES public.organization_field_configs(id) ON DELETE CASCADE not valid;

alter table "public"."location_field_config" validate constraint "location_field_config_field_config_id_fkey";

alter table "public"."location_field_config" add constraint "location_field_config_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.location(id) ON DELETE CASCADE not valid;

alter table "public"."location_field_config" validate constraint "location_field_config_location_id_fkey";

alter table "public"."location_hierarchy" add constraint "location_hierarchy_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."location_hierarchy" validate constraint "location_hierarchy_organization_id_fkey";

alter table "public"."location_hierarchy" add constraint "location_hierarchy_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES public.location_hierarchy(id) ON DELETE CASCADE not valid;

alter table "public"."location_hierarchy" validate constraint "location_hierarchy_parent_id_fkey";

alter table "public"."option_pricing" add constraint "option_pricing_field_config_id_fkey" FOREIGN KEY (field_config_id) REFERENCES public.organization_field_configs(id) ON DELETE CASCADE not valid;

alter table "public"."option_pricing" validate constraint "option_pricing_field_config_id_fkey";

alter table "public"."option_pricing" add constraint "option_pricing_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.location(id) ON DELETE CASCADE not valid;

alter table "public"."option_pricing" validate constraint "option_pricing_location_id_fkey";

alter table "public"."option_pricing" add constraint "option_pricing_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."option_pricing" validate constraint "option_pricing_organization_id_fkey";

alter table "public"."organization_field_configs" add constraint "organization_field_configs_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."organization_field_configs" validate constraint "organization_field_configs_organization_id_fkey";

alter table "public"."organization_field_configs" add constraint "organization_field_configs_section_id_fkey" FOREIGN KEY (section_id) REFERENCES public.form_section(id) ON DELETE SET NULL not valid;

alter table "public"."organization_field_configs" validate constraint "organization_field_configs_section_id_fkey";

alter table "public"."organization_settings" add constraint "organization_settings_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."organization_settings" validate constraint "organization_settings_organization_id_fkey";

alter table "public"."organization_user" add constraint "organization_user_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."organization_user" validate constraint "organization_user_organization_id_fkey";

alter table "public"."payment" add constraint "payment_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES public.invoice(id) ON DELETE SET NULL not valid;

alter table "public"."payment" validate constraint "payment_invoice_id_fkey";

alter table "public"."payment" add constraint "payment_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."payment" validate constraint "payment_organization_id_fkey";

alter table "public"."payment" add constraint "payment_reconciled_by_fkey" FOREIGN KEY (reconciled_by) REFERENCES public.organization_user(id) not valid;

alter table "public"."payment" validate constraint "payment_reconciled_by_fkey";

alter table "public"."payment_link" add constraint "payment_link_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES public.invoice(id) ON DELETE CASCADE not valid;

alter table "public"."payment_link" validate constraint "payment_link_invoice_id_fkey";

alter table "public"."payment_link" add constraint "payment_link_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."payment_link" validate constraint "payment_link_organization_id_fkey";

alter table "public"."pricing_condition" add constraint "pricing_condition_condition_field_config_id_fkey" FOREIGN KEY (condition_field_config_id) REFERENCES public.organization_field_configs(id) ON DELETE CASCADE not valid;

alter table "public"."pricing_condition" validate constraint "pricing_condition_condition_field_config_id_fkey";

alter table "public"."pricing_condition" add constraint "pricing_condition_pricing_rule_id_fkey" FOREIGN KEY (pricing_rule_id) REFERENCES public.pricing_rule(id) ON DELETE CASCADE not valid;

alter table "public"."pricing_condition" validate constraint "pricing_condition_pricing_rule_id_fkey";

alter table "public"."pricing_rule" add constraint "pricing_rule_field_config_id_fkey" FOREIGN KEY (field_config_id) REFERENCES public.organization_field_configs(id) ON DELETE CASCADE not valid;

alter table "public"."pricing_rule" validate constraint "pricing_rule_field_config_id_fkey";

alter table "public"."pricing_rule" add constraint "pricing_rule_location_hierarchy_id_fkey" FOREIGN KEY (location_hierarchy_id) REFERENCES public.location_hierarchy(id) ON DELETE CASCADE not valid;

alter table "public"."pricing_rule" validate constraint "pricing_rule_location_hierarchy_id_fkey";

alter table "public"."pricing_rule" add constraint "pricing_rule_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.location(id) ON DELETE CASCADE not valid;

alter table "public"."pricing_rule" validate constraint "pricing_rule_location_id_fkey";

alter table "public"."pricing_rule" add constraint "pricing_rule_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."pricing_rule" validate constraint "pricing_rule_organization_id_fkey";

alter table "public"."pricing_snapshot" add constraint "pricing_snapshot_field_config_id_fkey" FOREIGN KEY (field_config_id) REFERENCES public.organization_field_configs(id) ON DELETE SET NULL not valid;

alter table "public"."pricing_snapshot" validate constraint "pricing_snapshot_field_config_id_fkey";

alter table "public"."pricing_snapshot" add constraint "pricing_snapshot_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES public.invoice(id) ON DELETE CASCADE not valid;

alter table "public"."pricing_snapshot" validate constraint "pricing_snapshot_invoice_id_fkey";

alter table "public"."pricing_snapshot" add constraint "pricing_snapshot_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.job(id) ON DELETE SET NULL not valid;

alter table "public"."pricing_snapshot" validate constraint "pricing_snapshot_job_id_fkey";

alter table "public"."pricing_snapshot" add constraint "pricing_snapshot_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."pricing_snapshot" validate constraint "pricing_snapshot_organization_id_fkey";

alter table "public"."pricing_snapshot" add constraint "pricing_snapshot_pricing_rule_id_fkey" FOREIGN KEY (pricing_rule_id) REFERENCES public.pricing_rule(id) ON DELETE SET NULL not valid;

alter table "public"."pricing_snapshot" validate constraint "pricing_snapshot_pricing_rule_id_fkey";

alter table "public"."service_pricing_mode" add constraint "service_pricing_mode_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.location(id) ON DELETE CASCADE not valid;

alter table "public"."service_pricing_mode" validate constraint "service_pricing_mode_location_id_fkey";

alter table "public"."service_pricing_mode" add constraint "service_pricing_mode_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."service_pricing_mode" validate constraint "service_pricing_mode_organization_id_fkey";

alter table "public"."service_pricing_mode" add constraint "service_pricing_mode_service_type_field_config_id_fkey" FOREIGN KEY (service_type_field_config_id) REFERENCES public.organization_field_configs(id) ON DELETE CASCADE not valid;

alter table "public"."service_pricing_mode" validate constraint "service_pricing_mode_service_type_field_config_id_fkey";

alter table "public"."worker" add constraint "worker_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."worker" validate constraint "worker_organization_id_fkey";

alter table "public"."worker_invitation" add constraint "worker_invitation_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."worker_invitation" validate constraint "worker_invitation_organization_id_fkey";

alter table "public"."worker_invitation" add constraint "worker_invitation_worker_id_fkey" FOREIGN KEY (worker_id) REFERENCES public.worker(id) ON DELETE CASCADE not valid;

alter table "public"."worker_invitation" validate constraint "worker_invitation_worker_id_fkey";

alter table "public"."worker_payment" add constraint "worker_payment_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES public.worker_payment_batch(id) ON DELETE SET NULL not valid;

alter table "public"."worker_payment" validate constraint "worker_payment_batch_id_fkey";

alter table "public"."worker_payment" add constraint "worker_payment_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.job(id) ON DELETE CASCADE not valid;

alter table "public"."worker_payment" validate constraint "worker_payment_job_id_fkey";

alter table "public"."worker_payment" add constraint "worker_payment_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."worker_payment" validate constraint "worker_payment_organization_id_fkey";

alter table "public"."worker_payment" add constraint "worker_payment_paid_by_fkey" FOREIGN KEY (paid_by) REFERENCES public.organization_user(id) not valid;

alter table "public"."worker_payment" validate constraint "worker_payment_paid_by_fkey";

alter table "public"."worker_payment" add constraint "worker_payment_worker_id_fkey" FOREIGN KEY (worker_id) REFERENCES public.worker(id) ON DELETE CASCADE not valid;

alter table "public"."worker_payment" validate constraint "worker_payment_worker_id_fkey";

alter table "public"."worker_payment_batch" add constraint "worker_payment_batch_calculated_by_fkey" FOREIGN KEY (calculated_by) REFERENCES public.organization_user(id) not valid;

alter table "public"."worker_payment_batch" validate constraint "worker_payment_batch_calculated_by_fkey";

alter table "public"."worker_payment_batch" add constraint "worker_payment_batch_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."worker_payment_batch" validate constraint "worker_payment_batch_organization_id_fkey";

create or replace view "public"."job_summary" as  SELECT cj.id AS job_id,
    cj.organization_id,
    o.name AS organization_name,
    w.name AS worker_name,
    w.id AS worker_id,
    l.name AS location_name,
    cj.completed_at,
    f.rating,
    f.comment
   FROM (((((public.job cj
     JOIN public.organization o ON ((cj.organization_id = o.id)))
     JOIN public.job_worker jw ON ((cj.id = jw.job_id)))
     JOIN public.worker w ON ((jw.worker_id = w.id)))
     LEFT JOIN public.location l ON ((cj.location_id = l.id)))
     LEFT JOIN public.feedback f ON ((cj.id = f.job_id)))
  ORDER BY cj.completed_at DESC;



  create policy "Anyone can submit feedback"
  on "public"."feedback"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.job
  WHERE ((job.id = feedback.job_id) AND (job.feedback_token IS NOT NULL)))));



  create policy "Users can create sections for their organization"
  on "public"."form_section"
  as permissive
  for insert
  to authenticated
with check ((organization_id IN ( SELECT worker.organization_id
   FROM public.worker
  WHERE (worker.auth_user_id = auth.uid()))));



  create policy "Users can delete their organization's sections"
  on "public"."form_section"
  as permissive
  for delete
  to authenticated
using ((organization_id IN ( SELECT worker.organization_id
   FROM public.worker
  WHERE (worker.auth_user_id = auth.uid()))));



  create policy "Users can update their organization's sections"
  on "public"."form_section"
  as permissive
  for update
  to authenticated
using ((organization_id IN ( SELECT worker.organization_id
   FROM public.worker
  WHERE (worker.auth_user_id = auth.uid()))))
with check ((organization_id IN ( SELECT worker.organization_id
   FROM public.worker
  WHERE (worker.auth_user_id = auth.uid()))));



  create policy "Users can view their organization's sections"
  on "public"."form_section"
  as permissive
  for select
  to authenticated
using ((organization_id IN ( SELECT worker.organization_id
   FROM public.worker
  WHERE (worker.auth_user_id = auth.uid()))));


CREATE TRIGGER update_form_section_updated_at BEFORE UPDATE ON public.form_section FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_location_hierarchy_updated_at BEFORE UPDATE ON public.location_hierarchy FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_pricing_condition_audit AFTER INSERT OR DELETE OR UPDATE ON public.pricing_condition FOR EACH ROW EXECUTE FUNCTION public.log_pricing_condition_change();

CREATE TRIGGER update_pricing_condition_updated_at BEFORE UPDATE ON public.pricing_condition FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_pricing_rule_audit AFTER INSERT OR DELETE OR UPDATE ON public.pricing_rule FOR EACH ROW EXECUTE FUNCTION public.log_pricing_rule_change();

CREATE TRIGGER update_pricing_rule_updated_at BEFORE UPDATE ON public.pricing_rule FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_worker_payment_updated_at BEFORE UPDATE ON public.worker_payment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_worker_payment_batch_updated_at BEFORE UPDATE ON public.worker_payment_batch FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


