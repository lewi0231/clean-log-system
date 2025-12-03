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
      `,
      )
      .eq("organization_id", organization_id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (hierarchyError) throw hierarchyError;

    // Get locations with their hierarchy parent for reference
    const { data: locations, error: locationsError } = await supabase
      .from("location")
      .select(
        `
        id,
        name,
        organization_id,
        address,
        email,
        hierarchy_parent_id
      `,
      )
      .eq("organization_id", organization_id)
      .not("hierarchy_parent_id", "is", null);

    if (locationsError) throw locationsError;

    return jsonResponse({
      success: true,
      nodes: nodes || [],
      // For backwards compatibility, return locations grouped by their hierarchy parent
      locations_by_hierarchy: locations || [],
    });
  } catch (error) {
    console.error("List location hierarchy error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list location hierarchy",
    );
  }
});
