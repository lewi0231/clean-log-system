import { SupabaseClient } from "@supabase/supabase-js";
import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

async function generateInvoiceNumber(
  supabase: SupabaseClient,
  organizationId: string
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
  const invoiceNumber = `${orgCode}-${year}-${nextNumber
    .toString()
    .padStart(4, "0")}`;

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
        400
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
        404
      );
    }

    // Calculate invoice totals by calling calculate-invoice function
    const { data: calculationData, error: calcError } =
      await supabase.functions.invoke("calculate-invoice", {
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

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(
      supabase,
      organization_id
    );

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoice")
      .insert({
        organization_id,
        invoice_number: invoiceNumber,
        status: "draft",
        subtotal: calculation.total_subtotal,
        total: calculation.total,
        currency: "USD",
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
        `
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
      error instanceof Error ? error : "Failed to create invoice"
    );
  }
});
