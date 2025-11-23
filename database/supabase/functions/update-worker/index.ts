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
    const { id, name, email, phone, active } = await req.json();

    if (!id) {
      return new Response(JSON.stringify({ error: "Worker ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build update object with only provided fields
    const updateData: {
      name?: string;
      email?: string;
      phone?: string;
      active?: boolean;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (active !== undefined) updateData.active = active;

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one field must be provided" }),
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

    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (workerError) throw workerError;

    return new Response(
      JSON.stringify({
        success: true,
        worker,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Update worker error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to update worker";
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
