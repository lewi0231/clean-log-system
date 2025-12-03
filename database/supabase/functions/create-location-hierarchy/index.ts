import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_id",
      "name",
      "type",
    ]);

    if (!validation.valid) {
      return errorResponse(
        `Missing required fields: ${validation.missingFields?.join(", ")}`,
        400,
      );
    }

    const { organization_id, name, type, parent_id, metadata } = body;

    // Validate type (only company and region allowed - sites are now locations)
    const validTypes = ["company", "region"];
    if (!validTypes.includes(type)) {
      return errorResponse(
        `Invalid type. Must be one of: ${validTypes.join(", ")}`,
        400,
      );
    }

    const supabase = createServiceRoleClient();

    // If parent_id is provided, verify it exists and belongs to the same organization
    if (parent_id) {
      const { data: parentNode, error: parentError } = await supabase
        .from("location_hierarchy")
        .select("id, organization_id, type")
        .eq("id", parent_id)
        .single();

      if (parentError || !parentNode) {
        return errorResponse("Parent node not found", 404);
      }

      if (parentNode.organization_id !== organization_id) {
        return errorResponse(
          "Parent node belongs to a different organization",
          400,
        );
      }

      // Validate hierarchy: only company -> region is allowed
      // Regions must have a company parent
      if (type === "region" && parentNode.type !== "company") {
        return errorResponse(
          "Regions can only be children of companies",
          400,
        );
      }

      // Companies cannot have parents
      if (type === "company" && parent_id) {
        return errorResponse(
          "Companies cannot have parent nodes",
          400,
        );
      }
    }

    const { data: node, error: insertError } = await supabase
      .from("location_hierarchy")
      .insert({
        organization_id,
        name,
        type,
        parent_id: parent_id || null,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return jsonResponse({
      success: true,
      node,
    });
  } catch (error) {
    console.error("Create location hierarchy error:", error);
    return errorResponse(
      error instanceof Error
        ? error
        : "Failed to create location hierarchy node",
    );
  }
});
