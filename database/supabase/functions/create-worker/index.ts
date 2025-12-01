import { serve } from "server";
import {
  getOrganizationName,
  sendWorkerInvitationEmail,
} from "../_utils/email.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

// Load environment variables from .env file (for local development)
await loadEnvIfLocal();

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "name",
      "email",
      "phone",
      "organization_id",
    ]);

    if (!validation.valid) {
      return errorResponse("Missing required fields", 400);
    }

    const { name, email, phone, organization_id } = body;

    const supabase = createServiceRoleClient();

    // Create worker (without PIN code)
    // Worker is inactive until they accept invitation and create password (auth_user_id is set)
    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .insert({
        organization_id,
        name,
        email,
        phone,
        active: false,
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
    const { error: invitationError } = await supabase
      .from("worker_invitation")
      .insert({
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
    await sendWorkerInvitationEmail(
      {
        workerName: name,
        workerEmail: email,
        organizationName: orgName,
        invitationToken,
      },
      false
    ); // false = don't throw on error

    return jsonResponse({
      success: true,
      worker,
      invitation: {
        token: invitationToken,
        expires_at: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Create worker error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to create worker"
    );
  }
});
