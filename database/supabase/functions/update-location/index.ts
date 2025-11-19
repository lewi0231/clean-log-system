import { serve } from "server";
import { createClient } from "@supabase/supabase-js";

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
    const { id, name, email, address, contact_person, phone } = await req.json();

    if (!id || !name || !email || !address || !contact_person) {
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

    const { data: location, error: locationError } = await supabase
      .from("car_yard")
      .update({
        name,
        email,
        address,
        contact_person,
        phone: phone || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (locationError) throw locationError;

    return new Response(
      JSON.stringify({
        success: true,
        location,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Update location error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to update location";
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

