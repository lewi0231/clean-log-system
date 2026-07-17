import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import {
  findCrossOrganizationEmailConflict,
  formatCrossOrgEmailError,
  normalizeLookupEmail,
} from "../_utils/cross-org-email.ts";
import { getOrganizationName, sendWorkerInvitationEmail } from "../_utils/email.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
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

// Load environment variables from .env file (for local development)
await loadEnvIfLocal();

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "create-worker" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "first_name",
      "last_name",
      "email",
      "phone",
      "organization_id",
    ]);

    if (!validation.valid) {
      logger.warn("Missing required fields for worker creation", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Missing required fields", 400);
    }

    const { first_name, last_name, email, phone, organization_id, engagement_type } = body;

    // Compute name from first_name + last_name for backward compatibility
    const name = `${first_name} ${last_name}`.trim();

    const supabase = createServiceRoleClient();

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to create worker", {
        organization_id,
      });
      return errorResponse("You do not have permission to access this organization", 403);
    }

    const { data: orgSettings } = await supabase
      .from("organization_settings")
      .select("workforce_engagement")
      .eq("organization_id", organization_id)
      .maybeSingle();

    const { defaultWorkerEngagementForOrg, isWorkerEngagementType, normalizeWorkforceEngagement } =
      await import("../_utils/workforce-engagement.ts");

    const orgEngagement = normalizeWorkforceEngagement(orgSettings?.workforce_engagement);
    let resolvedEngagement = defaultWorkerEngagementForOrg(orgEngagement);
    if (orgEngagement === "both") {
      if (!isWorkerEngagementType(engagement_type)) {
        return errorResponse(
          "engagement_type is required when the organization engages both employees and contractors",
          400
        );
      }
      resolvedEngagement = engagement_type;
    } else if (engagement_type !== undefined) {
      if (!isWorkerEngagementType(engagement_type)) {
        return errorResponse("engagement_type must be employee or contractor", 400);
      }
      resolvedEngagement = engagement_type;
    }

    const normalizedEmail = normalizeLookupEmail(email);

    const crossOrgConflict = await findCrossOrganizationEmailConflict(
      supabase,
      email,
      organization_id
    );
    if (crossOrgConflict) {
      logger.warn("Rejected worker creation due to cross-org email conflict", {
        organization_id,
        existing_organization_id: crossOrgConflict.existingOrganizationId,
        existing_as: crossOrgConflict.existingAs,
      });
      return errorResponse(formatCrossOrgEmailError(crossOrgConflict), 400);
    }

    const { data: existingWorkerInOrg, error: duplicateWorkerError } = await supabase
      .from("worker")
      .select("id")
      .eq("organization_id", organization_id)
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (duplicateWorkerError) {
      throw duplicateWorkerError;
    }

    if (existingWorkerInOrg) {
      return errorResponse("A worker with this email already exists in this organization", 400);
    }

    // Create worker (without PIN code)
    // Worker is inactive until they accept invitation and create password (auth_user_id is set)
    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .insert({
        organization_id,
        name, // Keep for backward compatibility
        first_name,
        last_name,
        email,
        phone,
        active: false,
        engagement_type: resolvedEngagement ?? "employee",
      })
      .select()
      .single();

    if (workerError) throw workerError;

    // Generate invitation token (UUID)
    const invitationToken = crypto.randomUUID();

    // Calculate expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create worker invitation
    const { error: invitationError } = await supabase.from("worker_invitation").insert({
      id: invitationToken,
      organization_id,
      worker_id: worker.id,
      worker_email: email,
      expires_at: expiresAt.toISOString(),
    });

    if (invitationError) throw invitationError;

    // Get organization name
    const orgName = await getOrganizationName(supabase, organization_id);

    // Send invitation email (don't throw on error - worker and invitation are already created)
    const emailResult = await sendWorkerInvitationEmail(
      supabase,
      {
        workerName: name, // Use computed name for email
        workerEmail: email,
        organizationName: orgName,
        organizationId: organization_id,
        invitationToken,
      },
      false
    ); // false = don't throw on error

    if (!emailResult.success) {
      logger.warn("Worker invitation email failed to send", {
        worker_id: worker?.id,
        email,
        error: emailResult.error,
      });
    }

    logger.info("Worker created successfully", {
      worker_id: worker?.id,
      organization_id,
      email,
    });

    return jsonResponse({
      success: true,
      worker,
      invitation: {
        token: invitationToken,
        expires_at: expiresAt.toISOString(),
      },
      // Surface email delivery status for debugging (e.g. missing WORKER_INVITATION_BASE_URL)
      email_sent: emailResult.success,
      ...(emailResult.error && { email_error: emailResult.error }),
    });
  } catch (error) {
    logger.error("Create worker error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to create worker"),
      getErrorStatusCode(error)
    );
  }
});
