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

    const { data: workers, error: workersError } = await supabase
      .from("worker")
      .select("*")
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false });

    if (workersError) throw workersError;

    return jsonResponse({
      success: true,
      workers: workers || [],
    });
  } catch (error) {
    console.error("List workers error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list workers"
    );
  }
});
