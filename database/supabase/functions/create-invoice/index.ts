import { SupabaseClient } from "@supabase/supabase-js";
import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

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

async function generateInvoiceNumber(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string> {
  // Get organization to get org_code
  const { data: org, error: orgError } = await supabase
    .from("organization")
    .select("org_code")
    .eq("id", organizationId)
    .single();

  if (orgError || !org) {
    throw new Error("Failed to fetch organization");
  }

  const orgCode = org.org_code;
  const year = new Date().getFullYear();

  // Find the highest invoice number for this org and year
  const { data: existingInvoices, error: invoiceError } = await supabase
    .from("invoice")
    .select("invoice_number")
    .eq("organization_id", organizationId)
    .like("invoice_number", `${orgCode}-${year}-%`)
    .order("invoice_number", { ascending: false })
    .limit(1);

  if (invoiceError) {
    throw invoiceError;
  }

  let nextNumber = 1;
  if (existingInvoices && existingInvoices.length > 0) {
    const lastInvoice = existingInvoices[0].invoice_number;
    const match = lastInvoice.match(/-(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  // Format: ORG-YYYY-#### (e.g., ACME-2024-0001)
  const invoiceNumber = `${orgCode}-${year}-${
    nextNumber
      .toString()
      .padStart(4, "0")
  }`;

  return invoiceNumber;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_id",
      "job_ids",
      "due_date",
    ]);

    if (!validation.valid) {
      return errorResponse(
        "Organization ID, job IDs, and due date are required",
        400,
      );
    }

    const { organization_id, job_ids, due_date, notes } = body;

    if (!Array.isArray(job_ids) || job_ids.length === 0) {
      return errorResponse("job_ids must be a non-empty array", 400);
    }

    const supabase = createServiceRoleClient();

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

    // Calculate invoice totals by calling calculate-invoice function
    const { data: calculationData, error: calcError } = await supabase.functions
      .invoke("calculate-invoice", {
        body: {
          organization_id,
          job_ids,
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
      console.warn(
        "Failed to fetch organization settings, defaulting to draft:",
        orgError,
      );
    }

    // Fetch organization settings to get currency
    const { data: orgSettings, error: orgSettingsError } = await supabase
      .from("organization_settings")
      .select("currency")
      .eq("organization_id", organization_id)
      .single();

    if (orgSettingsError) {
      console.warn(
        "Failed to fetch organization currency, defaulting to AUD:",
        orgSettingsError,
      );
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
    const invoiceNumber = await generateInvoiceNumber(
      supabase,
      organization_id,
    );

    // Create invoice with appropriate status
    const initialStatus = shouldSendImmediately ? "sent" : "draft";

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoice")
      .insert({
        organization_id,
        invoice_number: invoiceNumber,
        status: initialStatus,
        subtotal: calculation.total_subtotal,
        total: calculation.total,
        currency: currency,
        due_date: due_date,
        notes: notes || null,
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Create invoice_job records
    const invoiceJobRecords = job_ids.map((jobId: string) => ({
      invoice_id: invoice.id,
      job_id: jobId,
    }));

    const { error: invoiceJobError } = await supabase
      .from("invoice_job")
      .insert(invoiceJobRecords);

    if (invoiceJobError) throw invoiceJobError;

    const snapshotRecords =
      calculation.job_calculations?.flatMap((jobCalc: InvoiceCalculation) =>
        (jobCalc.applied_rules || []).map((rule: AppliedRule) => ({
          organization_id,
          invoice_id: invoice.id,
          job_id: jobCalc.job_id,
          pricing_rule_id: rule.pricing_rule_id,
          field_config_id: rule.field_config_id,
          line_item_key: rule.line_item_key || null,
          snapshot_data: rule.snapshot_data || {},
        }))
      ) || [];

    if (snapshotRecords.length > 0) {
      const { error: snapshotError } = await supabase
        .from("pricing_snapshot")
        .insert(snapshotRecords);

      if (snapshotError) throw snapshotError;
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
      .eq("id", invoice.id)
      .single();

    if (fetchError) throw fetchError;

    return jsonResponse({
      success: true,
      invoice: invoiceWithJobs,
    });
  } catch (error) {
    console.error("Create invoice error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to create invoice",
    );
  }
});
