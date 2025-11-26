import { createClient } from "@supabase/supabase-js";
import { serve } from "server";
import type { JobWorker, JobWorkerQueryResult, Worker } from "../types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
} as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { organization_id } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "Organization ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    return new Response(
      JSON.stringify({
        success: true,
        jobs: jobsWithWorkers || [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("List jobs error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to list jobs";
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
