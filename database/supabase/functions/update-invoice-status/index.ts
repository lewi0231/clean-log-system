import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["invoice_id", "status"]);

    if (!validation.valid) {
      return errorResponse("Invoice ID and status are required", 400);
    }

    const { invoice_id, status } = body;

    // Validate status
    const validStatuses = ["draft", "sent", "paid", "overdue", "cancelled"];
    if (!validStatuses.includes(status)) {
      return errorResponse(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        400,
      );
    }

    const supabase = createServiceRoleClient();

    // Update invoice status
    const { data: invoice, error: updateError } = await supabase
      .from("invoice")
      .update({
        status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice_id)
      .select()
      .single();

    if (updateError) throw updateError;

    if (!invoice) {
      return errorResponse("Invoice not found", 404);
    }

    return jsonResponse({
      success: true,
      invoice: invoice,
    });
  } catch (error) {
    console.error("Update invoice status error:", error);
    return errorResponse(
      error instanceof Error
        ? error.message
        : "Failed to update invoice status",
      500,
    );
  }
});
