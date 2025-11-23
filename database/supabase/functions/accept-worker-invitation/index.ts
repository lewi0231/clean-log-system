// supabase/functions/accept-worker-invitation/index.ts
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

  if (req.method === "POST") {
    try {
      const { invitation_token, password } = await req.json();

      if (!invitation_token || !password) {
        return new Response(
          JSON.stringify({
            error: "Missing required fields: invitation_token and password",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Step 1: Verify invitation exists and not expired
      const { data: invitation, error: inviteError } = await supabase
        .from("worker_invitation")
        .select("*, worker(id, organization_id, email)")
        .eq("id", invitation_token)
        .single();

      if (inviteError || !invitation) {
        return new Response(JSON.stringify({ error: "Invitation not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(invitation.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Invitation expired" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (invitation.accepted_at) {
        return new Response(
          JSON.stringify({ error: "Invitation already used" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Step 2: Create Supabase Auth user
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: invitation.worker_email,
          password: password,
          email_confirm: true, // Auto-confirm via email link
          user_metadata: {
            role: "worker",
            organization_id: invitation.organization_id,
            worker_id: invitation.worker.id,
          },
        });

      if (authError) {
        return new Response(
          JSON.stringify({ error: `Auth error: ${authError.message}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Step 3: Update worker with auth_user_id and set active to true
      // Worker becomes active once they accept invitation and create password
      const { error: updateError } = await supabase
        .from("worker")
        .update({
          auth_user_id: authData.user.id,
          active: true,
        })
        .eq("id", invitation.worker.id);

      if (updateError) {
        console.error("Update worker error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update worker" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Step 4: Mark invitation as accepted
      const { error: acceptError } = await supabase
        .from("worker_invitation")
        .update({
          accepted_at: new Date().toISOString(),
          auth_user_id: authData.user.id,
        })
        .eq("id", invitation_token);

      if (acceptError) {
        console.error("Accept invitation error:", acceptError);
        return new Response(
          JSON.stringify({ error: "Failed to mark invitation as accepted" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Account created successfully",
          user: {
            id: authData.user.id,
            email: authData.user.email,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Accept invitation error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to accept invitation";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
