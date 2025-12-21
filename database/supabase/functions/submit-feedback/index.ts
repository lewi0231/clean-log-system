import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import {
  checkRateLimit,
  RATE_LIMIT_CONFIGS,
  rateLimitResponse,
} from "../_utils/rate-limit.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Rate limiting for public feedback submission
  const rateLimitResult = await checkRateLimit(req, {
    ...RATE_LIMIT_CONFIGS.moderate,
    identifier: undefined, // Use IP address
  });

  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult);
  }

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

    const { token, rating, ratings: ratingsObj, comment } = body;

    // Validate rating (for backward compatibility)
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return errorResponse("Rating must be a number between 1 and 5", 400);
    }

    // Validate ratings object if provided (for multi-dimensional ratings)
    let validatedRatings: Record<string, number> | null = null;
    if (ratingsObj !== undefined && ratingsObj !== null) {
      if (typeof ratingsObj !== "object" || Array.isArray(ratingsObj)) {
        return errorResponse(
          "Ratings must be an object with dimension names as keys and ratings (1-5) as values",
          400,
        );
      }
      validatedRatings = {};
      for (const [dimension, value] of Object.entries(ratingsObj)) {
        if (typeof value !== "number" || value < 1 || value > 5) {
          return errorResponse(
            `Rating for "${dimension}" must be a number between 1 and 5`,
            400,
          );
        }
        validatedRatings[dimension] = value;
      }
      // Ensure overall is included
      if (!validatedRatings.overall) {
        validatedRatings.overall = rating; // Use the provided rating as overall
      }
    } else {
      // For backward compatibility, create ratings object from single rating
      validatedRatings = { overall: rating };
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
        rating, // Keep for backward compatibility
        ratings: validatedRatings, // Multi-dimensional ratings
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
        ratings: feedback.ratings,
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
