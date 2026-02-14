import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createNotification } from "../_utils/notifications.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

// Load environment variables from .env file (for local development)
await loadEnvIfLocal();

/**
 * Convert an admin/viewer dashboard user to also be a worker
 * This allows them to use the mobile app with their existing credentials.
 * 
 * Key behavior:
 * - The same auth_user_id is used for both organization_user and worker records
 * - No new password or invitation needed - they use existing credentials
 * - Worker is immediately set to active since they're already authenticated
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, {
    functionName: "convert-admin-to-worker",
  });

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_user_id",
      "organization_id",
    ]);

    if (!validation.valid) {
      logger.warn("Missing required fields for admin to worker conversion", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Missing required fields", 400);
    }

    const { organization_user_id, organization_id } = body;

    const supabase = createServiceRoleClient();

    // Verify organization membership (caller must be admin of the organization)
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to convert admin to worker", {
        organization_id,
      });
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // Get the organization user
    const { data: orgUser, error: findError } = await supabase
      .from("organization_user")
      .select("*")
      .eq("id", organization_user_id)
      .eq("organization_id", organization_id)
      .single();

    if (findError || !orgUser) {
      logger.warn("Organization user not found", { organization_user_id });
      return errorResponse("User not found", 404);
    }

    // Check if user is activated (has auth_user_id)
    if (!orgUser.auth_user_id) {
      logger.warn("Cannot convert pending user to worker", {
        organization_user_id,
        status: orgUser.status,
      });
      return errorResponse(
        "User must accept their invitation and activate their account before becoming a worker",
        400,
      );
    }

    // Check if worker already exists for this auth_user_id in this organization
    const { data: existingWorker, error: workerCheckError } = await supabase
      .from("worker")
      .select("id")
      .eq("auth_user_id", orgUser.auth_user_id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (workerCheckError) {
      logger.error("Error checking for existing worker", workerCheckError);
      throw workerCheckError;
    }

    if (existingWorker) {
      logger.info("User already has a worker account", {
        organization_user_id,
        worker_id: existingWorker.id,
      });
      return jsonResponse({
        success: true,
        message: "User already has a worker account",
        worker_id: existingWorker.id,
        already_worker: true,
      });
    }

    // Create worker record with same auth_user_id
    // Worker is immediately active since they're already authenticated
    const workerName = orgUser.first_name && orgUser.last_name
      ? `${orgUser.first_name} ${orgUser.last_name}`
      : orgUser.email.split("@")[0];

    const { data: newWorker, error: createError } = await supabase
      .from("worker")
      .insert({
        organization_id: organization_id,
        auth_user_id: orgUser.auth_user_id,
        name: workerName,
        first_name: orgUser.first_name,
        last_name: orgUser.last_name,
        email: orgUser.email,
        phone: orgUser.phone,
        active: true, // Immediately active - no invitation needed
      })
      .select()
      .single();

    if (createError) {
      logger.error("Error creating worker record", createError, {
        organization_user_id,
      });
      throw createError;
    }

    // Update auth user's user_metadata to include worker_id
    // This is critical for worker-related edge functions that use user_metadata.worker_id
    // (e.g., list-pending-confirmations, withdraw-job, create-job)
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
      orgUser.auth_user_id,
      {
        user_metadata: {
          role: "worker",
          organization_id: organization_id,
          worker_id: newWorker.id,
        },
      }
    );

    if (updateAuthError) {
      logger.error("Error updating auth user metadata", updateAuthError, {
        organization_user_id,
        worker_id: newWorker.id,
      });
      // Don't throw - worker was created, just log the warning
      // The worker will still work via auth_user_id lookup in useCurrentWorker
      logger.warn("Worker created but auth user_metadata not updated - some features may not work");
    } else {
      logger.info("Auth user metadata updated with worker_id", {
        auth_user_id: orgUser.auth_user_id,
        worker_id: newWorker.id,
      });
    }

    // Create notification for admins
    const notificationResult = await createNotification(supabase, {
      organization_id: organization_id,
      type: "worker_created",
      title: "Team Member Now a Worker",
      message:
        `${workerName} can now use the mobile app to submit jobs.`,
      related_entity_type: "worker",
      related_entity_id: newWorker.id,
    });

    if (!notificationResult.success) {
      logger.warn("Failed to create notification:", notificationResult.error);
    }

    logger.info("Admin converted to worker successfully", {
      organization_user_id,
      worker_id: newWorker.id,
      organization_id,
    });

    return jsonResponse({
      success: true,
      message:
        "User can now use the mobile app with their existing login credentials",
      worker: {
        id: newWorker.id,
        name: newWorker.name,
        email: newWorker.email,
        active: newWorker.active,
      },
    });
  } catch (error) {
    logger.error("Convert admin to worker error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to convert user to worker"),
      getErrorStatusCode(error),
    );
  }
});
