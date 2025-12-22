import { serve } from "server";
import {
  extractAuthToken,
  getAuthUser,
  verifyOrganizationMembership,
} from "../_utils/auth.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
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

  const logger = createLogger(req, { functionName: "save-worker-payment" });

  try {
    const body = (await req.json()) as SaveWorkerPaymentRequest;
    const validation = validateRequiredFields(
      body as unknown as Record<string, unknown>,
      ["organization_id", "calculation", "job_ids"],
    );

    if (!validation.valid) {
      logger.warn("Missing required fields for worker payment save", {
        missingFields: validation.missingFields,
      });
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

    // Get authenticated user for created_by and membership verification
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

    // Verify jobs exist
    const { data: jobs, error: jobsError } = await supabase
      .from("job")
      .select("id")
      .eq("organization_id", organization_id)
      .in("id", job_ids);

    if (jobsError) throw jobsError;
    if (!jobs || jobs.length === 0) {
      return errorResponse("No jobs found", 404);
    }

    // Fetch job_worker relationships separately (same pattern as list-jobs)
    const { data: jobWorkersData, error: jobWorkersError } = await supabase
      .from("job_worker")
      .select(
        `
        job_id,
        worker:worker_id (
          id
        )
      `,
      )
      .in("job_id", job_ids);

    if (jobWorkersError) throw jobWorkersError;

    // Create a map of job_id to worker_ids
    interface JobWorkerQueryResult {
      job_id: string;
      worker: { id: string } | Array<{ id: string }> | null;
    }

    const jobWorkersMap = new Map<string, string[]>();
    (jobWorkersData || []).forEach((jw: JobWorkerQueryResult) => {
      if (!jobWorkersMap.has(jw.job_id)) {
        jobWorkersMap.set(jw.job_id, []);
      }
      if (jw.worker) {
        const worker = Array.isArray(jw.worker) ? jw.worker[0] : jw.worker;
        if (worker?.id) {
          jobWorkersMap.get(jw.job_id)?.push(worker.id);
        }
      }
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
      logger.warn("Error fetching organization currency", {
        error: orgCurrencyError,
        organization_id,
      });
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
    //
    // NOTE: Payment Split Assumption
    // When multiple workers are assigned to a job, the total worker payment is
    // split EQUALLY among all workers on that job.
    //
    // Example: Job pays $100 to workers, 2 workers assigned = $50 each
    //
    // This may not be appropriate for all business scenarios (e.g., different
    // worker rates, different hours worked, different roles). Future enhancement
    // could support configurable split strategies:
    // - Equal split (current)
    // - Per-worker rates from pricing rules
    // - Custom split percentages per job
    // - Hours-based proportional split
    //
    const workerPayments = [];
    for (const jobCalc of calculation.job_calculations) {
      const workerIds = jobWorkersMap.get(jobCalc.job_id) || [];

      if (workerIds.length === 0) {
        // No workers assigned, skip
        continue;
      }

      // Split payment equally among workers
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
            split_among_workers: workerIds.length,
          },
        });
      }
    }

    if (workerPayments.length > 0) {
      const { error: paymentsError } = await supabase
        .from("worker_payment")
        .insert(workerPayments);

      if (paymentsError) {
        // Rollback: Delete the batch if payment inserts fail
        // This prevents orphaned batch records without associated payments
        logger.error(
          "Failed to insert worker payments, rolling back batch",
          paymentsError,
          {
            batch_id: batch.id,
            payment_count: workerPayments.length,
          },
        );
        await supabase
          .from("worker_payment_batch")
          .delete()
          .eq("id", batch.id);
        throw paymentsError;
      }
    }

    logger.info("Worker payment saved successfully", {
      batch_id: batch.id,
      organization_id,
      payment_count: workerPayments.length,
      job_count: job_ids.length,
      worker_count: uniqueWorkers.size,
      total_payment: calculation.total_worker_payment,
      currency,
    });

    return jsonResponse({
      success: true,
      batch_id: batch.id,
      payment_count: workerPayments.length,
    });
  } catch (error) {
    logger.error("Save worker payment error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to save worker payment"),
      getErrorStatusCode(error),
    );
  }
});
