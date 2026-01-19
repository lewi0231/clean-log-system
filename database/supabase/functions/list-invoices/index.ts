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

    const {
      organization_id,
      start_date,
      end_date,
      include_tests,
      search,
      status,
      page,
      page_size,
    } = validation.data as {
      organization_id: string;
      start_date?: string;
      end_date?: string;
      include_tests?: boolean;
      search?: string;
      status?: string;
      page?: number;
      page_size?: number;
    };

    const supabase = createServiceRoleClient();

    // Default pagination values
    const currentPage = page || 1;
    const pageSize = page_size || 50;
    const offset = (currentPage - 1) * pageSize;

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
        { count: "exact" }
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

    // Apply search filter (invoice number)
    if (search && search.trim()) {
      query = query.ilike("invoice_number", `%${search.trim()}%`);
    }

    // Apply status filter
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

    // Order by created_at descending (most recent first)
    const { data: invoices, error: invoicesError, count } = await query.order(
      "created_at",
      { ascending: false },
    );

    if (invoicesError) throw invoicesError;

    return jsonResponse({
      success: true,
      invoices: invoices || [],
      pagination: {
        page: currentPage,
        page_size: pageSize,
        total_count: count || 0,
        total_pages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error("List invoices error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list invoices",
    );
  }
});
