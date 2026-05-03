


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."currency_code" AS ENUM (
    'AUD',
    'USD',
    'GBP',
    'EUR',
    'CAD',
    'NZD'
);


ALTER TYPE "public"."currency_code" OWNER TO "postgres";


COMMENT ON TYPE "public"."currency_code" IS 'ISO 4217 currency codes supported by the platform';



CREATE TYPE "public"."pricing_action_type" AS ENUM (
    'add',
    'subtract',
    'multiply',
    'divide',
    'set'
);


ALTER TYPE "public"."pricing_action_type" OWNER TO "postgres";


CREATE TYPE "public"."pricing_condition_operator" AS ENUM (
    'equals',
    'not_equals',
    'greater_than',
    'greater_than_or_equal',
    'less_than',
    'less_than_or_equal',
    'contains'
);


ALTER TYPE "public"."pricing_condition_operator" OWNER TO "postgres";


CREATE TYPE "public"."pricing_scope" AS ENUM (
    'field',
    'option',
    'base',
    'global'
);


ALTER TYPE "public"."pricing_scope" OWNER TO "postgres";


CREATE TYPE "public"."pricing_type_enum" AS ENUM (
    'unit',
    'fixed',
    'tiered',
    'percentage',
    'conditional'
);


ALTER TYPE "public"."pricing_type_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_invoice_atomic"("p_organization_id" "uuid", "p_job_ids" "uuid"[], "p_due_date" timestamp with time zone, "p_notes" "text", "p_subtotal" numeric, "p_total" numeric, "p_currency" "text", "p_status" "text", "p_snapshot_records" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    p_currency::currency_code,  -- Cast text to currency_code enum
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


ALTER FUNCTION "public"."create_invoice_atomic"("p_organization_id" "uuid", "p_job_ids" "uuid"[], "p_due_date" timestamp with time zone, "p_notes" "text", "p_subtotal" numeric, "p_total" numeric, "p_currency" "text", "p_status" "text", "p_snapshot_records" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invoice_number"("p_organization_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."generate_invoice_number"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_pricing_condition_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO pricing_condition_audit (pricing_condition_id, pricing_rule_id, action, old_data)
    VALUES (OLD.id, OLD.pricing_rule_id, TG_OP, to_jsonb(OLD));
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO pricing_condition_audit (pricing_condition_id, pricing_rule_id, action, old_data, new_data)
    VALUES (NEW.id, NEW.pricing_rule_id, TG_OP, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO pricing_condition_audit (pricing_condition_id, pricing_rule_id, action, new_data)
    VALUES (NEW.id, NEW.pricing_rule_id, TG_OP, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."log_pricing_condition_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_pricing_rule_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO pricing_rule_audit (pricing_rule_id, action, old_data)
    VALUES (OLD.id, TG_OP, to_jsonb(OLD));
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO pricing_rule_audit (pricing_rule_id, action, old_data, new_data)
    VALUES (NEW.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO pricing_rule_audit (pricing_rule_id, action, new_data)
    VALUES (NEW.id, TG_OP, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."log_pricing_rule_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."base_pricing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "job_type_field_config_id" "uuid",
    "job_type_value" "text",
    "standalone_base_price" numeric(10,2),
    "customer_base_price" numeric(10,2) NOT NULL,
    "worker_base_payment" numeric(10,2),
    "location_id" "uuid",
    "currency" "public"."currency_code" DEFAULT 'USD'::"public"."currency_code",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "adjustment_type" "text" DEFAULT 'add'::"text",
    CONSTRAINT "base_pricing_adjustment_type_check" CHECK (("adjustment_type" = ANY (ARRAY['add'::"text", 'multiply'::"text"]))),
    CONSTRAINT "base_pricing_customer_base_price_check" CHECK (("customer_base_price" >= (0)::numeric)),
    CONSTRAINT "base_pricing_standalone_base_price_check" CHECK (("standalone_base_price" >= (0)::numeric)),
    CONSTRAINT "base_pricing_type_check" CHECK (((("job_type_field_config_id" IS NULL) AND ("standalone_base_price" IS NOT NULL)) OR (("job_type_field_config_id" IS NOT NULL) AND ("standalone_base_price" IS NULL)))),
    CONSTRAINT "base_pricing_worker_base_payment_check" CHECK (("worker_base_payment" >= (0)::numeric))
);


ALTER TABLE "public"."base_pricing" OWNER TO "postgres";


COMMENT ON TABLE "public"."base_pricing" IS 'Base pricing configuration for job types or standalone services. Supports both field-based (linked to field configs) and standalone pricing.';



COMMENT ON COLUMN "public"."base_pricing"."job_type_field_config_id" IS 'NULL = standalone base pricing, otherwise field-based pricing';



COMMENT ON COLUMN "public"."base_pricing"."job_type_value" IS 'The option value from select field (for field-based) or descriptive name (for standalone)';



COMMENT ON COLUMN "public"."base_pricing"."standalone_base_price" IS 'Base price for standalone pricing (mutually exclusive with job_type_field_config_id)';



COMMENT ON COLUMN "public"."base_pricing"."customer_base_price" IS 'Base price charged to customer';



COMMENT ON COLUMN "public"."base_pricing"."worker_base_payment" IS 'Base payment to worker (can be different from customer price)';



COMMENT ON COLUMN "public"."base_pricing"."location_id" IS 'NULL = organization default, otherwise location-specific override';



COMMENT ON COLUMN "public"."base_pricing"."adjustment_type" IS 'add: add customer_base_price to invoice, multiply: multiply invoice by customer_base_price (as multiplier)';



CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "rating" integer,
    "comment" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "ratings" "jsonb",
    CONSTRAINT "feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


COMMENT ON COLUMN "public"."feedback"."ratings" IS 'JSONB object storing dimension-based ratings. Format: {"overall": 5, "quality": 4, "communication": 5, "value": 4} or {"overall": 5} for single rating mode. The "rating" column remains for backward compatibility and stores the overall rating.';



CREATE TABLE IF NOT EXISTS "public"."field_pricing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "field_config_id" "uuid" NOT NULL,
    "customer_price" numeric(10,2) NOT NULL,
    "currency" "public"."currency_code" DEFAULT 'USD'::"public"."currency_code",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "location_id" "uuid",
    "pricing_type" "text" DEFAULT 'unit'::"text",
    "applies_to_field_type" "text",
    "worker_payment_type" "text",
    "worker_payment_value" numeric(10,2),
    CONSTRAINT "field_pricing_pricing_type_check" CHECK (("pricing_type" = ANY (ARRAY['unit'::"text", 'fixed'::"text"]))),
    CONSTRAINT "field_pricing_unit_price_check" CHECK (("customer_price" >= (0)::numeric)),
    CONSTRAINT "field_pricing_worker_payment_type_check" CHECK (("worker_payment_type" = ANY (ARRAY['same_structure'::"text", 'percentage'::"text", 'fixed_rate'::"text"]))),
    CONSTRAINT "field_pricing_worker_payment_value_check" CHECK (("worker_payment_value" >= (0)::numeric))
);


ALTER TABLE "public"."field_pricing" OWNER TO "postgres";


COMMENT ON TABLE "public"."field_pricing" IS 'Per-unit or fixed pricing rules for field configurations. Can be organization-wide or location-specific.';



COMMENT ON COLUMN "public"."field_pricing"."pricing_type" IS 'unit: multiply by quantity, fixed: one-time charge';



COMMENT ON COLUMN "public"."field_pricing"."applies_to_field_type" IS 'Field type this pricing applies to: number, select, grouped_breakdown, boolean';



COMMENT ON COLUMN "public"."field_pricing"."worker_payment_type" IS 'same_structure: use same pricing rules, percentage: % of customer price, fixed_rate: independent rate';



COMMENT ON COLUMN "public"."field_pricing"."worker_payment_value" IS 'Percentage (0-100) or fixed rate amount depending on worker_payment_type';



CREATE TABLE IF NOT EXISTS "public"."form_section" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "order_position" integer DEFAULT 0 NOT NULL,
    "collapsed_by_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."form_section" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "subtotal" numeric(10,2) NOT NULL,
    "total" numeric(10,2) NOT NULL,
    "currency" "public"."currency_code" DEFAULT 'USD'::"public"."currency_code",
    "due_date" timestamp with time zone NOT NULL,
    "paid_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "payment_link_id" "uuid",
    "stripe_customer_id" "text",
    "bsb" "text",
    "account_number" "text",
    "account_name" "text",
    "total_paid" numeric(10,2) DEFAULT 0,
    "payment_count" integer DEFAULT 0,
    "payment_method_used" "text",
    "sent_at" timestamp with time zone,
    "is_test" boolean DEFAULT false NOT NULL,
    "reminder_count" integer DEFAULT 0,
    "last_reminder_sent_at" timestamp with time zone,
    CONSTRAINT "invoice_reminder_count_non_negative" CHECK (("reminder_count" >= 0)),
    CONSTRAINT "invoice_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'sent'::"text", 'paid'::"text", 'overdue'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "invoice_subtotal_check" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "invoice_total_check" CHECK (("total" >= (0)::numeric))
);


ALTER TABLE "public"."invoice" OWNER TO "postgres";


COMMENT ON TABLE "public"."invoice" IS 'Invoices created from completed jobs with pricing calculations';



COMMENT ON COLUMN "public"."invoice"."invoice_number" IS 'Unique invoice number per organization, format: {ORG_CODE}-{YYYY}-{####}';



COMMENT ON COLUMN "public"."invoice"."status" IS 'Invoice status: draft (manually created, not sent), pending_review (auto-generated, awaiting approval), sent (sent to customer), paid, overdue, or cancelled';



COMMENT ON COLUMN "public"."invoice"."subtotal" IS 'Subtotal before base pricing adjustments';



COMMENT ON COLUMN "public"."invoice"."total" IS 'Final total after all pricing calculations';



COMMENT ON COLUMN "public"."invoice"."payment_link_id" IS 'Reference to Stripe Checkout payment link';



COMMENT ON COLUMN "public"."invoice"."stripe_customer_id" IS 'Stripe customer ID for this invoice';



COMMENT ON COLUMN "public"."invoice"."total_paid" IS 'Sum of all payments received for this invoice';



COMMENT ON COLUMN "public"."invoice"."payment_count" IS 'Number of payments received (supports partial payments)';



COMMENT ON COLUMN "public"."invoice"."payment_method_used" IS 'Payment method used: stripe_checkout, bank_transfer_manual';



COMMENT ON COLUMN "public"."invoice"."sent_at" IS 'Timestamp when the invoice was sent to the customer (email sent)';



COMMENT ON COLUMN "public"."invoice"."is_test" IS 'True for invoices created for test/preview purposes (should not be sent to customers)';



COMMENT ON COLUMN "public"."invoice"."reminder_count" IS 'Number of payment reminder emails sent for this invoice';



COMMENT ON COLUMN "public"."invoice"."last_reminder_sent_at" IS 'Timestamp of when the last payment reminder was sent';



CREATE TABLE IF NOT EXISTS "public"."invoice_job" (
    "invoice_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL
);


ALTER TABLE "public"."invoice_job" OWNER TO "postgres";


COMMENT ON TABLE "public"."invoice_job" IS 'Junction table linking invoices to jobs (one invoice can have multiple jobs)';



CREATE TABLE IF NOT EXISTS "public"."invoice_send_outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "resend" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "recipients" "jsonb",
    "email_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "next_retry_at" timestamp with time zone,
    CONSTRAINT "invoice_send_outbox_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'succeeded'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."invoice_send_outbox" OWNER TO "postgres";


COMMENT ON TABLE "public"."invoice_send_outbox" IS 'Outbox for invoice sending. RLS enabled, service role only.';



CREATE TABLE IF NOT EXISTS "public"."invoice_template_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "line_item_display" "jsonb" DEFAULT '{}'::"jsonb",
    "invoice_title" "text" DEFAULT 'Tax Invoice'::"text",
    "show_logo" boolean DEFAULT true,
    "show_abn" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "bill_to_fields" "jsonb" DEFAULT '[]'::"jsonb",
    "service_address_config" "jsonb" DEFAULT '{"source": "auto", "location_fields": ["name", "address", "contact_person", "email", "phone"]}'::"jsonb",
    "billing_address_config" "jsonb" DEFAULT '{"source": "auto", "enabled": false}'::"jsonb",
    "email_recipient_config" "jsonb"
);


ALTER TABLE "public"."invoice_template_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."invoice_template_config" IS 'Invoice template configuration allowing organizations to customize invoice display';



COMMENT ON COLUMN "public"."invoice_template_config"."line_item_display" IS 'JSONB configuration for line item display formatting';



COMMENT ON COLUMN "public"."invoice_template_config"."invoice_title" IS 'Invoice title displayed on invoice (default: "Tax Invoice")';



COMMENT ON COLUMN "public"."invoice_template_config"."bill_to_fields" IS 'JSONB array of field_config names to display in Bill To section on invoices';



COMMENT ON COLUMN "public"."invoice_template_config"."service_address_config" IS 'JSONB config for service address display: {source: "auto"|"location"|"form_fields", location_fields: ["name", "address", "contact_person", "email", "phone"]}';



COMMENT ON COLUMN "public"."invoice_template_config"."billing_address_config" IS 'JSONB config for billing address display: {enabled: boolean, source: "auto"|"organization"|"hierarchy"|"form_fields"}';



COMMENT ON COLUMN "public"."invoice_template_config"."email_recipient_config" IS 'Email recipient configuration for invoices: {location_email_source: "location_email"|"hierarchy_billing_email"|"location_contact_email", form_field_email: string|null, default_email: string|null}';



CREATE TABLE IF NOT EXISTS "public"."job" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "completed_at" timestamp with time zone DEFAULT "now"(),
    "feedback_token" "text",
    "email_sent" boolean DEFAULT false,
    "email_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "submission_data" "jsonb",
    "feedback_email_sent" boolean DEFAULT false,
    "feedback_email_sent_at" timestamp with time zone,
    "is_test" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."job" OWNER TO "postgres";


COMMENT ON COLUMN "public"."job"."location_id" IS 'Location where job was performed. NULL allowed for legacy jobs or system-generated records.';



COMMENT ON COLUMN "public"."job"."feedback_token" IS 'Unique token for secure feedback submission via public URL. Generated when job is created if feedback_email_send_immediately is enabled.';



COMMENT ON COLUMN "public"."job"."submission_data" IS 'JSONB containing all field values submitted by workers during job completion. Structure matches organization_field_configs structure at time of submission.';



COMMENT ON COLUMN "public"."job"."feedback_email_sent" IS 'Whether feedback request email was sent for this job. Set to true after successful email send.';



COMMENT ON COLUMN "public"."job"."feedback_email_sent_at" IS 'Timestamp when feedback request email was sent. Used for tracking and analytics.';



COMMENT ON COLUMN "public"."job"."is_test" IS 'True for jobs created for test/preview purposes (should be excluded from normal operations)';



CREATE TABLE IF NOT EXISTS "public"."job_edits" (
    "id" bigint NOT NULL,
    "job_id" "uuid" NOT NULL,
    "edited_by_email" "text" NOT NULL,
    "edited_by_user_id" "uuid",
    "action" "text" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "changed_fields" "text"[],
    "changed_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "job_edits_action_check" CHECK (("action" = ANY (ARRAY['UPDATE'::"text", 'DELETE'::"text"])))
);


ALTER TABLE "public"."job_edits" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_edits" IS 'Audit trail for all edits made to completed jobs. Tracks who made changes, when, and what changed.';



COMMENT ON COLUMN "public"."job_edits"."edited_by_email" IS 'Email of the admin user who made the edit';



COMMENT ON COLUMN "public"."job_edits"."edited_by_user_id" IS 'Optional: UUID of the auth user who made the edit';



COMMENT ON COLUMN "public"."job_edits"."old_data" IS 'Snapshot of job data before the edit';



COMMENT ON COLUMN "public"."job_edits"."new_data" IS 'Snapshot of job data after the edit';



COMMENT ON COLUMN "public"."job_edits"."changed_fields" IS 'Array of field names that were changed in this edit';



CREATE SEQUENCE IF NOT EXISTS "public"."job_edits_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."job_edits_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."job_edits_id_seq" OWNED BY "public"."job_edits"."id";



CREATE TABLE IF NOT EXISTS "public"."job_worker" (
    "job_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone
);


ALTER TABLE "public"."job_worker" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_worker" IS 'Many-to-many relationship table linking jobs to assigned workers. A job can have multiple workers, and a worker can be assigned to multiple jobs.';



COMMENT ON COLUMN "public"."job_worker"."start_time" IS 'When this worker started working on the job';



COMMENT ON COLUMN "public"."job_worker"."end_time" IS 'When this worker finished working on the job';



CREATE TABLE IF NOT EXISTS "public"."location" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "address" "text",
    "contact_person" "text",
    "phone" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "hierarchy_parent_id" "uuid",
    "pricing_mode" "text" DEFAULT 'field_based'::"text",
    "fixed_customer_price" numeric(12,4),
    "fixed_worker_payment" numeric(12,4),
    "fixed_price_currency" "public"."currency_code" DEFAULT 'USD'::"public"."currency_code",
    CONSTRAINT "check_location_email_format" CHECK (("email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text")),
    CONSTRAINT "location_fixed_price_check" CHECK ((("pricing_mode" = 'field_based'::"text") OR (("pricing_mode" = 'fixed_price'::"text") AND ("fixed_customer_price" IS NOT NULL)))),
    CONSTRAINT "location_pricing_mode_check" CHECK (("pricing_mode" = ANY (ARRAY['field_based'::"text", 'fixed_price'::"text"])))
);


ALTER TABLE "public"."location" OWNER TO "postgres";


COMMENT ON TABLE "public"."location" IS 'Physical locations (customers/sites) where jobs are performed. Can belong to a location hierarchy node for pricing inheritance.';



COMMENT ON COLUMN "public"."location"."hierarchy_parent_id" IS 'Optional reference to a location_hierarchy node (company or region) for pricing inheritance.';



COMMENT ON COLUMN "public"."location"."pricing_mode" IS 'field_based: pricing calculated from field configs using pricing rules. fixed_price: uses fixed_customer_price regardless of field data.';



COMMENT ON COLUMN "public"."location"."fixed_customer_price" IS 'Fixed price for customer invoicing when pricing_mode is fixed_price. Field config data is still collected for operational purposes.';



COMMENT ON COLUMN "public"."location"."fixed_worker_payment" IS 'Fixed payment amount for workers when pricing_mode is fixed_price. NULL means no worker payment.';



COMMENT ON COLUMN "public"."location"."fixed_price_currency" IS 'Currency for fixed pricing. Defaults to USD.';



CREATE TABLE IF NOT EXISTS "public"."organization" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "org_code" "text" NOT NULL,
    "subdomain" "text",
    "plan" "text" DEFAULT 'basic'::"text",
    "active" boolean DEFAULT true,
    "trial_ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "use_predefined_locations" boolean DEFAULT true,
    "business_mode" "text" DEFAULT 'service_based'::"text",
    "abn" "text",
    "logo_url" "text",
    "primary_contact_email" "text",
    "invoice_send_immediately" boolean DEFAULT false,
    "stripe_account_id" "text",
    "payment_provider" "text",
    "feedback_email_send_immediately" boolean DEFAULT false,
    "currency" "public"."currency_code" DEFAULT 'AUD'::"public"."currency_code",
    "locale" "text" DEFAULT 'en-AU'::"text",
    "default_exclusive_group_label" "text",
    "rating_config" "jsonb" DEFAULT '{"type": "single", "dimensions": ["overall"]}'::"jsonb",
    "onboarding_completed_at" timestamp with time zone,
    "onboarding_data" "jsonb",
    "business_address" "text",
    "primary_contact_phone" "text",
    CONSTRAINT "organization_business_mode_check" CHECK (("business_mode" = ANY (ARRAY['service_based'::"text", 'resource_tracking'::"text"])))
);


ALTER TABLE "public"."organization" OWNER TO "postgres";


COMMENT ON COLUMN "public"."organization"."business_mode" IS 'service_based: Car detailer offering specific services at fixed prices. resource_tracking: Car yard business tracking materials/resources used per job.';



COMMENT ON COLUMN "public"."organization"."abn" IS 'Australian Business Number (ABN)';



COMMENT ON COLUMN "public"."organization"."logo_url" IS 'URL to the organization logo image';



COMMENT ON COLUMN "public"."organization"."primary_contact_email" IS 'Primary business contact email (set during registration, read-only for users)';



COMMENT ON COLUMN "public"."organization"."invoice_send_immediately" IS 'If true, invoices are sent immediately upon creation. If false, invoices require review before sending.';



COMMENT ON COLUMN "public"."organization"."stripe_account_id" IS 'Stripe account ID/identifier for payment processing';



COMMENT ON COLUMN "public"."organization"."payment_provider" IS 'Payment provider identifier (e.g., "stripe", "paypal") for future multi-provider support';



COMMENT ON COLUMN "public"."organization"."feedback_email_send_immediately" IS 'If true, feedback request emails are sent immediately after a job is completed. If false, feedback requests require manual action.';



COMMENT ON COLUMN "public"."organization"."currency" IS 'Default currency for pricing and invoicing (ISO 4217 code)';



COMMENT ON COLUMN "public"."organization"."locale" IS 'Locale for number/date formatting (BCP 47 tag)';



COMMENT ON COLUMN "public"."organization"."default_exclusive_group_label" IS 'Custom label for the default_exclusive_group used in mobile app dropdowns. If not set, a default label is generated from the group ID.';



COMMENT ON COLUMN "public"."organization"."rating_config" IS 'Configuration for feedback ratings. Options: single (overall rating only), three_dimensions (quality, communication, value), or rater (reliability, assurance, tangibles, empathy, responsiveness)';



COMMENT ON COLUMN "public"."organization"."onboarding_completed_at" IS 'Timestamp when user completed onboarding. NULL means onboarding not completed.';



COMMENT ON COLUMN "public"."organization"."onboarding_data" IS 'Stores answers from onboarding wizard: {industry_type, employee_count, abn, has_locations, worker_payment_method, worker_payment_frequency, invoice_frequency, review_invoices_before_sending}';



COMMENT ON COLUMN "public"."organization"."business_address" IS 'Physical business address for invoices and official documents (optional)';



COMMENT ON COLUMN "public"."organization"."primary_contact_phone" IS 'Primary business contact phone number displayed on invoices';



CREATE TABLE IF NOT EXISTS "public"."worker" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "active" boolean DEFAULT true,
    "failed_login_attempts" integer DEFAULT 0,
    "locked_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "auth_user_id" "uuid",
    "first_name" "text",
    "last_name" "text",
    "address" "text",
    "abn" "text",
    CONSTRAINT "check_worker_email_format" CHECK ((("email" IS NULL) OR ("email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text")))
);


ALTER TABLE "public"."worker" OWNER TO "postgres";


COMMENT ON TABLE "public"."worker" IS 'Workers who complete jobs for organizations. Linked to auth.users via auth_user_id for authentication.';



COMMENT ON COLUMN "public"."worker"."first_name" IS 'Worker first name (required for new workers during signup)';



COMMENT ON COLUMN "public"."worker"."last_name" IS 'Worker last name (required for new workers during signup)';



COMMENT ON COLUMN "public"."worker"."address" IS 'Worker address (required for new workers during signup)';



COMMENT ON COLUMN "public"."worker"."abn" IS 'Worker Australian Business Number - ABN (required for new workers during signup)';



CREATE OR REPLACE VIEW "public"."job_summary" AS
 SELECT "cj"."id" AS "job_id",
    "cj"."organization_id",
    "o"."name" AS "organization_name",
    "w"."name" AS "worker_name",
    "w"."id" AS "worker_id",
    "l"."name" AS "location_name",
    "cj"."completed_at",
    "f"."rating",
    "f"."comment"
   FROM ((((("public"."job" "cj"
     JOIN "public"."organization" "o" ON (("cj"."organization_id" = "o"."id")))
     JOIN "public"."job_worker" "jw" ON (("cj"."id" = "jw"."job_id")))
     JOIN "public"."worker" "w" ON (("jw"."worker_id" = "w"."id")))
     LEFT JOIN "public"."location" "l" ON (("cj"."location_id" = "l"."id")))
     LEFT JOIN "public"."feedback" "f" ON (("cj"."id" = "f"."job_id")))
  ORDER BY "cj"."completed_at" DESC;


ALTER VIEW "public"."job_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."job_summary" IS 'Summary view of jobs with worker, organization, and feedback data';



CREATE TABLE IF NOT EXISTS "public"."location_field_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "location_id" "uuid" NOT NULL,
    "field_config_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."location_field_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."location_field_config" IS 'Optional restriction of field configs to specific locations. If no rows exist for a field config, it is available to all locations.';



CREATE TABLE IF NOT EXISTS "public"."location_hierarchy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "name" "text" NOT NULL,
    "code" "text",
    "type" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "metadata" "jsonb",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "location_hierarchy_type_check" CHECK (("type" = ANY (ARRAY['company'::"text", 'region'::"text"])))
);


ALTER TABLE "public"."location_hierarchy" OWNER TO "postgres";


COMMENT ON TABLE "public"."location_hierarchy" IS 'Organizational hierarchy (company, region) for pricing inheritance. Locations reference these nodes via hierarchy_parent_id.';



COMMENT ON COLUMN "public"."location_hierarchy"."metadata" IS 'Arbitrary metadata including auto_send_invoices configuration: {auto_send_invoices: {enabled: boolean, period: "daily"|"weekly"|"monthly", day_of_week?: number, day_of_month?: number, time?: string}}';



CREATE TABLE IF NOT EXISTS "public"."notification" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "receiver_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "related_entity_type" "text",
    "related_entity_id" "uuid",
    "read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_type_check" CHECK (("type" = ANY (ARRAY['worker_active'::"text", 'job_completed'::"text", 'invoice_generated'::"text", 'payment_received'::"text", 'review_submitted'::"text"])))
);


ALTER TABLE "public"."notification" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification" IS 'In-app notifications for organization admins';



COMMENT ON COLUMN "public"."notification"."receiver_id" IS 'Specific recipient (null = all admins in org)';



COMMENT ON COLUMN "public"."notification"."type" IS 'Type of notification event';



COMMENT ON COLUMN "public"."notification"."related_entity_type" IS 'Type of entity this notification relates to';



COMMENT ON COLUMN "public"."notification"."related_entity_id" IS 'ID of related entity for navigation';



CREATE TABLE IF NOT EXISTS "public"."option_pricing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "field_config_id" "uuid" NOT NULL,
    "option_value" "text" NOT NULL,
    "customer_price" numeric(10,2) NOT NULL,
    "worker_payment_rate" numeric(10,2),
    "location_id" "uuid",
    "currency" "public"."currency_code" DEFAULT 'USD'::"public"."currency_code",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "option_pricing_customer_price_check" CHECK (("customer_price" >= (0)::numeric)),
    CONSTRAINT "option_pricing_worker_payment_rate_check" CHECK (("worker_payment_rate" >= (0)::numeric))
);


ALTER TABLE "public"."option_pricing" OWNER TO "postgres";


COMMENT ON TABLE "public"."option_pricing" IS 'Pricing configuration for select field options. Each option value can have different pricing per location.';



COMMENT ON COLUMN "public"."option_pricing"."option_value" IS 'The option/group name from the field config options array';



COMMENT ON COLUMN "public"."option_pricing"."customer_price" IS 'Price charged to customer for this option';



COMMENT ON COLUMN "public"."option_pricing"."worker_payment_rate" IS 'Rate paid to worker for this option (can be different from customer price)';



COMMENT ON COLUMN "public"."option_pricing"."location_id" IS 'NULL = organization default, otherwise location-specific override';



CREATE TABLE IF NOT EXISTS "public"."organization_field_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "label" "text" NOT NULL,
    "field_type" "text" NOT NULL,
    "description" "text",
    "required" boolean DEFAULT false,
    "order_position" integer NOT NULL,
    "validation_rules" "jsonb",
    "options" "jsonb",
    "version" integer DEFAULT 1,
    "active" boolean DEFAULT true,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "mutually_exclusive_group" "text",
    "group_cluster" "text",
    "section_id" "uuid",
    "conditional_logic" "jsonb"
);


ALTER TABLE "public"."organization_field_configs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."organization_field_configs"."mutually_exclusive_group" IS 'Identifier for fields that are mutually exclusive. Only one cluster or field in a group can have values at a time.';



COMMENT ON COLUMN "public"."organization_field_configs"."group_cluster" IS 'Identifier for fields that work together within a mutually exclusive group. Fields with the same cluster can all have values simultaneously.';



COMMENT ON COLUMN "public"."organization_field_configs"."section_id" IS 'References a form_section to group this field. NULL means the field is unsectioned.';



COMMENT ON COLUMN "public"."organization_field_configs"."conditional_logic" IS 'JSON structure defining when this field should be visible based on other field values. Format: {"conditions": [{"field_id": "uuid", "operator": "equals", "value": "any"}], "match_type": "all|any"}.';



CREATE TABLE IF NOT EXISTS "public"."organization_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "auto_send_invoices_config" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "worker_payment_cycle_config" "jsonb",
    "auto_generate_invoices_immediately" boolean DEFAULT false,
    "bank_transfer_bsb" "text",
    "bank_transfer_account_number" "text",
    "bank_transfer_account_name" "text",
    "show_bank_transfer_on_invoices" boolean DEFAULT false,
    "default_invoice_due_days" integer DEFAULT 30,
    CONSTRAINT "check_default_invoice_due_days" CHECK ((("default_invoice_due_days" >= 1) AND ("default_invoice_due_days" <= 365)))
);


ALTER TABLE "public"."organization_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."organization_settings"."auto_send_invoices_config" IS 'Organization-level auto-send invoice configuration: {enabled: boolean, period: "daily"|"weekly"|"monthly", day_of_week?: number, day_of_month?: number, time?: string}. Applies to invoices not covered by location_hierarchy auto-send config.';



COMMENT ON COLUMN "public"."organization_settings"."worker_payment_cycle_config" IS 'Worker payment cycle configuration: {payment_frequency: "weekly"|"fortnightly"|"monthly", payment_day_of_week?: number, payment_day_of_month?: number, cut_off_time?: string, require_approval?: boolean, auto_calculate?: boolean}. All cycles start on Monday.';



COMMENT ON COLUMN "public"."organization_settings"."auto_generate_invoices_immediately" IS 'If true, automatically generates invoices in pending_review state immediately when jobs are completed. Only applies to jobs without location hierarchies or jobs with locations that do not have hierarchy auto-generate enabled.';



COMMENT ON COLUMN "public"."organization_settings"."bank_transfer_bsb" IS 'BSB (Bank State Branch) number for bank transfer payments (Australian format: XXX-XXX)';



COMMENT ON COLUMN "public"."organization_settings"."bank_transfer_account_number" IS 'Bank account number for bank transfer payments';



COMMENT ON COLUMN "public"."organization_settings"."bank_transfer_account_name" IS 'Account name for bank transfer payments';



COMMENT ON COLUMN "public"."organization_settings"."show_bank_transfer_on_invoices" IS 'If true, display bank transfer details on invoices for manual payment processing';



COMMENT ON COLUMN "public"."organization_settings"."default_invoice_due_days" IS 'Number of days after invoice creation when payment is due. Default is 30 days.';



CREATE TABLE IF NOT EXISTS "public"."organization_user" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'admin'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "status" "text" DEFAULT 'active'::"text",
    "auth_user_id" "uuid",
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "activated_at" timestamp with time zone,
    CONSTRAINT "check_email_format" CHECK (("email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text")),
    CONSTRAINT "organization_user_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."organization_user" OWNER TO "postgres";


COMMENT ON COLUMN "public"."organization_user"."status" IS 'User account status: pending (invited but not activated), active (can access dashboard), inactive (disabled)';



COMMENT ON COLUMN "public"."organization_user"."auth_user_id" IS 'Links to Supabase Auth user. NULL until user accepts invitation and creates password.';



CREATE TABLE IF NOT EXISTS "public"."payment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "invoice_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'AUD'::"text",
    "payment_method" "text" NOT NULL,
    "stripe_payment_intent_id" "text",
    "stripe_checkout_session_id" "text",
    "stripe_customer_id" "text",
    "stripe_charge_id" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "payment_reference" "text",
    "payment_date" timestamp with time zone,
    "received_at" timestamp with time zone,
    "fees" numeric(10,2) DEFAULT 0,
    "net_amount" numeric(10,2),
    "reconciled_at" timestamp with time zone,
    "reconciled_by" "uuid",
    "reconciliation_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "payment_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "payment_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['stripe_checkout_card'::"text", 'stripe_checkout_bank'::"text", 'stripe_checkout_wallet'::"text", 'bank_transfer_manual'::"text", 'other'::"text"]))),
    CONSTRAINT "payment_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'succeeded'::"text", 'failed'::"text", 'canceled'::"text", 'refunded'::"text", 'partially_refunded'::"text", 'disputed'::"text"])))
);


ALTER TABLE "public"."payment" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment" IS 'Payment records for invoices, supporting Stripe Checkout and manual bank transfers';



COMMENT ON COLUMN "public"."payment"."stripe_payment_intent_id" IS 'Stripe PaymentIntent ID for tracking payments';



COMMENT ON COLUMN "public"."payment"."stripe_checkout_session_id" IS 'Stripe Checkout Session ID linking to payment_link';



COMMENT ON COLUMN "public"."payment"."status" IS 'Payment status aligned with Stripe payment intent statuses';



COMMENT ON COLUMN "public"."payment"."net_amount" IS 'Amount after Stripe fees (amount - fees)';



COMMENT ON COLUMN "public"."payment"."metadata" IS 'Stores Stripe webhook event data and other metadata';



CREATE TABLE IF NOT EXISTS "public"."payment_link" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "stripe_checkout_session_id" "text" NOT NULL,
    "checkout_url" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text",
    "clicked_at" timestamp with time zone,
    "clicked_count" integer DEFAULT 0,
    "payment_completed_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "customer_email" "text",
    "amount_total" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payment_link_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'complete'::"text", 'expired'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."payment_link" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_link" IS 'Stripe Checkout payment links generated for invoices';



COMMENT ON COLUMN "public"."payment_link"."stripe_checkout_session_id" IS 'Unique Stripe Checkout Session ID';



COMMENT ON COLUMN "public"."payment_link"."checkout_url" IS 'The payment link URL sent to customers';



COMMENT ON COLUMN "public"."payment_link"."status" IS 'Status of the checkout session: open, complete, expired, canceled';



CREATE TABLE IF NOT EXISTS "public"."pricing_condition" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pricing_rule_id" "uuid" NOT NULL,
    "condition_field_config_id" "uuid" NOT NULL,
    "operator" "public"."pricing_condition_operator" NOT NULL,
    "condition_value" "text" NOT NULL,
    "action_type" "public"."pricing_action_type" NOT NULL,
    "action_value" numeric(12,4) NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "priority" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pricing_condition" OWNER TO "postgres";


COMMENT ON TABLE "public"."pricing_condition" IS 'Defines conditional logic for pricing rules. Allows complex pricing scenarios based on field values.';



CREATE TABLE IF NOT EXISTS "public"."pricing_condition_audit" (
    "id" bigint NOT NULL,
    "pricing_condition_id" "uuid",
    "pricing_rule_id" "uuid",
    "action" "text" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "changed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pricing_condition_audit" OWNER TO "postgres";


COMMENT ON TABLE "public"."pricing_condition_audit" IS 'Audit log for pricing_condition changes. RLS enabled for security.';



CREATE SEQUENCE IF NOT EXISTS "public"."pricing_condition_audit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pricing_condition_audit_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."pricing_condition_audit_id_seq" OWNED BY "public"."pricing_condition_audit"."id";



CREATE TABLE IF NOT EXISTS "public"."pricing_rule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "scope" "public"."pricing_scope" NOT NULL,
    "pricing_type" "public"."pricing_type_enum" NOT NULL,
    "field_config_id" "uuid",
    "option_value" "text",
    "applies_to_field_type" "text",
    "location_hierarchy_id" "uuid",
    "location_id" "uuid",
    "currency" "public"."currency_code" DEFAULT 'USD'::"public"."currency_code",
    "base_price" numeric(12,4),
    "percentage_rate" numeric(7,4),
    "minimum_quantity" numeric(12,4),
    "maximum_quantity" numeric(12,4),
    "tier_definition" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "worker_payment_type" "text",
    "worker_payment_value" numeric(12,4),
    "priority" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "effective_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pricing_context" "text" DEFAULT 'customer'::"text",
    CONSTRAINT "pricing_rule_pricing_context_check" CHECK (("pricing_context" = ANY (ARRAY['customer'::"text", 'worker'::"text"]))),
    CONSTRAINT "pricing_rule_worker_payment_type_check" CHECK (("worker_payment_type" = ANY (ARRAY['same_structure'::"text", 'percentage'::"text", 'fixed_rate'::"text"])))
);


ALTER TABLE "public"."pricing_rule" OWNER TO "postgres";


COMMENT ON TABLE "public"."pricing_rule" IS 'Unified pricing table supporting field, option, and base pricing with location hierarchies and effective dating. Replaces legacy pricing_rules, base_pricing, field_pricing, and option_pricing tables.';



COMMENT ON COLUMN "public"."pricing_rule"."scope" IS 'Determines if the rule applies to fields, select options, base pricing, or global adjustments.';



COMMENT ON COLUMN "public"."pricing_rule"."tier_definition" IS 'JSON describing tiered pricing brackets.';



COMMENT ON COLUMN "public"."pricing_rule"."effective_at" IS 'Timestamp when the pricing rule becomes active. Rules are selected based on effective_at and expires_at timestamps.';



COMMENT ON COLUMN "public"."pricing_rule"."expires_at" IS 'Timestamp when the pricing rule stops being active. NULL means the rule is open-ended and remains active indefinitely.';



COMMENT ON COLUMN "public"."pricing_rule"."pricing_context" IS 'Determines if the rule applies to customer invoicing (customer) or worker payments (worker). Allows independent pricing structures for each.';



CREATE TABLE IF NOT EXISTS "public"."pricing_rule_audit" (
    "id" bigint NOT NULL,
    "pricing_rule_id" "uuid",
    "action" "text" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "changed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pricing_rule_audit" OWNER TO "postgres";


COMMENT ON TABLE "public"."pricing_rule_audit" IS 'Audit log for pricing_rule changes. RLS enabled for security.';



CREATE SEQUENCE IF NOT EXISTS "public"."pricing_rule_audit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pricing_rule_audit_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."pricing_rule_audit_id_seq" OWNED BY "public"."pricing_rule_audit"."id";



CREATE TABLE IF NOT EXISTS "public"."pricing_snapshot" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "invoice_id" "uuid",
    "job_id" "uuid",
    "pricing_rule_id" "uuid",
    "field_config_id" "uuid",
    "line_item_key" "text",
    "snapshot_data" "jsonb" NOT NULL,
    "captured_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pricing_snapshot" OWNER TO "postgres";


COMMENT ON TABLE "public"."pricing_snapshot" IS 'Immutable record of pricing rule data stored at invoice creation time. Ensures historical accuracy of invoice pricing.';



CREATE TABLE IF NOT EXISTS "public"."rate_limit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "identifier" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "request_count" integer DEFAULT 1 NOT NULL,
    "last_request_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rate_limit_request_count_check" CHECK (("request_count" >= 0))
);


ALTER TABLE "public"."rate_limit" OWNER TO "postgres";


COMMENT ON TABLE "public"."rate_limit" IS 'Rate limiting tracking table. RLS enabled, service role only.';



COMMENT ON COLUMN "public"."rate_limit"."identifier" IS 'Client identifier (IP address or custom identifier)';



COMMENT ON COLUMN "public"."rate_limit"."window_start" IS 'Start timestamp of the rate limit window';



COMMENT ON COLUMN "public"."rate_limit"."request_count" IS 'Number of requests in the current window';



CREATE TABLE IF NOT EXISTS "public"."service_pricing_mode" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "service_type_field_config_id" "uuid" NOT NULL,
    "service_type_value" "text" NOT NULL,
    "pricing_mode" "text" NOT NULL,
    "fixed_customer_price" numeric(12,4),
    "fixed_worker_payment" numeric(12,4),
    "fixed_price_currency" "public"."currency_code" DEFAULT 'USD'::"public"."currency_code",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "service_pricing_mode_fixed_check" CHECK (((("pricing_mode" = 'fixed_price'::"text") AND ("fixed_customer_price" IS NOT NULL) AND ("fixed_worker_payment" IS NOT NULL) AND ("fixed_price_currency" IS NOT NULL)) OR ("pricing_mode" = 'field_based'::"text"))),
    CONSTRAINT "service_pricing_mode_pricing_mode_check" CHECK (("pricing_mode" = ANY (ARRAY['field_based'::"text", 'fixed_price'::"text"])))
);


ALTER TABLE "public"."service_pricing_mode" OWNER TO "postgres";


COMMENT ON TABLE "public"."service_pricing_mode" IS 'Overrides pricing mode per service type for a location (or org default).';



COMMENT ON COLUMN "public"."service_pricing_mode"."pricing_mode" IS 'field_based uses standard pricing rules; fixed_price uses fixed amounts for this service at the given location.';



CREATE TABLE IF NOT EXISTS "public"."webhook_event" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'processed'::"text",
    "error_message" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "webhook_event_status_check" CHECK (("status" = ANY (ARRAY['processed'::"text", 'failed'::"text", 'retrying'::"text"])))
);


ALTER TABLE "public"."webhook_event" OWNER TO "postgres";


COMMENT ON TABLE "public"."webhook_event" IS 'Webhook event tracking for idempotency. RLS enabled for security.';



COMMENT ON COLUMN "public"."webhook_event"."event_id" IS 'Unique identifier from webhook provider (e.g., Stripe event ID)';



COMMENT ON COLUMN "public"."webhook_event"."event_type" IS 'Type of webhook event (e.g., checkout.session.completed)';



COMMENT ON COLUMN "public"."webhook_event"."status" IS 'Processing status: processed, failed, or retrying';



COMMENT ON COLUMN "public"."webhook_event"."metadata" IS 'Additional event metadata for debugging';



CREATE TABLE IF NOT EXISTS "public"."worker_invitation" (
    "id" "text" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "worker_email" "text" NOT NULL,
    "accepted_at" timestamp with time zone,
    "auth_user_id" "uuid",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."worker_invitation" OWNER TO "postgres";


COMMENT ON TABLE "public"."worker_invitation" IS 'Pending invitations for workers to join organizations. Contains invitation token and expiration details.';



CREATE TABLE IF NOT EXISTS "public"."worker_payment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "batch_id" "uuid",
    "job_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'AUD'::"text",
    "status" "text" DEFAULT 'calculated'::"text",
    "payment_method" "text",
    "payment_reference" "text",
    "paid_at" timestamp with time zone,
    "paid_by" "uuid",
    "calculation_details" "jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "worker_payment_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "worker_payment_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['bank_transfer'::"text", 'cash'::"text", 'check'::"text", 'payroll_system'::"text", 'other'::"text"]))),
    CONSTRAINT "worker_payment_status_check" CHECK (("status" = ANY (ARRAY['calculated'::"text", 'pending'::"text", 'processing'::"text", 'paid'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."worker_payment" OWNER TO "postgres";


COMMENT ON TABLE "public"."worker_payment" IS 'Individual worker payments calculated from jobs';



COMMENT ON COLUMN "public"."worker_payment"."calculation_details" IS 'Calculation breakdown for this specific payment';



CREATE TABLE IF NOT EXISTS "public"."worker_payment_allocation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "allocation_type" "text" DEFAULT 'percentage'::"text" NOT NULL,
    "percentage" numeric(5,2),
    "fixed_amount" numeric(10,2),
    "hours_worked" numeric(5,2),
    "field_config_id" "uuid",
    "option_value" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "worker_payment_allocation_allocation_type_check" CHECK (("allocation_type" = ANY (ARRAY['percentage'::"text", 'amount'::"text", 'hours'::"text"]))),
    CONSTRAINT "worker_payment_allocation_fixed_amount_check" CHECK (("fixed_amount" >= (0)::numeric)),
    CONSTRAINT "worker_payment_allocation_hours_worked_check" CHECK (("hours_worked" >= (0)::numeric)),
    CONSTRAINT "worker_payment_allocation_percentage_check" CHECK ((("percentage" >= (0)::numeric) AND ("percentage" <= (100)::numeric)))
);


ALTER TABLE "public"."worker_payment_allocation" OWNER TO "postgres";


COMMENT ON TABLE "public"."worker_payment_allocation" IS 'Custom payment allocations for jobs with multiple workers';



COMMENT ON COLUMN "public"."worker_payment_allocation"."allocation_type" IS 'Type of allocation: percentage, amount, or hours';



COMMENT ON COLUMN "public"."worker_payment_allocation"."percentage" IS 'Percentage of payment (must sum to 100% across all workers)';



COMMENT ON COLUMN "public"."worker_payment_allocation"."fixed_amount" IS 'Fixed amount for this worker';



COMMENT ON COLUMN "public"."worker_payment_allocation"."hours_worked" IS 'Hours worked for proportional calculation';



CREATE TABLE IF NOT EXISTS "public"."worker_payment_batch" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "calculated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "calculated_by" "uuid",
    "total_payment" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'AUD'::"text",
    "job_count" integer NOT NULL,
    "worker_count" integer NOT NULL,
    "status" "text" DEFAULT 'calculated'::"text",
    "notes" "text",
    "calculation_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "worker_payment_batch_status_check" CHECK (("status" = ANY (ARRAY['calculated'::"text", 'approved'::"text", 'processing'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."worker_payment_batch" OWNER TO "postgres";


COMMENT ON TABLE "public"."worker_payment_batch" IS 'Batches of worker payment calculations';



COMMENT ON COLUMN "public"."worker_payment_batch"."status" IS 'Batch status: calculated (initial), approved (reviewed and ready), processing (in progress), completed (all paid), cancelled';



COMMENT ON COLUMN "public"."worker_payment_batch"."calculation_data" IS 'Full CalculateWorkerPaymentsResponse JSON for reference';



CREATE TABLE IF NOT EXISTS "public"."worker_rate_card" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "modifier_value" numeric(10,4) NOT NULL,
    "currency" "text" DEFAULT 'AUD'::"text" NOT NULL,
    "effective_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "effective_to" "date",
    "role_title" "text",
    "is_active" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modifier_type" "text" DEFAULT 'flat'::"text" NOT NULL,
    CONSTRAINT "worker_rate_card_modifier_type_check" CHECK (("modifier_type" = ANY (ARRAY['per_unit'::"text", 'flat'::"text", 'multiplier'::"text", 'team_percentage'::"text", 'split_weight'::"text"]))),
    CONSTRAINT "worker_rate_card_modifier_value_check" CHECK (("modifier_value" > (0)::numeric))
);


ALTER TABLE "public"."worker_rate_card" OWNER TO "postgres";


COMMENT ON TABLE "public"."worker_rate_card" IS 'Worker payment rate cards with effective date ranges';



COMMENT ON COLUMN "public"."worker_rate_card"."modifier_value" IS 'The value of the modifier (amount for per_unit/flat, multiplier for multiplier type)';



COMMENT ON COLUMN "public"."worker_rate_card"."effective_from" IS 'Date this rate becomes effective';



COMMENT ON COLUMN "public"."worker_rate_card"."effective_to" IS 'Date this rate ends (NULL = no end date)';



COMMENT ON COLUMN "public"."worker_rate_card"."role_title" IS 'Worker role/title for this rate (e.g., Supervisor)';



COMMENT ON COLUMN "public"."worker_rate_card"."modifier_type" IS 'Type of modifier: per_unit (bonus per output unit), flat (fixed per job), multiplier (percentage boost), team_percentage (percentage of team earnings)';



CREATE TABLE IF NOT EXISTS "public"."worker_rate_card_field" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rate_card_id" "uuid" NOT NULL,
    "field_config_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."worker_rate_card_field" OWNER TO "postgres";


COMMENT ON TABLE "public"."worker_rate_card_field" IS 'Maps rate cards to fields for per-unit bonuses (e.g., which fields the bonus applies to)';



COMMENT ON COLUMN "public"."worker_rate_card_field"."rate_card_id" IS 'The rate card this field mapping belongs to';



COMMENT ON COLUMN "public"."worker_rate_card_field"."field_config_id" IS 'The field config this bonus applies to (e.g., cars_cleaned)';



ALTER TABLE ONLY "public"."job_edits" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."job_edits_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."pricing_condition_audit" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."pricing_condition_audit_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."pricing_rule_audit" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."pricing_rule_audit_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."base_pricing"
    ADD CONSTRAINT "base_pricing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_job_id_key" UNIQUE ("job_id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."field_pricing"
    ADD CONSTRAINT "field_pricing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_section"
    ADD CONSTRAINT "form_section_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_job"
    ADD CONSTRAINT "invoice_job_pkey" PRIMARY KEY ("invoice_id", "job_id");



ALTER TABLE ONLY "public"."invoice"
    ADD CONSTRAINT "invoice_organization_id_invoice_number_key" UNIQUE ("organization_id", "invoice_number");



ALTER TABLE ONLY "public"."invoice"
    ADD CONSTRAINT "invoice_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_send_outbox"
    ADD CONSTRAINT "invoice_send_outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_template_config"
    ADD CONSTRAINT "invoice_template_config_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."invoice_template_config"
    ADD CONSTRAINT "invoice_template_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_edits"
    ADD CONSTRAINT "job_edits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job"
    ADD CONSTRAINT "job_feedback_token_key" UNIQUE ("feedback_token");



ALTER TABLE ONLY "public"."job"
    ADD CONSTRAINT "job_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_worker"
    ADD CONSTRAINT "job_worker_pkey" PRIMARY KEY ("job_id", "worker_id");



ALTER TABLE ONLY "public"."location_field_config"
    ADD CONSTRAINT "location_field_config_location_id_field_config_id_key" UNIQUE ("location_id", "field_config_id");



ALTER TABLE ONLY "public"."location_field_config"
    ADD CONSTRAINT "location_field_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."location_hierarchy"
    ADD CONSTRAINT "location_hierarchy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."location"
    ADD CONSTRAINT "location_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification"
    ADD CONSTRAINT "notification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."option_pricing"
    ADD CONSTRAINT "option_pricing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_field_configs"
    ADD CONSTRAINT "organization_field_configs_organization_id_name_key" UNIQUE ("organization_id", "name");



ALTER TABLE ONLY "public"."organization_field_configs"
    ADD CONSTRAINT "organization_field_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization"
    ADD CONSTRAINT "organization_org_code_key" UNIQUE ("org_code");



ALTER TABLE ONLY "public"."organization"
    ADD CONSTRAINT "organization_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_settings"
    ADD CONSTRAINT "organization_settings_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."organization_settings"
    ADD CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization"
    ADD CONSTRAINT "organization_subdomain_key" UNIQUE ("subdomain");



ALTER TABLE ONLY "public"."organization_user"
    ADD CONSTRAINT "organization_user_org_auth_user_unique" UNIQUE ("organization_id", "auth_user_id");



ALTER TABLE ONLY "public"."organization_user"
    ADD CONSTRAINT "organization_user_organization_id_email_key" UNIQUE ("organization_id", "email");



ALTER TABLE ONLY "public"."organization_user"
    ADD CONSTRAINT "organization_user_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_link"
    ADD CONSTRAINT "payment_link_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_link"
    ADD CONSTRAINT "payment_link_stripe_checkout_session_id_key" UNIQUE ("stripe_checkout_session_id");



ALTER TABLE ONLY "public"."payment"
    ADD CONSTRAINT "payment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment"
    ADD CONSTRAINT "payment_stripe_payment_intent_id_key" UNIQUE ("stripe_payment_intent_id");



ALTER TABLE ONLY "public"."pricing_condition_audit"
    ADD CONSTRAINT "pricing_condition_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_condition"
    ADD CONSTRAINT "pricing_condition_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_rule_audit"
    ADD CONSTRAINT "pricing_rule_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_rule"
    ADD CONSTRAINT "pricing_rule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_snapshot"
    ADD CONSTRAINT "pricing_snapshot_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limit"
    ADD CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_pricing_mode"
    ADD CONSTRAINT "service_pricing_mode_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_event"
    ADD CONSTRAINT "webhook_event_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."webhook_event"
    ADD CONSTRAINT "webhook_event_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker"
    ADD CONSTRAINT "worker_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."worker_invitation"
    ADD CONSTRAINT "worker_invitation_organization_id_worker_id_key" UNIQUE ("organization_id", "worker_id");



ALTER TABLE ONLY "public"."worker_invitation"
    ADD CONSTRAINT "worker_invitation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_payment_allocation"
    ADD CONSTRAINT "worker_payment_allocation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_payment_allocation"
    ADD CONSTRAINT "worker_payment_allocation_unique" UNIQUE ("job_id", "worker_id", "field_config_id", "option_value");



ALTER TABLE ONLY "public"."worker_payment_batch"
    ADD CONSTRAINT "worker_payment_batch_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_payment"
    ADD CONSTRAINT "worker_payment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker"
    ADD CONSTRAINT "worker_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_rate_card_field"
    ADD CONSTRAINT "worker_rate_card_field_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_rate_card_field"
    ADD CONSTRAINT "worker_rate_card_field_rate_card_id_field_config_id_key" UNIQUE ("rate_card_id", "field_config_id");



ALTER TABLE ONLY "public"."worker_rate_card"
    ADD CONSTRAINT "worker_rate_card_no_overlap" EXCLUDE USING "gist" ("worker_id" WITH =, "modifier_type" WITH =, "daterange"("effective_from", "effective_to", '[]'::"text") WITH &&) WHERE (("is_active" = true));



ALTER TABLE ONLY "public"."worker_rate_card"
    ADD CONSTRAINT "worker_rate_card_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_base_pricing_field_config" ON "public"."base_pricing" USING "btree" ("job_type_field_config_id");



CREATE INDEX "idx_base_pricing_location" ON "public"."base_pricing" USING "btree" ("location_id");



CREATE INDEX "idx_base_pricing_org" ON "public"."base_pricing" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "idx_base_pricing_unique" ON "public"."base_pricing" USING "btree" ("organization_id", COALESCE("job_type_field_config_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("job_type_value", ''::"text"), COALESCE("location_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE INDEX "idx_feedback_job" ON "public"."feedback" USING "btree" ("job_id");



CREATE INDEX "idx_feedback_ratings" ON "public"."feedback" USING "gin" ("ratings");



CREATE INDEX "idx_field_configs_cluster" ON "public"."organization_field_configs" USING "btree" ("organization_id", "mutually_exclusive_group", "group_cluster") WHERE (("mutually_exclusive_group" IS NOT NULL) AND ("group_cluster" IS NOT NULL));



CREATE INDEX "idx_field_configs_group" ON "public"."organization_field_configs" USING "btree" ("organization_id", "mutually_exclusive_group") WHERE ("mutually_exclusive_group" IS NOT NULL);



CREATE INDEX "idx_field_pricing_field_config" ON "public"."field_pricing" USING "btree" ("field_config_id");



CREATE INDEX "idx_field_pricing_location" ON "public"."field_pricing" USING "btree" ("location_id");



CREATE INDEX "idx_field_pricing_org" ON "public"."field_pricing" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "idx_field_pricing_unique" ON "public"."field_pricing" USING "btree" ("organization_id", "field_config_id", COALESCE("location_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE INDEX "idx_form_section_organization_id" ON "public"."form_section" USING "btree" ("organization_id");



CREATE INDEX "idx_invitations_expires" ON "public"."worker_invitation" USING "btree" ("expires_at");



CREATE INDEX "idx_invitations_org_worker" ON "public"."worker_invitation" USING "btree" ("organization_id", "worker_id");



CREATE INDEX "idx_invitations_token" ON "public"."worker_invitation" USING "btree" ("id");



CREATE INDEX "idx_invoice_created_at" ON "public"."invoice" USING "btree" ("created_at");



CREATE INDEX "idx_invoice_due_date" ON "public"."invoice" USING "btree" ("due_date");



CREATE INDEX "idx_invoice_job_invoice" ON "public"."invoice_job" USING "btree" ("invoice_id");



CREATE INDEX "idx_invoice_job_job" ON "public"."invoice_job" USING "btree" ("job_id");



CREATE UNIQUE INDEX "idx_invoice_job_job_id_unique" ON "public"."invoice_job" USING "btree" ("job_id");



CREATE INDEX "idx_invoice_number" ON "public"."invoice" USING "btree" ("invoice_number");



CREATE INDEX "idx_invoice_org" ON "public"."invoice" USING "btree" ("organization_id");



CREATE INDEX "idx_invoice_org_created" ON "public"."invoice" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_invoice_org_created_not_test" ON "public"."invoice" USING "btree" ("organization_id", "created_at" DESC) WHERE ("is_test" = false);



CREATE INDEX "idx_invoice_org_status_created" ON "public"."invoice" USING "btree" ("organization_id", "status", "created_at") WHERE ("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'paid'::"text", 'overdue'::"text"]));



COMMENT ON INDEX "public"."idx_invoice_org_status_created" IS 'Optimizes invoice filtering by organization, status, and creation date';



CREATE INDEX "idx_invoice_overdue_candidates" ON "public"."invoice" USING "btree" ("status", "due_date", "paid_at") WHERE (("status" = 'sent'::"text") AND ("paid_at" IS NULL));



CREATE INDEX "idx_invoice_pending_review" ON "public"."invoice" USING "btree" ("organization_id", "status") WHERE ("status" = 'pending_review'::"text");



CREATE INDEX "idx_invoice_send_outbox_invoice" ON "public"."invoice_send_outbox" USING "btree" ("invoice_id");



CREATE INDEX "idx_invoice_send_outbox_status_next_retry" ON "public"."invoice_send_outbox" USING "btree" ("status", "next_retry_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'failed'::"text"]));



CREATE INDEX "idx_invoice_sent_at" ON "public"."invoice" USING "btree" ("sent_at") WHERE ("sent_at" IS NOT NULL);



CREATE INDEX "idx_invoice_status" ON "public"."invoice" USING "btree" ("status");



CREATE INDEX "idx_invoice_template_config_org" ON "public"."invoice_template_config" USING "btree" ("organization_id");



CREATE INDEX "idx_job_completed" ON "public"."job" USING "btree" ("completed_at");



CREATE INDEX "idx_job_edits_changed_at" ON "public"."job_edits" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_job_edits_edited_by_email" ON "public"."job_edits" USING "btree" ("edited_by_email");



CREATE INDEX "idx_job_edits_job_id" ON "public"."job_edits" USING "btree" ("job_id");



CREATE INDEX "idx_job_feedback_token" ON "public"."job" USING "btree" ("feedback_token");



CREATE INDEX "idx_job_location" ON "public"."job" USING "btree" ("location_id");



CREATE INDEX "idx_job_org" ON "public"."job" USING "btree" ("organization_id");



CREATE INDEX "idx_job_org_completed" ON "public"."job" USING "btree" ("organization_id", "completed_at" DESC);



COMMENT ON INDEX "public"."idx_job_org_completed" IS 'Optimizes job queries by organization and completion date';



CREATE INDEX "idx_job_org_completed_not_test" ON "public"."job" USING "btree" ("organization_id", "completed_at" DESC) WHERE ("is_test" = false);



CREATE INDEX "idx_job_org_location_active" ON "public"."job" USING "btree" ("organization_id", "location_id", "completed_at") WHERE ("location_id" IS NOT NULL);



CREATE INDEX "idx_job_worker_job" ON "public"."job_worker" USING "btree" ("job_id");



CREATE INDEX "idx_job_worker_times" ON "public"."job_worker" USING "btree" ("job_id") WHERE ("start_time" IS NOT NULL);



CREATE INDEX "idx_job_worker_worker" ON "public"."job_worker" USING "btree" ("worker_id");



CREATE INDEX "idx_location_field_config_field" ON "public"."location_field_config" USING "btree" ("field_config_id");



CREATE INDEX "idx_location_field_config_location" ON "public"."location_field_config" USING "btree" ("location_id");



CREATE INDEX "idx_location_hierarchy_org" ON "public"."location_hierarchy" USING "btree" ("organization_id");



CREATE INDEX "idx_location_hierarchy_org_active" ON "public"."location_hierarchy" USING "btree" ("organization_id", "active") WHERE ("active" = true);



CREATE UNIQUE INDEX "idx_location_hierarchy_org_parent_name" ON "public"."location_hierarchy" USING "btree" ("organization_id", "parent_id", "name");



CREATE INDEX "idx_location_hierarchy_org_type_active" ON "public"."location_hierarchy" USING "btree" ("organization_id", "type", "active") WHERE ("active" = true);



CREATE INDEX "idx_location_hierarchy_parent" ON "public"."location_hierarchy" USING "btree" ("parent_id");



CREATE INDEX "idx_location_org" ON "public"."location" USING "btree" ("organization_id");



CREATE INDEX "idx_location_org_active" ON "public"."location" USING "btree" ("organization_id", "active") WHERE ("active" = true);



CREATE INDEX "idx_location_pricing_mode" ON "public"."location" USING "btree" ("organization_id", "pricing_mode") WHERE ("pricing_mode" = 'fixed_price'::"text");



CREATE INDEX "idx_notification_org_receiver" ON "public"."notification" USING "btree" ("organization_id", "receiver_id", "read", "created_at" DESC);



CREATE INDEX "idx_notification_related_entity" ON "public"."notification" USING "btree" ("related_entity_type", "related_entity_id");



CREATE INDEX "idx_notification_unread" ON "public"."notification" USING "btree" ("organization_id", "receiver_id") WHERE ("read" = false);



CREATE INDEX "idx_option_pricing_field_config" ON "public"."option_pricing" USING "btree" ("field_config_id");



CREATE INDEX "idx_option_pricing_location" ON "public"."option_pricing" USING "btree" ("location_id");



CREATE INDEX "idx_option_pricing_option_value" ON "public"."option_pricing" USING "btree" ("option_value");



CREATE INDEX "idx_option_pricing_org" ON "public"."option_pricing" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "idx_option_pricing_unique" ON "public"."option_pricing" USING "btree" ("organization_id", "field_config_id", "option_value", COALESCE("location_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE INDEX "idx_organization_business_mode" ON "public"."organization" USING "btree" ("business_mode");



CREATE INDEX "idx_organization_field_configs_active" ON "public"."organization_field_configs" USING "btree" ("organization_id", "active") WHERE ("active" = true);



CREATE UNIQUE INDEX "idx_organization_field_configs_name_unique_ci" ON "public"."organization_field_configs" USING "btree" ("organization_id", "lower"("name")) WHERE ("active" = true);



CREATE INDEX "idx_organization_field_configs_order" ON "public"."organization_field_configs" USING "btree" ("organization_id", "order_position");



CREATE INDEX "idx_organization_field_configs_org" ON "public"."organization_field_configs" USING "btree" ("organization_id");



CREATE INDEX "idx_organization_field_configs_section_id" ON "public"."organization_field_configs" USING "btree" ("section_id");



CREATE INDEX "idx_organization_onboarding_completed" ON "public"."organization" USING "btree" ("onboarding_completed_at") WHERE ("onboarding_completed_at" IS NULL);



CREATE INDEX "idx_organization_settings_org_id" ON "public"."organization_settings" USING "btree" ("organization_id");



CREATE INDEX "idx_organization_user_auth_user_id" ON "public"."organization_user" USING "btree" ("auth_user_id");



CREATE INDEX "idx_organization_user_org_status" ON "public"."organization_user" USING "btree" ("organization_id", "status");



CREATE INDEX "idx_organization_user_status" ON "public"."organization_user" USING "btree" ("status");



CREATE INDEX "idx_payment_date" ON "public"."payment" USING "btree" ("payment_date");



CREATE INDEX "idx_payment_invoice" ON "public"."payment" USING "btree" ("invoice_id");



CREATE INDEX "idx_payment_link_invoice" ON "public"."payment_link" USING "btree" ("invoice_id");



CREATE INDEX "idx_payment_link_status" ON "public"."payment_link" USING "btree" ("status");



CREATE INDEX "idx_payment_link_stripe_session" ON "public"."payment_link" USING "btree" ("stripe_checkout_session_id");



COMMENT ON INDEX "public"."idx_payment_link_stripe_session" IS 'Optimizes webhook lookups by Stripe checkout session ID';



CREATE INDEX "idx_payment_org" ON "public"."payment" USING "btree" ("organization_id");



CREATE INDEX "idx_payment_org_status_created" ON "public"."payment" USING "btree" ("organization_id", "status", "created_at" DESC);



COMMENT ON INDEX "public"."idx_payment_org_status_created" IS 'Optimizes payment filtering by organization, status, and creation date';



CREATE INDEX "idx_payment_reference" ON "public"."payment" USING "btree" ("payment_reference");



CREATE INDEX "idx_payment_status" ON "public"."payment" USING "btree" ("status");



CREATE INDEX "idx_payment_stripe_intent" ON "public"."payment" USING "btree" ("stripe_payment_intent_id");



CREATE INDEX "idx_payment_stripe_session" ON "public"."payment" USING "btree" ("stripe_checkout_session_id");



CREATE INDEX "idx_pricing_condition_field" ON "public"."pricing_condition" USING "btree" ("condition_field_config_id");



CREATE INDEX "idx_pricing_condition_rule" ON "public"."pricing_condition" USING "btree" ("pricing_rule_id");



CREATE INDEX "idx_pricing_rule_context" ON "public"."pricing_rule" USING "btree" ("organization_id", "pricing_context", "active") WHERE ("active" = true);



CREATE INDEX "idx_pricing_rule_effective" ON "public"."pricing_rule" USING "btree" ("organization_id", "effective_at", COALESCE("expires_at", 'infinity'::timestamp with time zone));



CREATE INDEX "idx_pricing_rule_effective_dates" ON "public"."pricing_rule" USING "btree" ("organization_id", "effective_at", "expires_at") WHERE ("active" = true);



CREATE UNIQUE INDEX "idx_pricing_rule_effective_unique" ON "public"."pricing_rule" USING "btree" ("organization_id", "pricing_context", "scope", COALESCE("field_config_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("option_value", ''::"text"), COALESCE("location_hierarchy_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("location_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "effective_at");



CREATE INDEX "idx_pricing_rule_field" ON "public"."pricing_rule" USING "btree" ("field_config_id");



CREATE INDEX "idx_pricing_rule_location" ON "public"."pricing_rule" USING "btree" ("location_id");



CREATE INDEX "idx_pricing_rule_location_hierarchy" ON "public"."pricing_rule" USING "btree" ("location_hierarchy_id");



CREATE INDEX "idx_pricing_rule_org" ON "public"."pricing_rule" USING "btree" ("organization_id");



CREATE INDEX "idx_pricing_rule_org_context_active" ON "public"."pricing_rule" USING "btree" ("organization_id", "pricing_context", "active", "effective_at") WHERE ("active" = true);



CREATE INDEX "idx_pricing_rule_scope_type" ON "public"."pricing_rule" USING "btree" ("scope", "pricing_type");



CREATE INDEX "idx_pricing_snapshot_invoice" ON "public"."pricing_snapshot" USING "btree" ("invoice_id");



CREATE INDEX "idx_pricing_snapshot_job" ON "public"."pricing_snapshot" USING "btree" ("job_id");



CREATE INDEX "idx_pricing_snapshot_org" ON "public"."pricing_snapshot" USING "btree" ("organization_id");



CREATE INDEX "idx_rate_limit_identifier_window" ON "public"."rate_limit" USING "btree" ("identifier", "window_start" DESC);



CREATE INDEX "idx_rate_limit_window_start" ON "public"."rate_limit" USING "btree" ("window_start");



CREATE INDEX "idx_service_pricing_mode_lookup" ON "public"."service_pricing_mode" USING "btree" ("organization_id", "service_type_field_config_id", "service_type_value");



CREATE UNIQUE INDEX "idx_service_pricing_mode_unique" ON "public"."service_pricing_mode" USING "btree" ("organization_id", COALESCE("location_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "service_type_field_config_id", "service_type_value");



CREATE INDEX "idx_webhook_event_processed_at" ON "public"."webhook_event" USING "btree" ("processed_at" DESC);



CREATE INDEX "idx_webhook_event_status" ON "public"."webhook_event" USING "btree" ("status");



CREATE INDEX "idx_webhook_event_type" ON "public"."webhook_event" USING "btree" ("event_type");



CREATE INDEX "idx_worker_org" ON "public"."worker" USING "btree" ("organization_id");



CREATE INDEX "idx_worker_org_active" ON "public"."worker" USING "btree" ("organization_id", "active") WHERE ("active" = true);



CREATE INDEX "idx_worker_payment_allocation_job" ON "public"."worker_payment_allocation" USING "btree" ("job_id");



CREATE INDEX "idx_worker_payment_allocation_org" ON "public"."worker_payment_allocation" USING "btree" ("organization_id");



CREATE INDEX "idx_worker_payment_allocation_worker" ON "public"."worker_payment_allocation" USING "btree" ("worker_id");



CREATE INDEX "idx_worker_payment_batch" ON "public"."worker_payment" USING "btree" ("batch_id");



CREATE INDEX "idx_worker_payment_batch_created" ON "public"."worker_payment_batch" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_worker_payment_batch_org" ON "public"."worker_payment_batch" USING "btree" ("organization_id");



CREATE INDEX "idx_worker_payment_batch_org_status" ON "public"."worker_payment_batch" USING "btree" ("organization_id", "status", "calculated_at" DESC);



CREATE INDEX "idx_worker_payment_batch_status" ON "public"."worker_payment_batch" USING "btree" ("status");



CREATE INDEX "idx_worker_payment_created" ON "public"."worker_payment" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_worker_payment_job" ON "public"."worker_payment" USING "btree" ("job_id");



CREATE INDEX "idx_worker_payment_org" ON "public"."worker_payment" USING "btree" ("organization_id");



CREATE INDEX "idx_worker_payment_org_job" ON "public"."worker_payment" USING "btree" ("organization_id", "job_id");



CREATE INDEX "idx_worker_payment_org_status" ON "public"."worker_payment" USING "btree" ("organization_id", "status", "created_at" DESC);



COMMENT ON INDEX "public"."idx_worker_payment_org_status" IS 'Optimizes worker payment queries by organization and status';



CREATE INDEX "idx_worker_payment_status" ON "public"."worker_payment" USING "btree" ("status");



CREATE INDEX "idx_worker_payment_worker" ON "public"."worker_payment" USING "btree" ("worker_id");



CREATE INDEX "idx_worker_rate_card_active" ON "public"."worker_rate_card" USING "btree" ("organization_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_worker_rate_card_field_field_config" ON "public"."worker_rate_card_field" USING "btree" ("field_config_id");



CREATE INDEX "idx_worker_rate_card_field_rate_card" ON "public"."worker_rate_card_field" USING "btree" ("rate_card_id");



CREATE INDEX "idx_worker_rate_card_lookup" ON "public"."worker_rate_card" USING "btree" ("worker_id", "modifier_type", "effective_from" DESC) WHERE ("is_active" = true);



CREATE INDEX "idx_worker_rate_card_org" ON "public"."worker_rate_card" USING "btree" ("organization_id");



CREATE INDEX "idx_worker_rate_card_worker" ON "public"."worker_rate_card" USING "btree" ("worker_id");



CREATE OR REPLACE TRIGGER "trg_pricing_condition_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."pricing_condition" FOR EACH ROW EXECUTE FUNCTION "public"."log_pricing_condition_change"();



CREATE OR REPLACE TRIGGER "trg_pricing_rule_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."pricing_rule" FOR EACH ROW EXECUTE FUNCTION "public"."log_pricing_rule_change"();



CREATE OR REPLACE TRIGGER "update_form_section_updated_at" BEFORE UPDATE ON "public"."form_section" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_location_hierarchy_updated_at" BEFORE UPDATE ON "public"."location_hierarchy" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pricing_condition_updated_at" BEFORE UPDATE ON "public"."pricing_condition" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pricing_rule_updated_at" BEFORE UPDATE ON "public"."pricing_rule" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_worker_payment_allocation_updated_at" BEFORE UPDATE ON "public"."worker_payment_allocation" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_worker_payment_batch_updated_at" BEFORE UPDATE ON "public"."worker_payment_batch" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_worker_payment_updated_at" BEFORE UPDATE ON "public"."worker_payment" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_worker_rate_card_updated_at" BEFORE UPDATE ON "public"."worker_rate_card" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."base_pricing"
    ADD CONSTRAINT "base_pricing_job_type_field_config_id_fkey" FOREIGN KEY ("job_type_field_config_id") REFERENCES "public"."organization_field_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."base_pricing"
    ADD CONSTRAINT "base_pricing_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."base_pricing"
    ADD CONSTRAINT "base_pricing_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id");



ALTER TABLE ONLY "public"."field_pricing"
    ADD CONSTRAINT "field_pricing_field_config_id_fkey" FOREIGN KEY ("field_config_id") REFERENCES "public"."organization_field_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."field_pricing"
    ADD CONSTRAINT "field_pricing_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."field_pricing"
    ADD CONSTRAINT "field_pricing_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_section"
    ADD CONSTRAINT "form_section_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_job"
    ADD CONSTRAINT "invoice_job_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_job"
    ADD CONSTRAINT "invoice_job_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice"
    ADD CONSTRAINT "invoice_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice"
    ADD CONSTRAINT "invoice_payment_link_id_fkey" FOREIGN KEY ("payment_link_id") REFERENCES "public"."payment_link"("id");



ALTER TABLE ONLY "public"."invoice_send_outbox"
    ADD CONSTRAINT "invoice_send_outbox_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_send_outbox"
    ADD CONSTRAINT "invoice_send_outbox_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_template_config"
    ADD CONSTRAINT "invoice_template_config_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_edits"
    ADD CONSTRAINT "job_edits_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job"
    ADD CONSTRAINT "job_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id");



ALTER TABLE ONLY "public"."job"
    ADD CONSTRAINT "job_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_worker"
    ADD CONSTRAINT "job_worker_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_worker"
    ADD CONSTRAINT "job_worker_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_field_config"
    ADD CONSTRAINT "location_field_config_field_config_id_fkey" FOREIGN KEY ("field_config_id") REFERENCES "public"."organization_field_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_field_config"
    ADD CONSTRAINT "location_field_config_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_hierarchy"
    ADD CONSTRAINT "location_hierarchy_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_hierarchy"
    ADD CONSTRAINT "location_hierarchy_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."location_hierarchy"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location"
    ADD CONSTRAINT "location_hierarchy_parent_id_fkey1" FOREIGN KEY ("hierarchy_parent_id") REFERENCES "public"."location_hierarchy"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."location"
    ADD CONSTRAINT "location_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification"
    ADD CONSTRAINT "notification_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification"
    ADD CONSTRAINT "notification_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."organization_user"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."option_pricing"
    ADD CONSTRAINT "option_pricing_field_config_id_fkey" FOREIGN KEY ("field_config_id") REFERENCES "public"."organization_field_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."option_pricing"
    ADD CONSTRAINT "option_pricing_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."option_pricing"
    ADD CONSTRAINT "option_pricing_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_field_configs"
    ADD CONSTRAINT "organization_field_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_field_configs"
    ADD CONSTRAINT "organization_field_configs_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."form_section"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_settings"
    ADD CONSTRAINT "organization_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_user"
    ADD CONSTRAINT "organization_user_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organization_user"
    ADD CONSTRAINT "organization_user_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment"
    ADD CONSTRAINT "payment_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_link"
    ADD CONSTRAINT "payment_link_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_link"
    ADD CONSTRAINT "payment_link_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment"
    ADD CONSTRAINT "payment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment"
    ADD CONSTRAINT "payment_reconciled_by_fkey" FOREIGN KEY ("reconciled_by") REFERENCES "public"."organization_user"("id");



ALTER TABLE ONLY "public"."pricing_condition"
    ADD CONSTRAINT "pricing_condition_condition_field_config_id_fkey" FOREIGN KEY ("condition_field_config_id") REFERENCES "public"."organization_field_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_condition"
    ADD CONSTRAINT "pricing_condition_pricing_rule_id_fkey" FOREIGN KEY ("pricing_rule_id") REFERENCES "public"."pricing_rule"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_rule"
    ADD CONSTRAINT "pricing_rule_field_config_id_fkey" FOREIGN KEY ("field_config_id") REFERENCES "public"."organization_field_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_rule"
    ADD CONSTRAINT "pricing_rule_location_hierarchy_id_fkey" FOREIGN KEY ("location_hierarchy_id") REFERENCES "public"."location_hierarchy"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_rule"
    ADD CONSTRAINT "pricing_rule_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_rule"
    ADD CONSTRAINT "pricing_rule_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_snapshot"
    ADD CONSTRAINT "pricing_snapshot_field_config_id_fkey" FOREIGN KEY ("field_config_id") REFERENCES "public"."organization_field_configs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pricing_snapshot"
    ADD CONSTRAINT "pricing_snapshot_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_snapshot"
    ADD CONSTRAINT "pricing_snapshot_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pricing_snapshot"
    ADD CONSTRAINT "pricing_snapshot_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_snapshot"
    ADD CONSTRAINT "pricing_snapshot_pricing_rule_id_fkey" FOREIGN KEY ("pricing_rule_id") REFERENCES "public"."pricing_rule"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_pricing_mode"
    ADD CONSTRAINT "service_pricing_mode_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_pricing_mode"
    ADD CONSTRAINT "service_pricing_mode_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_pricing_mode"
    ADD CONSTRAINT "service_pricing_mode_service_type_field_config_id_fkey" FOREIGN KEY ("service_type_field_config_id") REFERENCES "public"."organization_field_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_invitation"
    ADD CONSTRAINT "worker_invitation_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_invitation"
    ADD CONSTRAINT "worker_invitation_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker"
    ADD CONSTRAINT "worker_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_payment_allocation"
    ADD CONSTRAINT "worker_payment_allocation_field_config_id_fkey" FOREIGN KEY ("field_config_id") REFERENCES "public"."organization_field_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_payment_allocation"
    ADD CONSTRAINT "worker_payment_allocation_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_payment_allocation"
    ADD CONSTRAINT "worker_payment_allocation_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_payment_allocation"
    ADD CONSTRAINT "worker_payment_allocation_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_payment_batch"
    ADD CONSTRAINT "worker_payment_batch_calculated_by_fkey" FOREIGN KEY ("calculated_by") REFERENCES "public"."organization_user"("id");



ALTER TABLE ONLY "public"."worker_payment"
    ADD CONSTRAINT "worker_payment_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."worker_payment_batch"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."worker_payment_batch"
    ADD CONSTRAINT "worker_payment_batch_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_payment"
    ADD CONSTRAINT "worker_payment_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_payment"
    ADD CONSTRAINT "worker_payment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_payment"
    ADD CONSTRAINT "worker_payment_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."organization_user"("id");



ALTER TABLE ONLY "public"."worker_payment"
    ADD CONSTRAINT "worker_payment_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_rate_card_field"
    ADD CONSTRAINT "worker_rate_card_field_field_config_id_fkey" FOREIGN KEY ("field_config_id") REFERENCES "public"."organization_field_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_rate_card_field"
    ADD CONSTRAINT "worker_rate_card_field_rate_card_id_fkey" FOREIGN KEY ("rate_card_id") REFERENCES "public"."worker_rate_card"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_rate_card"
    ADD CONSTRAINT "worker_rate_card_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_rate_card"
    ADD CONSTRAINT "worker_rate_card_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can submit feedback" ON "public"."feedback" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."job"
  WHERE (("job"."id" = "feedback"."job_id") AND ("job"."feedback_token" IS NOT NULL)))));



CREATE POLICY "Anyone can view invitations" ON "public"."worker_invitation" FOR SELECT USING (true);



CREATE POLICY "Service role and authenticated can view worker" ON "public"."worker" FOR SELECT USING (((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text") OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "Service role and authenticated read pricing_condition_audit" ON "public"."pricing_condition_audit" USING (((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text") OR ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text") AND true))) WITH CHECK ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role and authenticated read pricing_rule_audit" ON "public"."pricing_rule_audit" USING (((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text") OR ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text") AND true))) WITH CHECK ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role and authenticated read webhook_event" ON "public"."webhook_event" USING (((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text") OR ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text") AND true))) WITH CHECK ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can delete worker" ON "public"."worker" FOR DELETE USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage base_pricing" ON "public"."base_pricing" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage field_pricing" ON "public"."field_pricing" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage invoice" ON "public"."invoice" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage invoice_job" ON "public"."invoice_job" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage invoice_send_outbox" ON "public"."invoice_send_outbox" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage invoice_template_config" ON "public"."invoice_template_config" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage job" ON "public"."job" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage job_edits" ON "public"."job_edits" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage job_worker" ON "public"."job_worker" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage location" ON "public"."location" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage location_field_config" ON "public"."location_field_config" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage location_hierarchy" ON "public"."location_hierarchy" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage notification" ON "public"."notification" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));

CREATE POLICY "Authenticated users can read own notifications" ON "public"."notification" FOR SELECT TO authenticated USING ((receiver_id IN ( SELECT organization_user.id FROM organization_user WHERE (organization_user.auth_user_id = auth.uid()))));

CREATE POLICY "Authenticated users can update own notifications" ON "public"."notification" FOR UPDATE TO authenticated USING ((receiver_id IN ( SELECT organization_user.id FROM organization_user WHERE (organization_user.auth_user_id = auth.uid())))) WITH CHECK ((receiver_id IN ( SELECT organization_user.id FROM organization_user WHERE (organization_user.auth_user_id = auth.uid()))));



CREATE POLICY "Service role can manage option_pricing" ON "public"."option_pricing" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage organization" ON "public"."organization" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage organization_field_configs" ON "public"."organization_field_configs" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage organization_settings" ON "public"."organization_settings" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage organization_user" ON "public"."organization_user" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage payment" ON "public"."payment" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage payment_link" ON "public"."payment_link" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage pricing_condition" ON "public"."pricing_condition" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage pricing_rule" ON "public"."pricing_rule" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage pricing_snapshot" ON "public"."pricing_snapshot" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage rate_limit" ON "public"."rate_limit" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage service_pricing_mode" ON "public"."service_pricing_mode" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage worker_payment" ON "public"."worker_payment" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage worker_payment_allocation" ON "public"."worker_payment_allocation" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage worker_payment_batch" ON "public"."worker_payment_batch" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage worker_rate_card" ON "public"."worker_rate_card" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can manage worker_rate_card_field" ON "public"."worker_rate_card_field" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can modify worker" ON "public"."worker" FOR INSERT WITH CHECK ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can read feedback" ON "public"."feedback" FOR SELECT USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role can update worker" ON "public"."worker" FOR UPDATE USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'service_role'::"text"));



CREATE POLICY "Service role full access" ON "public"."worker" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role manages invitations" ON "public"."worker_invitation" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role updates invitations" ON "public"."worker_invitation" FOR UPDATE TO "service_role" USING (true);



CREATE POLICY "Users can create sections for their organization" ON "public"."form_section" FOR INSERT WITH CHECK ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'authenticated'::"text"));



CREATE POLICY "Users can delete their organization's sections" ON "public"."form_section" FOR DELETE USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'authenticated'::"text"));



CREATE POLICY "Users can update their organization's sections" ON "public"."form_section" FOR UPDATE USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'authenticated'::"text"));



CREATE POLICY "Users can view their organization's sections" ON "public"."form_section" FOR SELECT USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'authenticated'::"text"));



ALTER TABLE "public"."base_pricing" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."field_pricing" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."form_section" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_job" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_send_outbox" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_template_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_edits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_worker" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."location" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."location_field_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."location_hierarchy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."option_pricing" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_field_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_user" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_link" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_condition" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_condition_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_rule" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_rule_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_snapshot" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_pricing_mode" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_event" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_invitation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_payment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_payment_allocation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_payment_batch" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_rate_card" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_rate_card_field" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_invoice_atomic"("p_organization_id" "uuid", "p_job_ids" "uuid"[], "p_due_date" timestamp with time zone, "p_notes" "text", "p_subtotal" numeric, "p_total" numeric, "p_currency" "text", "p_status" "text", "p_snapshot_records" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_invoice_atomic"("p_organization_id" "uuid", "p_job_ids" "uuid"[], "p_due_date" timestamp with time zone, "p_notes" "text", "p_subtotal" numeric, "p_total" numeric, "p_currency" "text", "p_status" "text", "p_snapshot_records" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_invoice_atomic"("p_organization_id" "uuid", "p_job_ids" "uuid"[], "p_due_date" timestamp with time zone, "p_notes" "text", "p_subtotal" numeric, "p_total" numeric, "p_currency" "text", "p_status" "text", "p_snapshot_records" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invoice_number"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_pricing_condition_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_pricing_condition_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_pricing_condition_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_pricing_rule_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_pricing_rule_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_pricing_rule_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."base_pricing" TO "anon";
GRANT ALL ON TABLE "public"."base_pricing" TO "authenticated";
GRANT ALL ON TABLE "public"."base_pricing" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."field_pricing" TO "anon";
GRANT ALL ON TABLE "public"."field_pricing" TO "authenticated";
GRANT ALL ON TABLE "public"."field_pricing" TO "service_role";



GRANT ALL ON TABLE "public"."form_section" TO "anon";
GRANT ALL ON TABLE "public"."form_section" TO "authenticated";
GRANT ALL ON TABLE "public"."form_section" TO "service_role";



GRANT ALL ON TABLE "public"."invoice" TO "anon";
GRANT ALL ON TABLE "public"."invoice" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_job" TO "anon";
GRANT ALL ON TABLE "public"."invoice_job" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_job" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_send_outbox" TO "anon";
GRANT ALL ON TABLE "public"."invoice_send_outbox" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_send_outbox" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_template_config" TO "anon";
GRANT ALL ON TABLE "public"."invoice_template_config" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_template_config" TO "service_role";



GRANT ALL ON TABLE "public"."job" TO "anon";
GRANT ALL ON TABLE "public"."job" TO "authenticated";
GRANT ALL ON TABLE "public"."job" TO "service_role";



GRANT ALL ON TABLE "public"."job_edits" TO "anon";
GRANT ALL ON TABLE "public"."job_edits" TO "authenticated";
GRANT ALL ON TABLE "public"."job_edits" TO "service_role";



GRANT ALL ON SEQUENCE "public"."job_edits_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."job_edits_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."job_edits_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."job_worker" TO "anon";
GRANT ALL ON TABLE "public"."job_worker" TO "authenticated";
GRANT ALL ON TABLE "public"."job_worker" TO "service_role";



GRANT ALL ON TABLE "public"."location" TO "anon";
GRANT ALL ON TABLE "public"."location" TO "authenticated";
GRANT ALL ON TABLE "public"."location" TO "service_role";



GRANT ALL ON TABLE "public"."organization" TO "anon";
GRANT ALL ON TABLE "public"."organization" TO "authenticated";
GRANT ALL ON TABLE "public"."organization" TO "service_role";



GRANT ALL ON TABLE "public"."worker" TO "anon";
GRANT ALL ON TABLE "public"."worker" TO "authenticated";
GRANT ALL ON TABLE "public"."worker" TO "service_role";



GRANT ALL ON TABLE "public"."job_summary" TO "anon";
GRANT ALL ON TABLE "public"."job_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."job_summary" TO "service_role";



GRANT ALL ON TABLE "public"."location_field_config" TO "anon";
GRANT ALL ON TABLE "public"."location_field_config" TO "authenticated";
GRANT ALL ON TABLE "public"."location_field_config" TO "service_role";



GRANT ALL ON TABLE "public"."location_hierarchy" TO "anon";
GRANT ALL ON TABLE "public"."location_hierarchy" TO "authenticated";
GRANT ALL ON TABLE "public"."location_hierarchy" TO "service_role";



GRANT ALL ON TABLE "public"."notification" TO "anon";
GRANT ALL ON TABLE "public"."notification" TO "authenticated";
GRANT ALL ON TABLE "public"."notification" TO "service_role";



GRANT ALL ON TABLE "public"."option_pricing" TO "anon";
GRANT ALL ON TABLE "public"."option_pricing" TO "authenticated";
GRANT ALL ON TABLE "public"."option_pricing" TO "service_role";



GRANT ALL ON TABLE "public"."organization_field_configs" TO "anon";
GRANT ALL ON TABLE "public"."organization_field_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_field_configs" TO "service_role";



GRANT ALL ON TABLE "public"."organization_settings" TO "anon";
GRANT ALL ON TABLE "public"."organization_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_settings" TO "service_role";



GRANT ALL ON TABLE "public"."organization_user" TO "anon";
GRANT ALL ON TABLE "public"."organization_user" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_user" TO "service_role";



GRANT ALL ON TABLE "public"."payment" TO "anon";
GRANT ALL ON TABLE "public"."payment" TO "authenticated";
GRANT ALL ON TABLE "public"."payment" TO "service_role";



GRANT ALL ON TABLE "public"."payment_link" TO "anon";
GRANT ALL ON TABLE "public"."payment_link" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_link" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_condition" TO "anon";
GRANT ALL ON TABLE "public"."pricing_condition" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_condition" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_condition_audit" TO "anon";
GRANT ALL ON TABLE "public"."pricing_condition_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_condition_audit" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pricing_condition_audit_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pricing_condition_audit_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pricing_condition_audit_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_rule" TO "anon";
GRANT ALL ON TABLE "public"."pricing_rule" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_rule" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_rule_audit" TO "anon";
GRANT ALL ON TABLE "public"."pricing_rule_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_rule_audit" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pricing_rule_audit_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pricing_rule_audit_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pricing_rule_audit_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."pricing_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_snapshot" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limit" TO "anon";
GRANT ALL ON TABLE "public"."rate_limit" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limit" TO "service_role";



GRANT ALL ON TABLE "public"."service_pricing_mode" TO "anon";
GRANT ALL ON TABLE "public"."service_pricing_mode" TO "authenticated";
GRANT ALL ON TABLE "public"."service_pricing_mode" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_event" TO "anon";
GRANT ALL ON TABLE "public"."webhook_event" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_event" TO "service_role";



GRANT ALL ON TABLE "public"."worker_invitation" TO "anon";
GRANT ALL ON TABLE "public"."worker_invitation" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_invitation" TO "service_role";



GRANT ALL ON TABLE "public"."worker_payment" TO "anon";
GRANT ALL ON TABLE "public"."worker_payment" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_payment" TO "service_role";



GRANT ALL ON TABLE "public"."worker_payment_allocation" TO "anon";
GRANT ALL ON TABLE "public"."worker_payment_allocation" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_payment_allocation" TO "service_role";



GRANT ALL ON TABLE "public"."worker_payment_batch" TO "anon";
GRANT ALL ON TABLE "public"."worker_payment_batch" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_payment_batch" TO "service_role";



GRANT ALL ON TABLE "public"."worker_rate_card" TO "anon";
GRANT ALL ON TABLE "public"."worker_rate_card" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_rate_card" TO "service_role";



GRANT ALL ON TABLE "public"."worker_rate_card_field" TO "anon";
GRANT ALL ON TABLE "public"."worker_rate_card_field" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_rate_card_field" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







