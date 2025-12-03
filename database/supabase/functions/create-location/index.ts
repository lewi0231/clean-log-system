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
      "name",
      "email",
      "address",
      "contact_person",
      "organization_id",
    ]);

    if (!validation.valid) {
      return errorResponse("Missing required fields", 400);
    }

    const {
      name,
      email,
      address,
      contact_person,
      phone,
      organization_id,
      hierarchy_parent_id,
    } = body;

    const supabase = createServiceRoleClient();

    // Validate hierarchy_parent_id if provided
    if (hierarchy_parent_id) {
      const { data: parentNode, error: parentError } = await supabase
        .from("location_hierarchy")
        .select("id, organization_id")
        .eq("id", hierarchy_parent_id)
        .single();

      if (parentError || !parentNode) {
        return errorResponse("Invalid hierarchy parent", 400);
      }

      if (parentNode.organization_id !== organization_id) {
        return errorResponse(
          "Hierarchy parent belongs to a different organization",
          400,
        );
      }
    }

    // Create location
    const { data: location, error: locationError } = await supabase
      .from("location")
      .insert({
        organization_id,
        name,
        email,
        address,
        contact_person,
        phone: phone || null,
        hierarchy_parent_id: hierarchy_parent_id || null,
        active: true,
      })
      .select(`
        *,
        hierarchy_parent:hierarchy_parent_id (
          id,
          name,
          type
        )
      `)
      .single();

    if (locationError) throw locationError;

    return jsonResponse({
      success: true,
      location,
    });
  } catch (error) {
    console.error("Create location error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to create location",
    );
  }
});
