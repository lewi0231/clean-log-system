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
    const { id } = await req.json();

    if (!id) {
      return new Response(JSON.stringify({ error: "ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // TODO - think about the logic here - we're hard deleting - may want to archive in the future. Or warn the user that all this data will be lost.
    const { error: deleteError } = await supabase
      .from("organization_field_configs")
      .delete()
      // .update({
      //   active: false,
      //   archived_at: new Date().toISOString(),
      //   updated_at: new Date().toISOString(),
      // })
      .eq("id", id);

    if (deleteError) throw deleteError;

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
    console.error("Delete field config error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to delete field config";
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
