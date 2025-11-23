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
    // Get token from request body
    const token = await req.text();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch invitation with worker details
    const { data: invitation, error: inviteError } = await supabase
      .from("worker_invitation")
      .select("*, worker(id, name, email, organization_id)")
      .eq("id", token)
      .single();

    if (inviteError || !invitation) {
      return new Response(JSON.stringify({ error: "Invitation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({
          error: "Invitation expired",
          invitation: {
            id: invitation.id,
            worker_email: invitation.worker_email,
            expires_at: invitation.expires_at,
          },
        }),
        {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if invitation is already accepted
    if (invitation.accepted_at) {
      return new Response(
        JSON.stringify({
          error: "Invitation already used",
          invitation: {
            id: invitation.id,
            worker_email: invitation.worker_email,
            accepted_at: invitation.accepted_at,
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return invitation details (without sensitive info)
    return new Response(
      JSON.stringify({
        success: true,
        invitation: {
          id: invitation.id,
          worker_email: invitation.worker_email,
          expires_at: invitation.expires_at,
          worker: invitation.worker,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Get worker invitation error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch invitation";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
