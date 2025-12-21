import { serve } from "server";
import {
  extractAuthToken,
  getAuthUser,
  verifyOrganizationMembership,
} from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req.json()) as {
      organization_id: string;
      payment_id?: string;
      batch_id?: string;
      status: string;
      payment_method?: string;
      payment_reference?: string;
      notes?: string;
    };

    const validation = validateRequiredFields(
      body as unknown as Record<string, unknown>,
      ["organization_id", "status"],
    );

    if (!validation.valid) {
      return errorResponse("Organization ID and status are required", 400);
    }

    const {
      organization_id,
      payment_id,
      batch_id,
      status,
      payment_method,
      payment_reference,
      notes,
    } = body;

    // Must provide either payment_id or batch_id
    if (!payment_id && !batch_id) {
      return errorResponse("Either payment_id or batch_id is required", 400);
    }

    // Validate status
    const validStatuses = [
      "calculated",
      "approved",
      "processing",
      "paid",
      "failed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return errorResponse(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        400,
      );
    }

    // Get authenticated user for paid_by field and membership verification
    let userId: string | null = null;
    let userEmail: string | null = null;
    const token = extractAuthToken(req);
    if (token) {
      const authUser = await getAuthUser(token);
      if (authUser?.id) {
        userId = authUser.id;
        userEmail = authUser.email ?? null;
      }
    }

    const supabase = createServiceRoleClient();

    // Verify organization exists
    const { data: org, error: orgError } = await supabase
      .from("organization")
      .select("id")
      .eq("id", organization_id)
      .single();

    if (orgError || !org) {
      return errorResponse("Organization not found", 404);
    }

    // Verify user belongs to this organization
    if (userId || userEmail) {
      const isMember = await verifyOrganizationMembership(
        supabase,
        organization_id,
        userEmail,
        userId,
      );
      if (!isMember) {
        return errorResponse(
          "You do not have permission to access this organization",
          403,
        );
      }
    }

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    // If marking as paid, set paid_at and paid_by
    if (status === "paid") {
      updateData.paid_at = new Date().toISOString();
      if (userId) {
        updateData.paid_by = userId;
      }
      // Payment method and reference can be set when marking as paid
      if (payment_method) {
        updateData.payment_method = payment_method;
      }
      if (payment_reference) {
        updateData.payment_reference = payment_reference;
      }
    }

    // If adding notes
    if (notes) {
      updateData.notes = notes;
    }

    if (payment_id) {
      // Update single payment
      const { data: payment, error: paymentError } = await supabase
        .from("worker_payment")
        .update(updateData)
        .eq("id", payment_id)
        .eq("organization_id", organization_id)
        .select()
        .single();

      if (paymentError) throw paymentError;
      if (!payment) {
        return errorResponse("Payment not found", 404);
      }

      // If payment is marked as paid, check if batch should be updated
      if (status === "paid" && payment.batch_id) {
        // Check if all payments in batch are paid
        const { data: batchPayments, error: batchPaymentsError } =
          await supabase
            .from("worker_payment")
            .select("status")
            .eq("batch_id", payment.batch_id);

        if (!batchPaymentsError && batchPayments) {
          const allPaid = batchPayments.every((p: { status: string }) =>
            p.status === "paid"
          );
          if (allPaid) {
            // Update batch status to completed
            await supabase
              .from("worker_payment_batch")
              .update({
                status: "completed",
                updated_at: new Date().toISOString(),
              })
              .eq("id", payment.batch_id);
          }
        }
      }

      return jsonResponse({
        success: true,
        payment,
      });
    } else if (batch_id) {
      // Update all payments in batch
      const { error: updateError } = await supabase
        .from("worker_payment")
        .update(updateData)
        .eq("batch_id", batch_id)
        .eq("organization_id", organization_id);

      if (updateError) throw updateError;

      // Update batch status
      const batchUpdateData: Record<string, unknown> = {
        status: status === "paid"
          ? "completed"
          : status === "approved"
          ? "approved"
          : status,
        updated_at: new Date().toISOString(),
      };

      if (notes) {
        batchUpdateData.notes = notes;
      }

      const { data: batch, error: batchError } = await supabase
        .from("worker_payment_batch")
        .update(batchUpdateData)
        .eq("id", batch_id)
        .eq("organization_id", organization_id)
        .select()
        .single();

      if (batchError) throw batchError;

      return jsonResponse({
        success: true,
        batch,
      });
    }

    return errorResponse("Invalid request", 400);
  } catch (error) {
    console.error("Update worker payment status error:", error);
    return errorResponse(
      error instanceof Error
        ? error.message
        : "Failed to update worker payment status",
    );
  }
});
