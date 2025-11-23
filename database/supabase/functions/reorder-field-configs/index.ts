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
    const { organization_id, field_config_ids } = await req.json();

    if (!organization_id || !Array.isArray(field_config_ids)) {
      return new Response(
        JSON.stringify({
          error: "Organization ID and field_config_ids array are required",
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

    // Update order_position for each field config based on array index
    const updates = field_config_ids.map((id: string, index: number) =>
      supabase
        .from("organization_field_configs")
        .update({
          order_position: index,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("organization_id", organization_id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter((result) => result.error);

    if (errors.length > 0) {
      throw new Error(
        `Failed to update some field configs: ${errors[0].error?.message}`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Reorder field configs error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to reorder field configs";
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
