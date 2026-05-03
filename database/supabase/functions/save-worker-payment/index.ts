import { serve } from "server";
import { extractAuthToken, getAuthUser, verifyOrganizationMembership } from "../_utils/auth.ts";
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

interface WorkerSplit {
  worker_id: string;
  worker_name: string;
  hours_worked: number;
  time_share: number;
  multiplier_adjustment: number;
  per_unit_bonus: number;
  flat_bonus: number;
  team_percentage_bonus?: number;
  final_payment: number;
  rate_card_id?: string;
  allocation_type: string;
  split_weight?: number;
}

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
      worker_splits?: WorkerSplit[];
    }>;
  };
  job_ids: string[];
  /** When true and open batches exist for these jobs, remove old calculated rows before save (after inserting new batch). */
  replace_existing?: boolean;
}

const OPEN_BATCH_STATUSES = new Set(["calculated", "approved", "processing"]);

interface WpEmbedRow {
  job_id: string;
  batch_id: string | null;
  worker_payment_batch: { status?: string | null; calculated_at?: string | null } | null;
}

function batchStatusFromEmbed(embed: WpEmbedRow["worker_payment_batch"]): string | undefined {
  if (!embed || Array.isArray(embed)) return undefined;
  return embed.status ?? undefined;
}

function batchCalculatedAtFromEmbed(embed: WpEmbedRow["worker_payment_batch"]): string {
  if (!embed || Array.isArray(embed)) return "";
  return embed.calculated_at ?? "";
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "save-worker-payment" });

  try {
    const body = (await req.json()) as SaveWorkerPaymentRequest;
    const validation = validateRequiredFields(body as unknown as Record<string, unknown>, [
      "organization_id",
      "calculation",
      "job_ids",
    ]);

    if (!validation.valid) {
      logger.warn("Missing required fields for worker payment save", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Missing required fields", 400);
    }

    const { organization_id, calculation, job_ids } = body;
    const replace_existing = Boolean(body.replace_existing);

    if (!Array.isArray(job_ids) || job_ids.length === 0) {
      return errorResponse("job_ids must be a non-empty array", 400);
    }

    if (!calculation.job_calculations || calculation.job_calculations.length === 0) {
      return errorResponse("calculation.job_calculations is required", 400);
    }

    let authUserId: string | null = null;
    let userEmail: string | null = null;
    const token = extractAuthToken(req);
    if (token) {
      const authUser = await getAuthUser(token);
      if (authUser?.id) {
        authUserId = authUser.id;
        userEmail = authUser.email ?? null;
      }
    }

    const supabase = createServiceRoleClient();

    const { data: org, error: orgError } = await supabase
      .from("organization")
      .select("id")
      .eq("id", organization_id)
      .single();

    if (orgError || !org) {
      return errorResponse("Organization not found", 404);
    }

    let organizationUserId: string | null = null;
    if (authUserId || userEmail) {
      const isMember = await verifyOrganizationMembership(
        supabase,
        organization_id,
        userEmail,
        authUserId
      );
      if (!isMember) {
        return errorResponse("You do not have permission to access this organization", 403);
      }

      const { data: orgUser } = await supabase
        .from("organization_user")
        .select("id")
        .eq("organization_id", organization_id)
        .eq("email", userEmail)
        .maybeSingle();

      if (orgUser?.id) {
        organizationUserId = orgUser.id;
      }
    }

    const { data: jobs, error: jobsError } = await supabase
      .from("job")
      .select("id")
      .eq("organization_id", organization_id)
      .in("id", job_ids);

    if (jobsError) throw jobsError;
    if (!jobs || jobs.length === 0) {
      return errorResponse("No jobs found", 404);
    }

    const { data: jobWorkersData, error: jobWorkersError } = await supabase
      .from("job_worker")
      .select(
        `
        job_id,
        worker:worker_id (
          id
        )
      `
      )
      .in("job_id", job_ids);

    if (jobWorkersError) throw jobWorkersError;

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

    const uniqueWorkers = new Set<string>();
    jobWorkersMap.forEach((workerIds) => {
      workerIds.forEach((id) => uniqueWorkers.add(id));
    });

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

    // ── Duplicate / paid detection ─────────────────────────────────────
    const { data: existingRows, error: existingErr } = await supabase
      .from("worker_payment")
      .select(
        `
        job_id,
        batch_id,
        worker_payment_batch(status, calculated_at)
      `
      )
      .eq("organization_id", organization_id)
      .in("job_id", job_ids);

    if (existingErr) throw existingErr;

    const wpRows = (existingRows ?? []) as WpEmbedRow[];

    const blockedMap = new Map<
      string,
      { batch_id: string; batch_status: string; calculated_at: string }
    >();
    for (const row of wpRows) {
      if (!row.batch_id) continue;
      const stat = batchStatusFromEmbed(row.worker_payment_batch);
      if (stat === "completed") {
        blockedMap.set(row.job_id, {
          batch_id: row.batch_id,
          batch_status: "completed",
          calculated_at: batchCalculatedAtFromEmbed(row.worker_payment_batch),
        });
      }
    }

    if (blockedMap.size > 0) {
      const blocked_jobs = [...blockedMap.entries()].map(([job_id, meta]) => ({
        job_id,
        ...meta,
      }));
      return jsonResponse({
        success: false,
        error_code: "jobs_already_paid",
        blocked_jobs,
      });
    }

    const dupKeySeen = new Set<string>();
    const duplicatePayload: Array<{
      job_id: string;
      batch_id: string;
      batch_status: string;
      calculated_at: string;
    }> = [];

    for (const row of wpRows) {
      if (!row.batch_id) continue;
      const stat = batchStatusFromEmbed(row.worker_payment_batch);
      if (!(stat && OPEN_BATCH_STATUSES.has(stat))) continue;
      const dk = `${row.job_id}:${row.batch_id}`;
      if (dupKeySeen.has(dk)) continue;
      dupKeySeen.add(dk);
      const bs = batchStatusFromEmbed(row.worker_payment_batch) ?? "";
      duplicatePayload.push({
        job_id: row.job_id,
        batch_id: row.batch_id,
        batch_status: bs,
        calculated_at: batchCalculatedAtFromEmbed(row.worker_payment_batch),
      });
    }

    if (duplicatePayload.length > 0 && !replace_existing) {
      return jsonResponse({
        success: false,
        error_code: "duplicate_payments_needs_confirm",
        duplicates: duplicatePayload,
      });
    }

    const { data: batch, error: batchError } = await supabase
      .from("worker_payment_batch")
      .insert({
        organization_id,
        calculated_by: organizationUserId,
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

    const workerPayments = [];
    for (const jobCalc of calculation.job_calculations) {
      if (jobCalc.worker_splits && jobCalc.worker_splits.length > 0) {
        for (const split of jobCalc.worker_splits) {
          workerPayments.push({
            organization_id,
            batch_id: batch.id,
            job_id: jobCalc.job_id,
            worker_id: split.worker_id,
            amount: split.final_payment,
            currency,
            status: "calculated",
            calculation_details: {
              job_total: jobCalc.total_worker_payment,
              line_items: jobCalc.line_items,
              applied_rules: jobCalc.applied_rules,
              subtotal: jobCalc.subtotal,
              total_adjustments: jobCalc.total_adjustments,
              worker_split: {
                hours_worked: split.hours_worked,
                time_share: split.time_share,
                multiplier_adjustment: split.multiplier_adjustment,
                per_unit_bonus: split.per_unit_bonus,
                flat_bonus: split.flat_bonus,
                team_percentage_bonus: split.team_percentage_bonus,
                allocation_type: split.allocation_type,
                rate_card_id: split.rate_card_id,
                split_weight: split.split_weight ?? 1.0,
              },
            },
          });
        }
      } else {
        const workerIds = jobWorkersMap.get(jobCalc.job_id) || [];
        if (workerIds.length === 0) {
          continue;
        }
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
    }

    let replaced: { jobs_replaced: number; batches_cancelled: number } | undefined;

    if (workerPayments.length > 0) {
      const { error: paymentsError } = await supabase.from("worker_payment").insert(workerPayments);

      if (paymentsError) {
        logger.error("Failed to insert worker payments, rolling back batch", paymentsError, {
          batch_id: batch.id,
          payment_count: workerPayments.length,
        });
        await supabase.from("worker_payment_batch").delete().eq("id", batch.id);
        throw paymentsError;
      }
    }

    if (replace_existing) {
      const { data: cleanup, error: cleanupErr } = await supabase.rpc(
        "worker_payment_remove_open_rows_for_jobs",
        {
          p_organization_id: organization_id,
          p_job_ids: job_ids,
          p_exclude_batch_id: batch.id,
        }
      );

      if (cleanupErr) {
        logger.error("Cleanup after replace failed", cleanupErr, {
          batch_id: batch.id,
        });
        throw cleanupErr;
      }

      const c = cleanup as { deleted_row_count?: number; batches_cancelled?: number } | null;
      replaced = {
        jobs_replaced: new Set(duplicatePayload.map((d) => d.job_id)).size,
        batches_cancelled: c?.batches_cancelled ?? 0,
      };
    }

    logger.info("Worker payment saved successfully", {
      batch_id: batch.id,
      organization_id,
      payment_count: workerPayments.length,
      job_count: job_ids.length,
      worker_count: uniqueWorkers.size,
      total_payment: calculation.total_worker_payment,
      currency,
      replace_existing,
    });

    return jsonResponse({
      success: true,
      batch_id: batch.id,
      payment_count: workerPayments.length,
      replaced,
    });
  } catch (error) {
    logger.error("Save worker payment error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to save worker payment"),
      getErrorStatusCode(error)
    );
  }
});
