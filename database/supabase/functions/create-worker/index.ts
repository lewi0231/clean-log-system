import { createClient } from "@supabase/supabase-js";
import { load } from "dotenv";
import { serve } from "server";

// Load environment variables from .env file (for local development)
// This is safe to call even if .env doesn't exist or in production
await load({ export: true });

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
    const { name, email, phone, organization_id } = await req.json();

    if (!name || !email || !phone || !organization_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
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

    const { data: organization, error: orgError } = await supabase
      .from("organization")
      .select("name")
      .eq("id", organization_id)
      .single();

    if (orgError) {
      console.error("Failed to fetch organization name:", orgError);
    }

    const orgName = organization?.name || organization_id;

    // Debug logging before sending email
    const fromEmail = `${orgName} <onboarding@${Deno.env.get(
      "RESEND_FROM_DOMAIN"
    )}>`;
    const apiKey = Deno.env.get("RESEND_API_KEY");

    if (!apiKey) {
      console.error("RESEND_API_KEY is not set!");
    }

    console.log("Sending email with:", {
      from: fromEmail,
      to: [email],
      subject: `${orgName} require you to authenticate`,
      hasApiKey: !!apiKey,
      domain: Deno.env.get("RESEND_FROM_DOMAIN"),
      invitationToken: invitationToken.substring(0, 8) + "...",
    });

    try {
      console.log("Attempting to connect to Resend API...");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },

        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: `${orgName} require you to authenticate`,
          template: {
            id: "cleanlogworkerinvite",
            variables: {
              WORKER_NAME:
                name.charAt(0).toUpperCase() + name.substring(1).toLowerCase(),
              ORGANIZATION_NAME: organization,
              INVITATION_LINK:
                Deno.env.get("WORKER_INVITATION_BASE_URL") +
                "worker/accept-invite/" +
                invitationToken,
            },
          },
          // html: `<div><p>Hi ${
          //   name.charAt(0).toUpperCase() + name.substring(1).toLowerCase()
          // }</p><p>Please follow the following link to complete the authentication process: ${Deno.env.get(
          //   "WORKER_INVITATION_BASE_URL"
          // )!}/worker/accept-invite/${invitationToken}</p></div>`,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json();
        console.error("Resend API error:", {
          status: res.status,
          statusText: res.statusText,
          error: errorBody,
        });

        // Don't throw - worker and invitation are already created
        // Just log and continue
      } else {
        // Parse successful response
        const emailResponse = await res.json();

        if (emailResponse.id) {
          console.log("Invitation email sent successfully:", emailResponse.id);
        } else {
          console.warn("Resend response missing ID:", emailResponse);
        }
      }
    } catch (error) {
      console.error("Failed to send invitation email:", error);
      // Don't throw - worker and invitation are already created
    }

    return new Response(
      JSON.stringify({
        success: true,
        worker,
        invitation: {
          token: invitationToken,
          expires_at: expiresAt.toISOString(),
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Create worker error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to create worker";
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
