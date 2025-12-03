import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      return errorResponse("Node ID is required", 400);
    }

    const { id } = body;

    const supabase = createServiceRoleClient();

    // Check if node has children
    const { data: children, error: childrenError } = await supabase
      .from("location_hierarchy")
      .select("id")
      .eq("parent_id", id)
      .limit(1);

    if (childrenError) throw childrenError;

    if (children && children.length > 0) {
      return errorResponse(
        "Cannot delete node with children. Delete child nodes first.",
        400
      );
    }

    // Check if node has pricing rules
    const { data: pricingRules, error: pricingError } = await supabase
      .from("pricing_rule")
      .select("id")
      .eq("location_hierarchy_id", id)
      .limit(1);

    if (pricingError) throw pricingError;

    if (pricingRules && pricingRules.length > 0) {
      return errorResponse(
        "Cannot delete node with associated pricing rules. Remove pricing rules first.",
        400
      );
    }

    const { error: deleteError } = await supabase
      .from("location_hierarchy")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return jsonResponse({
      success: true,
      message: "Location hierarchy node deleted successfully",
    });
  } catch (error) {
    console.error("Delete location hierarchy error:", error);
    return errorResponse(
      error instanceof Error
        ? error
        : "Failed to delete location hierarchy node"
    );
  }
});
