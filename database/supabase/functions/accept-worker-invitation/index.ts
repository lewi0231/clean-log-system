import { serve } from "server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createNotification } from "../_utils/notifications.ts";
import { createLogger } from "../_utils/logger.ts";
import {
  createServiceRoleClient,
  getAuthUserByEmail,
  getAuthUserById,
  normalizeAuthEmail,
  type AuthUserLookup,
} from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

type WorkerRow = {
  id: string;
  organization_id: string;
  email: string;
  auth_user_id?: string | null;
};

function isDuplicateAuthError(message: string | undefined): boolean {
  const msg = (message ?? "").toLowerCase();
  return (
    msg.includes("already") ||
    msg.includes("registered") ||
    msg.includes("exists") ||
    msg.includes("duplicate")
  );
}

function validateExistingWorkerAuthMetadata(
  meta: Record<string, unknown>,
  organizationId: string
): string | null {
  const role = meta.role;
  if (role && role !== "worker") {
    return "This email is already registered with a different account type.";
  }

  const existingOrg = meta.organization_id as string | undefined;
  if (existingOrg && existingOrg !== organizationId) {
    return "This email is already linked to another organization.";
  }

  return null;
}

async function linkAuthUserToInvitation(
  supabase: SupabaseClient,
  existing: AuthUserLookup,
  invitation: {
    organization_id: string;
    worker: WorkerRow;
  },
  password: string
): Promise<{ authUserId?: string; error?: string }> {
  const meta = (existing.user_metadata ?? {}) as Record<string, unknown>;
  const metadataError = validateExistingWorkerAuthMetadata(meta, invitation.organization_id);
  if (metadataError) {
    return { error: metadataError };
  }

  const { error: updErr } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: {
      role: "worker",
      organization_id: invitation.organization_id,
      worker_id: invitation.worker.id,
    },
  });
  if (updErr) {
    return { error: `Auth error: ${updErr.message}` };
  }

  return { authUserId: existing.id };
}

async function resolveExistingAuthUser(
  supabase: SupabaseClient,
  workerEmail: string,
  worker: WorkerRow
): Promise<{ user: AuthUserLookup | null; error: unknown | null }> {
  if (worker.auth_user_id) {
    const { data, error } = await getAuthUserById(supabase, worker.auth_user_id);
    if (data?.user) {
      return { user: data.user, error: null };
    }
    if (error) {
      return { user: null, error };
    }
  }

  const { data, error } = await getAuthUserByEmail(supabase, workerEmail);
  return { user: data?.user ?? null, error };
}

serve(async (req) => {
  const logger = createLogger(req, { functionName: "accept-worker-invitation" });
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const validation = validateRequiredFields(body, [
        "invitation_token",
        "password",
        "address",
        "abn",
      ]);

      if (!validation.valid) {
        return errorResponse(
          "Missing required fields: invitation_token, password, address, and abn",
          400
        );
      }

      const { invitation_token, password, address, abn } = body;

      const supabase = createServiceRoleClient();

      // Step 1: Verify invitation exists and not expired
      const { data: invitation, error: inviteError } = await supabase
        .from("worker_invitation")
        .select("*, worker(id, organization_id, email, auth_user_id)")
        .eq("id", invitation_token)
        .single();

      if (inviteError || !invitation) {
        return errorResponse("Invitation not found", 404);
      }

      if (new Date(invitation.expires_at) < new Date()) {
        return errorResponse("Invitation expired", 410);
      }

      if (invitation.accepted_at) {
        return errorResponse("Invitation already used", 400);
      }

      const worker = invitation.worker as WorkerRow;
      const workerEmail = normalizeAuthEmail(invitation.worker_email);

      // Step 2: Create or link Supabase Auth user
      let authUserId: string | undefined;

      const prelinked = await resolveExistingAuthUser(supabase, workerEmail, worker);
      if (prelinked.error && !prelinked.user) {
        logger.warn("Auth user pre-link lookup failed", {
          worker_id: worker.id,
          has_auth_user_id: !!worker.auth_user_id,
        });
      }

      if (prelinked.user) {
        const linked = await linkAuthUserToInvitation(
          supabase,
          prelinked.user,
          invitation,
          password
        );
        if (linked.error) {
          return errorResponse(linked.error, 400);
        }
        authUserId = linked.authUserId;
      } else {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: workerEmail,
          password: password,
          email_confirm: true,
          user_metadata: {
            role: "worker",
            organization_id: invitation.organization_id,
            worker_id: worker.id,
          },
        });

        if (authError) {
          if (!isDuplicateAuthError(authError.message)) {
            return errorResponse(`Auth error: ${authError.message}`, 400);
          }

          const { user: existing, error: lookupErr } = await resolveExistingAuthUser(
            supabase,
            workerEmail,
            worker
          );

          if (lookupErr || !existing?.id) {
            logger.error("Duplicate auth email but user lookup failed", undefined, {
              worker_id: worker.id,
              lookup_error:
                lookupErr instanceof Error ? lookupErr.message : String(lookupErr ?? ""),
            });
            return errorResponse(
              "An account already exists for this email, but we could not complete setup. Please contact your administrator to resend the invitation.",
              400
            );
          }

          const linked = await linkAuthUserToInvitation(supabase, existing, invitation, password);
          if (linked.error) {
            return errorResponse(linked.error, 400);
          }
          authUserId = linked.authUserId;
        } else if (!authData.user) {
          return errorResponse("Auth error: user not returned", 500);
        } else {
          authUserId = authData.user.id;
        }
      }

      if (!authUserId) {
        return errorResponse("Auth error: user not linked", 500);
      }

      // Step 3: Update worker with auth_user_id, address, abn, and set active to true
      const { error: updateError } = await supabase
        .from("worker")
        .update({
          auth_user_id: authUserId,
          address: address,
          abn: abn,
          active: true,
        })
        .eq("id", worker.id);

      if (updateError) {
        logger.error("Update worker error", undefined, { error: updateError.message });
        return errorResponse("Failed to update worker", 500);
      }

      // Step 4: Mark invitation as accepted
      const { error: acceptError } = await supabase
        .from("worker_invitation")
        .update({
          accepted_at: new Date().toISOString(),
          auth_user_id: authUserId,
        })
        .eq("id", invitation_token);

      if (acceptError) {
        logger.error("Accept invitation error", undefined, { error: acceptError.message });
        return errorResponse("Failed to mark invitation as accepted", 500);
      }

      // Step 5: Create notification for admins (non-blocking)
      const { data: workerData } = await supabase
        .from("worker")
        .select("first_name, last_name")
        .eq("id", worker.id)
        .single();

      const workerName = workerData
        ? `${workerData.first_name} ${workerData.last_name}`.trim()
        : invitation.worker_email;

      const notificationResult = await createNotification(supabase, {
        organization_id: invitation.organization_id,
        type: "worker_active",
        title: "Worker Activated",
        message: `${workerName} has completed onboarding and is now active.`,
        related_entity_type: "worker",
        related_entity_id: worker.id,
      });

      if (!notificationResult.success) {
        logger.warn("Failed to create notification", {
          error: notificationResult.error,
        });
      }

      return jsonResponse({
        success: true,
        message: "Account created successfully",
        user: {
          id: authUserId,
          email: invitation.worker_email,
        },
      });
    } catch (error) {
      logger.error("Accept invitation error", error);
      return errorResponse(error instanceof Error ? error : "Failed to accept invitation");
    }
  }

  return errorResponse("Method not allowed", 405);
});
