/**
 * Lists form sections for an org. Future (multi–line of business): optional `line_of_business_id`
 * in the request body should filter `form_section` the same way as field configs.
 */
import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "list-form-sections" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["organization_id"]);

    if (!validation.valid) {
      return errorResponse("Organization ID is required", 400);
    }

    const { organization_id } = body;

    const supabase = createServiceRoleClient();

    const { data: sections, error: sectionsError } = await supabase
      .from("form_section")
      .select("*")
      .eq("organization_id", organization_id)
      .order("order_position", { ascending: true });

    if (sectionsError) throw sectionsError;

    return jsonResponse({
      success: true,
      sections: sections || [],
    });
  } catch (error) {
    logger.error("List form sections error", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list form sections"
    );
  }
});
