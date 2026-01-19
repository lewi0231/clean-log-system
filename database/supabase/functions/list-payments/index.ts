import { serve } from "server";
import { loadEnvIfLocal } from "../_utils/env.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { uuidSchema, validateRequest } from "../_utils/zod-schemas.ts";

// Use fully qualified URL to avoid import map resolution issues
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Inline dependency is intentional for cross-function compatibility
import { z } from "https://esm.sh/zod@3.23.8";

/**
 * Schema for listing payments
 */
const listPaymentsSchema = z.object({
  organization_id: uuidSchema,
  invoice_id: uuidSchema.optional(),
});

/**
 * List Payments Edge Function
 *
 * Fetches payments for an organization, optionally filtered by invoice_id.
 * Returns payments sorted by created_at descending (newest first).
 */
serve(async (req: Request) => {
  // Load environment variables for local development
  await loadEnvIfLocal();

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "list-payments" });

  try {
    const rawBody = await req.json();

    // Validate request body with Zod schema
    const validation = validateRequest(listPaymentsSchema, rawBody);
    if (!validation.success) {
      logger.warn("Invalid request body for list payments", {
        errors: validation.issues,
      });
      return errorResponse(validation.error, 400);
    }

    const { organization_id, invoice_id } = validation.data;

    logger.info("Listing payments", {
      organization_id,
      invoice_id: invoice_id || "all",
    });

    const supabase = createServiceRoleClient();

    // Build query
    let query = supabase
      .from("payment")
      .select("*")
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false });

    // Filter by invoice_id if provided
    if (invoice_id) {
      query = query.eq("invoice_id", invoice_id);
    }

    const { data: payments, error: queryError } = await query;

    if (queryError) {
      logger.error("Failed to query payments", queryError);
      throw queryError;
    }

    logger.info("Payments retrieved successfully", {
      count: payments?.length || 0,
    });

    return jsonResponse({
      success: true,
      payments: payments || [],
    });
  } catch (error) {
    logger.error("List payments error", error);
    const errorMessage = extractErrorMessage(error, "Failed to list payments");
    const statusCode = getErrorStatusCode(error);
    return errorResponse(errorMessage, statusCode);
  }
});
