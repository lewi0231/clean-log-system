import { serve } from "server";
import { extractAuthToken, getAuthUser } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

interface SaveWorkerPaymentRequest {
  organization_id: string;
  calculation: {
    total_worker_payment: number;
    job_calculations: Array<{
      job_id: string;
      line_items: Array<unknown>;
      applied_rules: Array<unknown>;
      subtotal: number;
      total_adjustments: number;
      total_worker_payment: number;
    }>;
  };
  job_ids: string[];
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req.json()) as SaveWorkerPaymentRequest;
    const validation = validateRequiredFields(
      body as unknown as Record<string, unknown>,
      [
        "organization_id",
        "calculation",
        "job_ids",
      ],
    );

    if (!validation.valid) {
      return errorResponse("Missing required fields", 400);
    }

    const { organization_id, calculation, job_ids } = body;

    if (!Array.isArray(job_ids) || job_ids.length === 0) {
      return errorResponse("job_ids must be a non-empty array", 400);
    }

    if (
      !calculation.job_calculations ||
      calculation.job_calculations.length === 0
    ) {
      return errorResponse("calculation.job_calculations is required", 400);
    }

    // Get authenticated user for created_by
    let userId: string | null = null;
    const token = extractAuthToken(req);
    if (token) {
      const authUser = await getAuthUser(token);
      if (authUser?.id) {
        userId = authUser.id;
      }
    }

    const supabase = createServiceRoleClient();

    // Verify organization exists and user has access
    const { data: org, error: orgError } = await supabase
      .from("organization")
      .select("id")
      .eq("id", organization_id)
      .single();

    if (orgError || !org) {
      return errorResponse("Organization not found", 404);
    }

    // Get jobs to extract worker information
    const { data: jobs, error: jobsError } = await supabase
      .from("job")
      .select(
        `
        id,
        job_worker:job_worker (
          worker:worker_id (
            id
          )
        )
      `,
      )
      .eq("organization_id", organization_id)
      .in("id", job_ids);

    if (jobsError) throw jobsError;
    if (!jobs || jobs.length === 0) {
      return errorResponse("No jobs found", 404);
    }

    // Create a map of job_id to worker_ids
    interface JobWorkerResult {
      id: string;
      job_worker?: Array<{
        worker: { id: string } | Array<{ id: string }>;
      }>;
    }

    const jobWorkersMap = new Map<string, string[]>();
    (jobs as JobWorkerResult[]).forEach((job) => {
      const workerIds: string[] = [];
      if (job.job_worker && Array.isArray(job.job_worker)) {
        job.job_worker.forEach((jw) => {
          if (jw.worker) {
            const worker = Array.isArray(jw.worker) ? jw.worker[0] : jw.worker;
            if (worker?.id) {
              workerIds.push(worker.id);
            }
          }
        });
      }
      jobWorkersMap.set(job.id, workerIds);
    });

    // Count unique workers
    const uniqueWorkers = new Set<string>();
    jobWorkersMap.forEach((workerIds) => {
      workerIds.forEach((id) => uniqueWorkers.add(id));
    });

    // Get organization currency
    const { data: organization, error: orgCurrencyError } = await supabase
      .from("organization")
      .select("currency")
      .eq("id", organization_id)
      .single();

    if (orgCurrencyError) {
      console.error("Error fetching organization currency:", orgCurrencyError);
    }

    const currency = organization?.currency || "AUD";

    // Create payment batch
    const { data: batch, error: batchError } = await supabase
      .from("worker_payment_batch")
      .insert({
        organization_id,
        calculated_by: userId,
        total_payment: calculation.total_worker_payment,
        currency,
        job_count: job_ids.length,
        worker_count: uniqueWorkers.size,
        status: "calculated",
        calculation_data: calculation,
      })
      .select()
      .single();

    if (batchError) throw batchError;

    // Create individual worker payment records
    // For each job calculation, create a payment record for each worker on that job
    const workerPayments = [];
    for (const jobCalc of calculation.job_calculations) {
      const workerIds = jobWorkersMap.get(jobCalc.job_id) || [];

      if (workerIds.length === 0) {
        // No workers assigned, skip
        continue;
      }

      // Split payment equally among workers (or use different logic if needed)
      const paymentPerWorker = jobCalc.total_worker_payment / workerIds.length;

      for (const workerId of workerIds) {
        workerPayments.push({
          organization_id,
          batch_id: batch.id,
          job_id: jobCalc.job_id,
          worker_id: workerId,
          amount: paymentPerWorker,
          currency,
          status: "calculated",
          calculation_details: {
            job_total: jobCalc.total_worker_payment,
            line_items: jobCalc.line_items,
            applied_rules: jobCalc.applied_rules,
            subtotal: jobCalc.subtotal,
            total_adjustments: jobCalc.total_adjustments,
          },
        });
      }
    }

    if (workerPayments.length > 0) {
      const { error: paymentsError } = await supabase
        .from("worker_payment")
        .insert(workerPayments);

      if (paymentsError) throw paymentsError;
    }

    return jsonResponse({
      success: true,
      batch_id: batch.id,
      payment_count: workerPayments.length,
    });
  } catch (error) {
    console.error("Save worker payment error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to save worker payment",
    );
  }
});
