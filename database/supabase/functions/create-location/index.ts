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

    const { name, email, address, contact_person, phone, organization_id } =
      body;

    const supabase = createServiceRoleClient();

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
        active: true,
      })
      .select()
      .single();

    if (locationError) throw locationError;

    return jsonResponse({
      success: true,
      location,
    });
  } catch (error) {
    console.error("Create location error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to create location"
    );
  }
});
