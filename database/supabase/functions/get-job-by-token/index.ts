import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Allow GET requests with token in query params or POST with body
    let token: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      token = url.searchParams.get("token");
    } else {
      const body = await req.json();
      const validation = validateRequiredFields(body, ["token"]);

      if (!validation.valid) {
        return errorResponse("Token is required", 400);
      }

      token = body.token;
    }

    if (!token || typeof token !== "string") {
      return errorResponse("Token is required", 400);
    }

    const supabase = createServiceRoleClient();

    // Fetch job by token with location and workers
    const { data: job, error: jobError } = await supabase
      .from("job")
      .select(
        `
        id,
        completed_at,
        location:location_id (
          id,
          name,
          email
        ),
        job_worker:job_worker (
          worker:worker_id (
            id,
            name
          )
        )
      `,
      )
      .eq("feedback_token", token)
      .single();

    if (jobError || !job) {
      console.error("Get job by token error:", jobError);
      return errorResponse("Invalid or expired feedback link", 404);
    }

    // Check if feedback already exists for this job
    const { data: existingFeedback } = await supabase
      .from("feedback")
      .select("id")
      .eq("job_id", job.id)
      .maybeSingle();

    // Format workers array
    const workers = (job.job_worker || [])
      .map((jw: { worker: unknown }) => {
        const worker = Array.isArray(jw.worker) ? jw.worker[0] : jw.worker;
        return worker;
      })
      .filter((w: unknown) => w !== null && w !== undefined);

    // Format location
    const location = Array.isArray(job.location)
      ? job.location[0]
      : job.location;

    return jsonResponse({
      success: true,
      job: {
        id: job.id,
        completed_at: job.completed_at,
        location: location || null,
        workers: workers || [],
        hasFeedback: !!existingFeedback,
      },
    });
  } catch (error) {
    console.error("Get job by token error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to get job details",
    );
  }
});
