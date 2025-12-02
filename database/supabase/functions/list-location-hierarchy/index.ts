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

    const { data: nodes, error: hierarchyError } = await supabase
      .from("location_hierarchy")
      .select(
        `
        *,
        parent:parent_id (
          id,
          name,
          type
        )
      `
      )
      .eq("organization_id", organization_id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (hierarchyError) throw hierarchyError;

    const { data: assignments, error: assignmentError } = await supabase
      .from("location_hierarchy_assignment")
      .select(
        `
        location_id,
        hierarchy_id,
        assigned_at,
        location:location_id (
          id,
          name,
          organization_id,
          address,
          email
        )
      `
      )
      .eq("location.organization_id", organization_id);

    if (assignmentError) throw assignmentError;

    return jsonResponse({
      success: true,
      nodes: nodes || [],
      assignments: assignments || [],
    });
  } catch (error) {
    console.error("List location hierarchy error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list location hierarchy"
    );
  }
});
