import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { listJobsSchema, validateRequest } from "../_utils/zod-schemas.ts";
import type { JobWorker, JobWorkerQueryResult, Worker } from "../types.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const rawBody = await req.json();
    const validation = validateRequest(listJobsSchema, rawBody);
    if (!validation.success) {
      return errorResponse(validation.error, 400);
    }

    const { organization_id, include_tests } = validation.data as {
      organization_id: string;
      include_tests?: boolean;
    };

    const supabase = createServiceRoleClient();

    // Fetch jobs with location info and invoice data
    let query = supabase
      .from("job")
      .select(
        `
        id,
        organization_id,
        location_id,
        is_test,
        submission_data,
        completed_at,
        created_at,
        feedback_token,
        feedback_email_sent,
        feedback_email_sent_at,
        submitted_by_email,
        last_updated_at,
        last_updated_by,
        location:location_id (
          id,
          name,
          email,
          address,
          contact_person,
          phone
        ),
        invoice_job:invoice_job (
          invoice:invoice_id (
            id,
            invoice_number,
            status,
            paid_at
          )
        )
      `,
      )
      .eq("organization_id", organization_id);

    // Exclude test jobs by default
    if (!include_tests) {
      query = query.eq("is_test", false);
    }

    const { data: jobs, error: jobsError } = await query.order("completed_at", {
      ascending: false,
    });

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
        `,
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

    // Fetch feedback for all jobs to check if feedback has been received
    const { data: feedbackData, error: feedbackError } = await supabase
      .from("feedback")
      .select("job_id")
      .in("job_id", jobIds);

    if (feedbackError) {
      console.error("Error fetching feedback:", feedbackError);
      // Don't fail the entire request if feedback fetch fails
    }

    const jobsWithFeedback = new Set(
      feedbackData?.map((f) => f.job_id) || [],
    );

    // Combine jobs with their workers and feedback status
    const jobsWithWorkers = jobs?.map((job) => ({
      ...job,
      workers: workersByJobId.get(job.id) || [],
      has_feedback: jobsWithFeedback.has(job.id),
    }));

    return jsonResponse({
      success: true,
      jobs: jobsWithWorkers || [],
    });
  } catch (error) {
    console.error("List jobs error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list jobs",
    );
  }
});
