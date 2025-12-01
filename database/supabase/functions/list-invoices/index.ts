import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["organization_id"]);

    if (!validation.valid) {
      return errorResponse("Organization ID is required", 400);
    }

    const { organization_id, start_date, end_date } = body;

    const supabase = createServiceRoleClient();

    // Build query
    let query = supabase
      .from("invoice")
      .select(
        `
        *,
        invoice_job:invoice_job (
          job:job_id (
            id,
            completed_at,
            created_at,
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
      .eq("organization_id", organization_id);

    // Apply date range filter if provided
    if (start_date) {
      query = query.gte("created_at", start_date);
    }
    if (end_date) {
      query = query.lte("created_at", end_date);
    }

    // Order by created_at descending (most recent first)
    const { data: invoices, error: invoicesError } = await query.order(
      "created_at",
      { ascending: false }
    );

    if (invoicesError) throw invoicesError;

    return jsonResponse({
      success: true,
      invoices: invoices || [],
    });
  } catch (error) {
    console.error("List invoices error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list invoices"
    );
  }
});
