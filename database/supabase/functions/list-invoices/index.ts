import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { listInvoicesSchema, validateRequest } from "../_utils/zod-schemas.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const rawBody = await req.json();
    const validation = validateRequest(listInvoicesSchema, rawBody);
    if (!validation.success) {
      return errorResponse(validation.error, 400);
    }

    const { organization_id, start_date, end_date, include_tests } = validation
      .data as {
        organization_id: string;
        start_date?: string;
        end_date?: string;
        include_tests?: boolean;
      };

    const supabase = createServiceRoleClient();

    // Build query
    let query = supabase
      .from("invoice")
      .select(
        `
        *,
        is_test,
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
        `,
      )
      .eq("organization_id", organization_id);

    // Exclude test invoices by default
    if (!include_tests) {
      query = query.eq("is_test", false);
    }

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
      { ascending: false },
    );

    if (invoicesError) throw invoicesError;

    return jsonResponse({
      success: true,
      invoices: invoices || [],
    });
  } catch (error) {
    console.error("List invoices error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list invoices",
    );
  }
});
