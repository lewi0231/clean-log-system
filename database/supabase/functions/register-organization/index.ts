// supabase/functions/register-organization/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function generateOrgCode(businessName: string): string {
  // Take first 4 letters, uppercase
  let code = businessName
    .replace(/[^a-zA-Z]/g, "")
    .substring(0, 4)
    .toUpperCase();

  // Pad with X if less than 4
  while (code.length < 4) {
    code += "X";
  }

  return code;
}

async function ensureUniqueOrgCode(
  supabase: any,
  baseCode: string
): Promise<string> {
  let code = baseCode;
  let counter = 1;

  while (true) {
    const { data } = await supabase
      .from("organizations")
      .select("id")
      .eq("org_code", code)
      .maybeSingle();

    if (!data) return code; // Available!

    // Try: ACME -> ACM1, ACM2...
    code = baseCode.substring(0, 3) + counter;
    counter++;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { business_name, admin_email, password } = await req.json();

    // Validate input
    if (!business_name || !admin_email || !password) {
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

    // Generate unique org code
    const baseCode = generateOrgCode(business_name);
    const orgCode = await ensureUniqueOrgCode(supabase, baseCode);

    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // 1. Create organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: business_name,
        org_code: orgCode,
        trial_ends_at: trialEndsAt.toISOString(),
      })
      .select()
      .single();

    if (orgError) throw orgError;

    // 2. Create admin user in Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: admin_email,
        password: password,
        email_confirm: true, // Auto-confirm for now (add email verification later)
      });

    if (authError) throw authError;

    // 3. Link user to organization
    const { error: linkError } = await supabase
      .from("organization_users")
      .insert({
        organization_id: org.id,
        email: admin_email,
        role: "admin",
      });

    if (linkError) throw linkError;

    // 4. Return success with org code
    return new Response(
      JSON.stringify({
        success: true,
        message: "Organization created successfully",
        organization: {
          id: org.id,
          name: org.name,
          org_code: orgCode,
        },
        admin_email: admin_email,
        // Show org_code prominently - employees will need this
        instructions: `Your organization code is: ${orgCode}. Give this to your employees for mobile app login.`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Registration failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
