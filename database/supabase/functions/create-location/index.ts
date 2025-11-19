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
    const { name, email, address, contact_person, phone, organization_id } =
      await req.json();

    if (!name || !email || !address || !contact_person || !organization_id) {
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

    // Create location (car_yard)
    const { data: location, error: locationError } = await supabase
      .from("car_yard")
      .insert({
        organization_id,
        name,
        email,
        address,
        contact_person,
        phone: phone || null,
        active: true,
      })
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
    console.error("Create location error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to create location";
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
