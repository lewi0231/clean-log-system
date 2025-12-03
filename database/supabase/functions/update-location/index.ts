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
      "id",
      "name",
      "email",
      "address",
      "contact_person",
    ]);

    if (!validation.valid) {
      return errorResponse("Missing required fields", 400);
    }

    const {
      id,
      name,
      email,
      address,
      contact_person,
      phone,
      hierarchy_parent_id,
    } = body;

    const supabase = createServiceRoleClient();

    // Validate hierarchy_parent_id if provided
    if (hierarchy_parent_id) {
      // First get the location to check organization_id
      const { data: existingLocation, error: existingError } = await supabase
        .from("location")
        .select("organization_id")
        .eq("id", id)
        .single();

      if (existingError || !existingLocation) {
        return errorResponse("Location not found", 404);
      }

      const { data: parentNode, error: parentError } = await supabase
        .from("location_hierarchy")
        .select("id, organization_id")
        .eq("id", hierarchy_parent_id)
        .single();

      if (parentError || !parentNode) {
        return errorResponse("Invalid hierarchy parent", 400);
      }

      if (parentNode.organization_id !== existingLocation.organization_id) {
        return errorResponse(
          "Hierarchy parent belongs to a different organization",
          400,
        );
      }
    }

    const { data: location, error: locationError } = await supabase
      .from("location")
      .update({
        name,
        email,
        address,
        contact_person,
        phone: phone || null,
        hierarchy_parent_id: hierarchy_parent_id ?? null,
      })
      .eq("id", id)
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

    return jsonResponse({ success: true, location });
  } catch (error) {
    console.error("Update location error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to update location",
    );
  }
});
