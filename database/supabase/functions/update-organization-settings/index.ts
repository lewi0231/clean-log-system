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
    const { organization_id, use_predefined_locations } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "Organization ID is required" }),
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

    const updateData: Record<string, unknown> = {};

    if (use_predefined_locations !== undefined) {
      updateData.use_predefined_locations = use_predefined_locations;
    }

    const { data: organization, error: updateError } = await supabase
      .from("organization")
      .update(updateData)
      .eq("id", organization_id)
      .select("use_predefined_locations")
      .single();

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        settings: {
          use_predefined_locations:
            organization?.use_predefined_locations ?? true,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Update organization settings error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to update organization settings";
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
