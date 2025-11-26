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
    const { organization_id } = await req.json();

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

    const [workersResult, locationsResult] = await Promise.all([
      supabase
        .from("worker")
        .select("*")
        .eq("organization_id", organization_id)
        .order("created_at", { ascending: false }),

      supabase
        .from("location")
        .select("*")
        .eq("organization_id", organization_id)
        .order("created_at", { ascending: false }),
    ]);

    if (workersResult.error && locationsResult.error) {
      throw new Error(
        `Failed to fetch workers and locations: ${workersResult.error.message}, ${locationsResult.error.message}`
      );
    }

    if (workersResult.error) {
      throw workersResult.error;
    }

    if (locationsResult.error) {
      throw locationsResult.error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        workers: workersResult.data || [],
        locations: locationsResult.data || [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("List workers and locations error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to list workers and locations";
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
