import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["token", "rating"]);

    if (!validation.valid) {
      return errorResponse(
        validation.missingFields
          ? `Missing required fields: ${validation.missingFields.join(", ")}`
          : "Token and rating are required",
        400,
      );
    }

    const { token, rating, comment } = body;

    // Validate rating
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return errorResponse("Rating must be a number between 1 and 5", 400);
    }

    // Validate comment if provided
    if (comment !== undefined && comment !== null) {
      if (typeof comment !== "string") {
        return errorResponse("Comment must be a string", 400);
      }
      if (comment.length > 5000) {
        return errorResponse("Comment must be less than 5000 characters", 400);
      }
    }

    const supabase = createServiceRoleClient();

    // Find job by token
    const { data: job, error: jobError } = await supabase
      .from("job")
      .select("id")
      .eq("feedback_token", token)
      .single();

    if (jobError || !job) {
      console.error("Submit feedback: Job not found", jobError);
      return errorResponse("Invalid or expired feedback link", 404);
    }

    // Check if feedback already exists
    const { data: existingFeedback, error: checkError } = await supabase
      .from("feedback")
      .select("id")
      .eq("job_id", job.id)
      .maybeSingle();

    if (checkError) {
      console.error(
        "Submit feedback: Error checking existing feedback",
        checkError,
      );
      return errorResponse("Failed to check existing feedback", 500);
    }

    if (existingFeedback) {
      return errorResponse(
        "Feedback has already been submitted for this job",
        409,
      );
    }

    // Insert feedback (RLS policy will validate token exists)
    const { data: feedback, error: insertError } = await supabase
      .from("feedback")
      .insert({
        job_id: job.id,
        rating,
        comment: comment || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Submit feedback: Error inserting feedback", insertError);
      return errorResponse(
        insertError.message || "Failed to submit feedback",
        500,
      );
    }

    return jsonResponse({
      success: true,
      feedback: {
        id: feedback.id,
        job_id: feedback.job_id,
        rating: feedback.rating,
        comment: feedback.comment,
        submitted_at: feedback.submitted_at,
      },
    });
  } catch (error) {
    console.error("Submit feedback error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to submit feedback",
    );
  }
});
