drop extension if exists "pg_net";

drop trigger if exists "trg_pricing_condition_audit" on "public"."pricing_condition";

drop trigger if exists "trg_pricing_rule_audit" on "public"."pricing_rule";

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

alter table "public"."invoice_job" drop constraint "invoice_job_invoice_id_fkey";

alter table "public"."invoice_job" drop constraint "invoice_job_job_id_fkey";

alter table "public"."invoice_template_config" drop constraint "invoice_template_config_organization_id_fkey";

alter table "public"."job" drop constraint "job_location_id_fkey";

alter table "public"."job" drop constraint "job_organization_id_fkey";

alter table "public"."job_worker" drop constraint "job_worker_job_id_fkey";

alter table "public"."job_worker" drop constraint "job_worker_worker_id_fkey";

alter table "public"."location" drop constraint "car_yard_organization_id_fkey";

alter table "public"."location" drop constraint "location_hierarchy_parent_id_fkey1";

alter table "public"."location_hierarchy" drop constraint "location_hierarchy_organization_id_fkey";

alter table "public"."location_hierarchy" drop constraint "location_hierarchy_parent_id_fkey";

alter table "public"."option_pricing" drop constraint "option_pricing_field_config_id_fkey";

alter table "public"."option_pricing" drop constraint "option_pricing_location_id_fkey";

alter table "public"."option_pricing" drop constraint "option_pricing_organization_id_fkey";

alter table "public"."organization_field_configs" drop constraint "organization_field_configs_organization_id_fkey";

alter table "public"."organization_field_configs" drop constraint "organization_field_configs_section_id_fkey";

alter table "public"."organization_user" drop constraint "organization_user_organization_id_fkey";

alter table "public"."pricing_condition" drop constraint "pricing_condition_condition_field_config_id_fkey";

alter table "public"."pricing_condition" drop constraint "pricing_condition_pricing_rule_id_fkey";

alter table "public"."pricing_rule" drop constraint "pricing_rule_field_config_id_fkey";

alter table "public"."pricing_rule" drop constraint "pricing_rule_location_hierarchy_id_fkey";

alter table "public"."pricing_rule" drop constraint "pricing_rule_location_id_fkey";

alter table "public"."pricing_rule" drop constraint "pricing_rule_organization_id_fkey";

alter table "public"."pricing_rules" drop constraint "pricing_rules_condition_field_config_id_fkey";

alter table "public"."pricing_rules" drop constraint "pricing_rules_location_id_fkey";

alter table "public"."pricing_rules" drop constraint "pricing_rules_organization_id_fkey";

alter table "public"."pricing_snapshot" drop constraint "pricing_snapshot_field_config_id_fkey";

alter table "public"."pricing_snapshot" drop constraint "pricing_snapshot_invoice_id_fkey";

alter table "public"."pricing_snapshot" drop constraint "pricing_snapshot_job_id_fkey";

alter table "public"."pricing_snapshot" drop constraint "pricing_snapshot_organization_id_fkey";

alter table "public"."pricing_snapshot" drop constraint "pricing_snapshot_pricing_rule_id_fkey";

alter table "public"."worker" drop constraint "worker_organization_id_fkey";

alter table "public"."worker_invitation" drop constraint "worker_invitation_organization_id_fkey";

alter table "public"."worker_invitation" drop constraint "worker_invitation_worker_id_fkey";

alter table "public"."pricing_condition" alter column "action_type" set data type public.pricing_action_type using "action_type"::text::public.pricing_action_type;

alter table "public"."pricing_condition" alter column "operator" set data type public.pricing_condition_operator using "operator"::text::public.pricing_condition_operator;

alter table "public"."pricing_condition_audit" alter column "id" set default nextval('public.pricing_condition_audit_id_seq'::regclass);

alter table "public"."pricing_rule" alter column "pricing_type" set data type public.pricing_type_enum using "pricing_type"::text::public.pricing_type_enum;

alter table "public"."pricing_rule" alter column "scope" set data type public.pricing_scope using "scope"::text::public.pricing_scope;

alter table "public"."pricing_rule_audit" alter column "id" set default nextval('public.pricing_rule_audit_id_seq'::regclass);

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

alter table "public"."invoice_job" add constraint "invoice_job_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES public.invoice(id) ON DELETE CASCADE not valid;

alter table "public"."invoice_job" validate constraint "invoice_job_invoice_id_fkey";

alter table "public"."invoice_job" add constraint "invoice_job_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.job(id) ON DELETE CASCADE not valid;

alter table "public"."invoice_job" validate constraint "invoice_job_job_id_fkey";

alter table "public"."invoice_template_config" add constraint "invoice_template_config_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."invoice_template_config" validate constraint "invoice_template_config_organization_id_fkey";

alter table "public"."job" add constraint "job_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.location(id) not valid;

alter table "public"."job" validate constraint "job_location_id_fkey";

alter table "public"."job" add constraint "job_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."job" validate constraint "job_organization_id_fkey";

alter table "public"."job_worker" add constraint "job_worker_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.job(id) ON DELETE CASCADE not valid;

alter table "public"."job_worker" validate constraint "job_worker_job_id_fkey";

alter table "public"."job_worker" add constraint "job_worker_worker_id_fkey" FOREIGN KEY (worker_id) REFERENCES public.worker(id) ON DELETE CASCADE not valid;

alter table "public"."job_worker" validate constraint "job_worker_worker_id_fkey";

alter table "public"."location" add constraint "car_yard_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."location" validate constraint "car_yard_organization_id_fkey";

alter table "public"."location" add constraint "location_hierarchy_parent_id_fkey1" FOREIGN KEY (hierarchy_parent_id) REFERENCES public.location_hierarchy(id) ON DELETE SET NULL not valid;

alter table "public"."location" validate constraint "location_hierarchy_parent_id_fkey1";

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

alter table "public"."organization_user" add constraint "organization_user_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."organization_user" validate constraint "organization_user_organization_id_fkey";

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

alter table "public"."pricing_rules" add constraint "pricing_rules_condition_field_config_id_fkey" FOREIGN KEY (condition_field_config_id) REFERENCES public.organization_field_configs(id) ON DELETE CASCADE not valid;

alter table "public"."pricing_rules" validate constraint "pricing_rules_condition_field_config_id_fkey";

alter table "public"."pricing_rules" add constraint "pricing_rules_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.location(id) ON DELETE CASCADE not valid;

alter table "public"."pricing_rules" validate constraint "pricing_rules_location_id_fkey";

alter table "public"."pricing_rules" add constraint "pricing_rules_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."pricing_rules" validate constraint "pricing_rules_organization_id_fkey";

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

alter table "public"."worker" add constraint "worker_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."worker" validate constraint "worker_organization_id_fkey";

alter table "public"."worker_invitation" add constraint "worker_invitation_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE not valid;

alter table "public"."worker_invitation" validate constraint "worker_invitation_organization_id_fkey";

alter table "public"."worker_invitation" add constraint "worker_invitation_worker_id_fkey" FOREIGN KEY (worker_id) REFERENCES public.worker(id) ON DELETE CASCADE not valid;

alter table "public"."worker_invitation" validate constraint "worker_invitation_worker_id_fkey";

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


CREATE TRIGGER trg_pricing_condition_audit AFTER INSERT OR DELETE OR UPDATE ON public.pricing_condition FOR EACH ROW EXECUTE FUNCTION public.log_pricing_condition_change();

CREATE TRIGGER trg_pricing_rule_audit AFTER INSERT OR DELETE OR UPDATE ON public.pricing_rule FOR EACH ROW EXECUTE FUNCTION public.log_pricing_rule_change();


