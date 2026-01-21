import { serve } from "server";
import {
  extractAuthToken,
  getAuthUser,
  getOrganizationIdFromAdmin,
  getOrganizationIdFromWorker,
} from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createServiceRoleClient();

    // Get auth token and user info
    const token = extractAuthToken(req);
    if (!token) {
      return errorResponse("Authentication required", 401);
    }

    const authUser = await getAuthUser(token);
    if (!authUser) {
      return errorResponse("Invalid authentication token", 401);
    }

    const userId = authUser.id;
    const userEmail = authUser.email ?? null;

    // Get request body for organization_id if provided
    let organizationId: string | null = null;
    try {
      const body = await req.json();
      organizationId = (body.organization_id as string) || null;
    } catch {
      // Request body might be empty, that's okay
    }

    // If organization_id not provided, try to get it
    if (!organizationId && userEmail) {
      organizationId = await getOrganizationIdFromAdmin(supabase, userEmail);
    }
    if (!organizationId) {
      organizationId = await getOrganizationIdFromWorker(supabase, userId);
    }

    // Strategy 1: Check if user is an admin (in organization_user table)
    // Note: If a user is both admin and worker (dual-role), admin takes precedence
    // because dashboard permissions are checked here. Mobile app checks worker separately.
    if (userEmail && organizationId) {
      const { data: orgUser, error: orgUserError } = await supabase
        .from("organization_user")
        .select("role, status")
        .eq("email", userEmail)
        .eq("organization_id", organizationId)
        .eq("status", "active") // Only check active users
        .maybeSingle();

      if (!orgUserError && orgUser) {
        return jsonResponse({
          role: orgUser.role, // "admin" or "viewer"
          user_type: "admin",
        });
      }
    }

    // Strategy 2: Check if user is a worker
    if (organizationId) {
      const { data: worker, error: workerError } = await supabase
        .from("worker")
        .select("id")
        .eq("auth_user_id", userId)
        .eq("organization_id", organizationId)
        .eq("active", true)
        .maybeSingle();

      if (!workerError && worker) {
        return jsonResponse({
          role: "worker",
          user_type: "worker",
        });
      }
    }

    // User is neither admin nor worker
    return jsonResponse({
      role: null,
      user_type: null,
    });
  } catch (error) {
    console.error("Get user role error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to get user role"
    );
  }
});

