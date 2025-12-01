import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";
import type { JobWorker, JobWorkerQueryResult, Worker } from "../types.ts";

serve(async (req) => {
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

    // Fetch jobs with location info
    const { data: jobs, error: jobsError } = await supabase
      .from("job")
      .select(
        `
        id,
        organization_id,
        location_id,
        submission_data,
        completed_at,
        created_at,
        location:location_id (
          id,
          name,
          email,
          address,
          contact_person,
          phone
        )
      `
      )
      .eq("organization_id", organization_id)
      .order("completed_at", { ascending: false });

    if (jobsError) throw jobsError;

    // Fetch all job_worker relationships for these jobs
    const jobIds = jobs?.map((job) => job.id) || [];
    let jobWorkers: JobWorker[] = [];

    if (jobIds.length > 0) {
      const { data, error: jobWorkersError } = await supabase
        .from("job_worker")
        .select(
          `
          job_id,
          worker:worker_id (
            id,
            name,
            email,
            phone
          )
        `
        )
        .in("job_id", jobIds);

      if (jobWorkersError) throw jobWorkersError;

      // Type assertion: Supabase may infer worker as array, but it's actually a single object
      // Each job_worker row has exactly one worker_id, so worker should be a single object
      jobWorkers = ((data || []) as JobWorkerQueryResult[]).map((item) => ({
        job_id: item.job_id,
        worker: Array.isArray(item.worker)
          ? (item.worker[0] as Worker | null)
          : (item.worker as Worker | null),
      }));
    }

    // Group workers by job_id
    const workersByJobId = new Map<string, Worker[]>();
    jobWorkers.forEach((jw) => {
      if (!workersByJobId.has(jw.job_id)) {
        workersByJobId.set(jw.job_id, []);
      }
      if (jw.worker) {
        workersByJobId.get(jw.job_id)?.push(jw.worker);
      }
    });

    // Combine jobs with their workers
    const jobsWithWorkers = jobs?.map((job) => ({
      ...job,
      workers: workersByJobId.get(job.id) || [],
    }));

    return jsonResponse({
      success: true,
      jobs: jobsWithWorkers || [],
    });
  } catch (error) {
    console.error("List jobs error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list jobs"
    );
  }
});
