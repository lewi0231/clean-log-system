import { createClient } from "@supabase/supabase-js";
import { serve } from "server";

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
    // Get auth token from headers
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    // Create service role client for database queries
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // If we have a token, try to get the authenticated user (for workers)
    let authUserId: string | null = null;
    if (token) {
      try {
        // Create anon client to verify token and get user
        // Note: SUPABASE_ANON_KEY should be available in edge function environment
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
        if (anonKey) {
          const supabaseAnon = createClient(
            Deno.env.get("SUPABASE_URL")!,
            anonKey
          );
          const {
            data: { user },
            error: userError,
          } = await supabaseAnon.auth.getUser(token);
          if (!userError && user) {
            authUserId = user.id;
          }
        } else {
          // Fallback: Use service role to query auth.users directly
          // Extract user ID from JWT payload (basic approach)
          // For production, you might want to use a JWT library
          console.warn(
            "SUPABASE_ANON_KEY not available, using service role fallback"
          );
        }
      } catch (err) {
        console.error("Error verifying auth token:", err);
        // Continue without authUserId - will fall back to email lookup
      }
    }

    // Try to get email from request body (for admin users)
    let email: string | null = null;
    try {
      const body = await req.json();
      email = body.email || null;
    } catch {
      // Request body might be empty, that's okay
    }

    // Strategy 1: Try to find in organization_user table by email (admin users)
    if (email) {
      const { data: orgUser, error: orgUserError } = await supabaseAdmin
        .from("organization_user")
        .select("organization_id")
        .eq("email", email)
        .maybeSingle();

      if (orgUserError) throw orgUserError;

      if (orgUser) {
        return new Response(
          JSON.stringify({
            organization_id: orgUser.organization_id,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Strategy 2: Find in worker table by auth_user_id (workers)
    if (authUserId) {
      const { data: worker, error: workerError } = await supabaseAdmin
        .from("worker")
        .select("organization_id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (workerError) throw workerError;

      if (worker) {
        return new Response(
          JSON.stringify({
            organization_id: worker.organization_id,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // If we get here, no organization was found
    return new Response(JSON.stringify({ error: "Organization not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Get organization ID error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to get organization ID";
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
