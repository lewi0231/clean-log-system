import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { createInvoiceSchema, validateRequest } from "../_utils/zod-schemas.ts";

interface AppliedRule {
  pricing_rule_id: string;
  scope: string;
  pricing_type: string;
  field_config_id: string | null;
  option_value: string | null;
  location_hierarchy_id: string | null;
  location_id: string | null;
  amount: number;
  worker_payment: number;
  metadata: Record<string, unknown>;
  line_item_key?: string;
  snapshot_data: Record<string, unknown>;
}

interface InvoiceCalculation {
  job_id: string;
  base_price: number;
  line_items: Array<{
    field_config_id: string;
    field_name: string;
    field_label: string;
    option_value?: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  applied_rules: AppliedRule[];
  subtotal: number;
  total_adjustments: number;
  total: number;
  worker_payment_total: number;
  margin: number;
}

interface JobWithLocation {
  id: string;
  location: {
    id: string;
    hierarchy_parent_id: string | null;
  }[] | null;
}

interface HierarchyNode {
  id: string;
  metadata: Record<string, unknown> | null;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "create-invoice" });

  try {
    const rawBody = await req.json();

    // Validate request body with Zod schema
    const validation = validateRequest(createInvoiceSchema, rawBody);
    if (!validation.success) {
      logger.warn("Invalid request body for invoice creation", {
        errors: validation.issues,
      });
      return errorResponse(validation.error, 400);
    }

    const body = validation.data as {
      organization_id: string;
      job_ids: string[];
      due_date: string;
      notes?: string;
      email?: string;
    };
    const { organization_id, job_ids, due_date, notes } = body;

    const supabase = createServiceRoleClient();

    // Verify organization membership - pass body (with email from validation) so email can be extracted
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
      body as Record<string, unknown>,
    );
    if (!membershipCheck) {
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // Verify jobs exist and belong to organization
    const { data: jobs, error: jobsError } = await supabase
      .from("job")
      .select("id, organization_id")
      .eq("organization_id", organization_id)
      .in("id", job_ids);

    if (jobsError) throw jobsError;

    if (!jobs || jobs.length !== job_ids.length) {
      return errorResponse(
        "One or more jobs not found or don't belong to organization",
        404,
      );
    }

    // Check if any of these jobs are already on an invoice
    const { data: existingInvoiceJobs, error: existingError } = await supabase
      .from("invoice_job")
      .select(`
        job_id,
        invoice:invoice_id (
          id,
          invoice_number,
          status
        )
      `)
      .in("job_id", job_ids);

    if (existingError) throw existingError;

    if (existingInvoiceJobs && existingInvoiceJobs.length > 0) {
      // Get the list of already-invoiced jobs with their invoice numbers
      // Handle invoice - it might be an array or single object from Supabase
      const invoicedJobsInfo = existingInvoiceJobs
        .filter((ij) => ij.invoice !== null)
        .map((ij) => {
          const invoiceRaw = ij.invoice as unknown;
          const invoice = Array.isArray(invoiceRaw)
            ? invoiceRaw[0]
            : invoiceRaw;
          const invoiceObj = invoice as {
            invoice_number?: string;
            status?: string;
          } | null;
          return {
            job_id: ij.job_id,
            invoice_number: invoiceObj?.invoice_number || "",
            status: invoiceObj?.status || "",
          };
        });

      if (invoicedJobsInfo.length > 0) {
        const invoiceNumbers = [
          ...new Set(invoicedJobsInfo.map((i) => i.invoice_number)),
        ];
        return errorResponse(
          `Cannot create invoice: ${invoicedJobsInfo.length} job(s) are already included in invoice(s): ${
            invoiceNumbers.join(", ")
          }. Each job can only be invoiced once.`,
          400,
        );
      }
    }

    // Calculate invoice totals by calling calculate-invoice function
    // IMPORTANT: Pass email for nested function auth (service role key doesn't carry user context)
    // Use membershipCheck.userEmail which is extracted from JWT token, not body.email
    const { data: calculationData, error: calcError } = await supabase.functions
      .invoke("calculate-invoice", {
        body: {
          organization_id,
          job_ids,
          email: membershipCheck.userEmail || body.email, // Use JWT email first, fallback to body.email
        },
      });

    if (calcError) throw calcError;

    if (!calculationData || !calculationData.calculation) {
      return errorResponse("Failed to calculate invoice totals", 500);
    }

    const calculation = calculationData.calculation;

    // Fetch organization to get invoice_send_immediately setting
    const { data: organization, error: orgError } = await supabase
      .from("organization")
      .select("invoice_send_immediately")
      .eq("id", organization_id)
      .single();

    if (orgError) {
      logger.warn(
        "Failed to fetch organization settings, defaulting to draft",
        {
          organization_id,
          error: orgError,
        },
      );
    }

    // Fetch organization settings to get currency
    const { data: orgSettings, error: orgSettingsError } = await supabase
      .from("organization_settings")
      .select("currency")
      .eq("organization_id", organization_id)
      .single();

    if (orgSettingsError) {
      logger.warn("Failed to fetch organization currency, defaulting to AUD", {
        organization_id,
        error: orgSettingsError,
      });
    }

    const currency = orgSettings?.currency || "AUD";

    // Check if we should send immediately, but first check for location hierarchy auto-send override
    // If any job's location has a hierarchy parent with auto-send enabled, we should create as draft
    let shouldSendImmediately = organization?.invoice_send_immediately || false;

    if (shouldSendImmediately) {
      // Check if any job locations belong to a hierarchy with auto-send enabled
      // If so, defer to the scheduled auto-send instead
      const { data: jobsWithLocations } = await supabase
        .from("job")
        .select(`
          id,
          location:location_id (
            id,
            hierarchy_parent_id
          )
        `)
        .eq("organization_id", organization_id)
        .in("id", job_ids);

      if (jobsWithLocations && jobsWithLocations.length > 0) {
        const hierarchyParentIds = (jobsWithLocations as JobWithLocation[])
          .map((job) => {
            const location = Array.isArray(job.location)
              ? job.location[0]
              : job.location;
            return location?.hierarchy_parent_id;
          })
          .filter((id: string | null | undefined): id is string => !!id);

        if (hierarchyParentIds.length > 0) {
          const { data: hierarchyNodes } = await supabase
            .from("location_hierarchy")
            .select("id, metadata")
            .in("id", hierarchyParentIds)
            .eq("active", true);

          // Check if any hierarchy node has auto-send enabled
          const hasAutoSendEnabled = (hierarchyNodes as HierarchyNode[] | null)
            ?.some((node) => {
              const metadata = node.metadata as Record<string, unknown> | null;
              if (!metadata || typeof metadata !== "object") return false;
              const autoSend = metadata.auto_send_invoices;
              if (!autoSend || typeof autoSend !== "object") return false;
              const config = autoSend as Record<string, unknown>;
              return config.enabled === true;
            });

          // If auto-send is enabled on hierarchy, create as draft to be sent on schedule
          if (hasAutoSendEnabled) {
            shouldSendImmediately = false;
          }
        }
      }
    }

    // Generate invoice number
    const initialStatus = shouldSendImmediately ? "sent" : "draft";

    const snapshotRecords =
      calculation.job_calculations?.flatMap((jobCalc: InvoiceCalculation) =>
        (jobCalc.applied_rules || []).map((rule: AppliedRule) => ({
          job_id: jobCalc.job_id,
          pricing_rule_id: rule.pricing_rule_id,
          field_config_id: rule.field_config_id,
          line_item_key: rule.line_item_key || null,
          snapshot_data: rule.snapshot_data || {},
        }))
      ) || [];

    // Create invoice + invoice_job + pricing_snapshot atomically (RPC)
    const { data: invoiceId, error: atomicError } = await supabase.rpc(
      "create_invoice_atomic",
      {
        p_organization_id: organization_id,
        p_job_ids: job_ids,
        p_due_date: due_date,
        p_notes: notes || null,
        p_subtotal: calculation.total_subtotal,
        p_total: calculation.total,
        p_currency: currency,
        p_status: initialStatus,
        p_snapshot_records: snapshotRecords,
      },
    );

    if (atomicError) {
      // Friendly message for the most common atomic failure (job already invoiced)
      const msg = typeof atomicError.message === "string"
        ? atomicError.message
        : "Failed to create invoice";
      if (msg.toLowerCase().includes("idx_invoice_job_job_id_unique")) {
        return errorResponse(
          "Cannot create invoice: one or more jobs are already included in another invoice. Each job can only be invoiced once.",
          400,
        );
      }
      throw atomicError;
    }

    if (!invoiceId) {
      return errorResponse("Failed to create invoice", 500);
    }

    // Fetch invoice with related jobs and location info
    const { data: invoiceWithJobs, error: fetchError } = await supabase
      .from("invoice")
      .select(
        `
        *,
        invoice_job:invoice_job (
          job:job_id (
            id,
            completed_at,
            location:location_id (
              id,
              name,
              email,
              address,
              contact_person,
              phone
            )
          )
        )
        `,
      )
      .eq("id", invoiceId)
      .single();

    if (fetchError) throw fetchError;

    return jsonResponse({
      success: true,
      invoice: invoiceWithJobs,
    });
  } catch (error) {
    logger.error("Create invoice error", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to create invoice",
    );
  }
});
