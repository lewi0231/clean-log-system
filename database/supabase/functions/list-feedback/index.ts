import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const logger = createLogger(req, { functionName: "list-feedback" });
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["organization_id"]);

    if (!validation.valid) {
      return errorResponse("Organization ID is required", 400);
    }

    const { organization_id } = body;

    const supabase = createServiceRoleClient();

    // First, fetch jobs for this organization to get job IDs
    const { data: jobs, error: jobsError } = await supabase
      .from("job")
      .select("id")
      .eq("organization_id", organization_id);

    if (jobsError) throw jobsError;

    const jobIds = jobs?.map((job) => job.id) || [];

    if (jobIds.length === 0) {
      return jsonResponse({
        success: true,
        feedback: [],
      });
    }

    // Fetch feedback with job, location, and worker information
    const { data: feedback, error: feedbackError } = await supabase
      .from("feedback")
      .select(
        `
        id,
        job_id,
        rating,
        ratings,
        comment,
        submitted_at,
        job:job_id (
          id,
          completed_at,
          location:location_id (
            id,
            name,
            email
          )
        )
      `,
      )
      .in("job_id", jobIds)
      .order("submitted_at", { ascending: false });

    if (feedbackError) throw feedbackError;

    // Fetch workers for all jobs
    let workersByJobId = new Map<string, any[]>();
    if (jobIds.length > 0) {
      const { data: jobWorkers, error: jobWorkersError } = await supabase
        .from("job_worker")
        .select(
          `
          job_id,
          worker:worker_id (
            id,
            name
          )
        `,
        )
        .in("job_id", jobIds);

      if (jobWorkersError) throw jobWorkersError;

      // Group workers by job_id
      for (const jw of jobWorkers || []) {
        const jobId = jw.job_id;
        const worker = Array.isArray(jw.worker) ? jw.worker[0] : jw.worker;
        if (!workersByJobId.has(jobId)) {
          workersByJobId.set(jobId, []);
        }
        if (worker) {
          workersByJobId.get(jobId)?.push(worker);
        }
      }
    }

    // Combine feedback with workers
    const feedbackWithWorkers = (feedback || []).map((item) => {
      const job = item.job as any;
      return {
        id: item.id,
        job_id: item.job_id,
        rating: item.rating,
        ratings: item.ratings,
        comment: item.comment,
        submitted_at: item.submitted_at,
        job: {
          id: job.id,
          completed_at: job.completed_at,
          location: job.location,
          workers: workersByJobId.get(job.id) || [],
        },
      };
    });

    return jsonResponse({
      success: true,
      feedback: feedbackWithWorkers,
    });
  } catch (error) {
    logger.error("List feedback error", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list feedback",
    );
  }
});
