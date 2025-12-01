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
    console.error("List form sections error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list form sections"
    );
  }
});
