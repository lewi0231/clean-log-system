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

    const { id, name, email, address, contact_person, phone } = body;

    const supabase = createServiceRoleClient();

    const { data: location, error: locationError } = await supabase
      .from("location")
      .update({
        name,
        email,
        address,
        contact_person,
        phone: phone || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (locationError) throw locationError;

    return jsonResponse({ success: true, location });
  } catch (error) {
    console.error("Update location error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to update location"
    );
  }
});
