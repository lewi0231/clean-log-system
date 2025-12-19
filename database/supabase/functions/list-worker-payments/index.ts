import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req.json()) as { organization_id: string };
    const validation = validateRequiredFields(
      body as unknown as Record<string, unknown>,
      ["organization_id"],
    );

    if (!validation.valid) {
      return errorResponse("Organization ID is required", 400);
    }

    const { organization_id } = body;

    const supabase = createServiceRoleClient();

    // Fetch payment batches with related payments
    const { data: batches, error: batchesError } = await supabase
      .from("worker_payment_batch")
      .select(
        `
        id,
        organization_id,
        calculated_at,
        calculated_by,
        total_payment,
        currency,
        job_count,
        worker_count,
        status,
        notes,
        calculation_data,
        created_at,
        updated_at,
        worker_payments:worker_payment (
          id,
          job_id,
          worker_id,
          amount,
          currency,
          status,
          payment_method,
          payment_reference,
          paid_at,
          paid_by,
          calculation_details,
          notes,
          created_at,
          updated_at
        )
      `,
      )
      .eq("organization_id", organization_id)
      .order("calculated_at", { ascending: false });

    if (batchesError) throw batchesError;

    // Format response to match PaymentRecord interface structure
    interface BatchWithPayments {
      id: string;
      calculated_at: string;
      total_payment: number | string;
      worker_count: number;
      status: string;
      currency: string;
      calculation_data?: {
        total_worker_payment: number;
        job_calculations: unknown[];
      };
      worker_payments?: Array<{
        id: string;
        job_id: string;
        worker_id: string;
        amount: number | string;
        currency: string;
        status: string;
        payment_method: string | null;
        payment_reference: string | null;
        paid_at: string | null;
        calculation_details: unknown;
        notes: string | null;
        created_at: string;
      }>;
    }

    const formattedBatches = (batches || []).map((batch: BatchWithPayments) => {
      const payments = batch.worker_payments || [];
      const jobIds = [
        ...new Set(payments.map((p) => p.job_id).filter(Boolean)),
      ];

      // Get date range from jobs (would need to fetch jobs, but for now use calculated_at)
      // In a full implementation, you'd fetch jobs to get actual date range
      const dateRange = {
        start: batch.calculated_at,
        end: batch.calculated_at,
      };

      return {
        id: batch.id,
        batch_id: batch.id,
        dateRange,
        jobIds,
        totalPayment: Number(batch.total_payment),
        workerCount: batch.worker_count,
        calculation: {
          success: true,
          calculation: batch.calculation_data || {
            total_worker_payment: Number(batch.total_payment),
            job_calculations: [],
          },
        },
        calculatedAt: batch.calculated_at,
        status: batch.status,
        currency: batch.currency,
        payments: payments.map((p) => ({
          id: p.id,
          job_id: p.job_id,
          worker_id: p.worker_id,
          amount: Number(p.amount),
          currency: p.currency,
          status: p.status,
          payment_method: p.payment_method,
          payment_reference: p.payment_reference,
          paid_at: p.paid_at,
          calculation_details: p.calculation_details,
          notes: p.notes,
          created_at: p.created_at,
        })),
      };
    });

    return jsonResponse({
      success: true,
      batches: formattedBatches,
    });
  } catch (error) {
    console.error("List worker payments error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to list worker payments",
    );
  }
});
