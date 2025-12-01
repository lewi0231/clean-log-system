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
      return errorResponse("Worker ID is required", 400);
    }

    const { id, name, email, phone, active } = body;

    // Build update object with only provided fields
    const updateData: {
      name?: string;
      email?: string;
      phone?: string;
      active?: boolean;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (active !== undefined) updateData.active = active;

    if (Object.keys(updateData).length === 0) {
      return errorResponse("At least one field must be provided", 400);
    }

    const supabase = createServiceRoleClient();

    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (workerError) throw workerError;

    return jsonResponse({ success: true, worker });
  } catch (error) {
    console.error("Update worker error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to update worker"
    );
  }
});
