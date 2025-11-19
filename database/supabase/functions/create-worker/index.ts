import { createClient } from "@supabase/supabase-js";
import { serve } from "server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
} as const;

function generatePinCode(): string {
  // Generate a random 4-6 digit PIN
  const length = Math.floor(Math.random() * 3) + 4; // 4, 5, or 6 digits
  return Math.floor(
    1000 + Math.random() * (Math.pow(10, length) - 1000)
  ).toString();
}

async function ensureUniquePin(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  basePin: string
): Promise<string> {
  let pin = basePin;
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    const { data } = await supabase
      .from("worker")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("pin_code", pin)
      .maybeSingle();

    if (!data) return pin; // Available!

    pin = generatePinCode();
    attempts++;
  }

  throw new Error("Failed to generate unique PIN code");
}

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

    // Generate unique PIN code
    const basePin = generatePinCode();
    const pinCode = await ensureUniquePin(supabase, organization_id, basePin);

    // Create worker
    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .insert({
        organization_id,
        name,
        email,
        phone,
        pin_code: pinCode,
        active: true,
      })
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
