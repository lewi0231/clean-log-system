import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "create-form-section" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_id",
      "title",
    ]);

    if (!validation.valid) {
      logger.warn("Missing required fields for form section creation", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Missing required fields", 400);
    }

    const {
      organization_id,
      title,
      description,
      order_position,
      collapsed_by_default,
    } = body;

    const supabase = createServiceRoleClient();

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to create form section", {
        organization_id,
      });
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // If order_position not provided, get the max and add 1
    let finalOrderPosition = order_position;
    if (finalOrderPosition === undefined || finalOrderPosition === null) {
      const { data: existingSections } = await supabase
        .from("form_section")
        .select("order_position")
        .eq("organization_id", organization_id)
        .order("order_position", { ascending: false })
        .limit(1)
        .maybeSingle();

      finalOrderPosition = existingSections?.order_position
        ? existingSections.order_position + 1
        : 0;
    }

    const { data: section, error: createError } = await supabase
      .from("form_section")
      .insert({
        organization_id,
        title,
        description: description || null,
        order_position: finalOrderPosition,
        collapsed_by_default: collapsed_by_default || false,
      })
      .select()
      .single();

    if (createError) {
      logger.error("Error creating form section", createError, {
        organization_id,
        title,
      });
      throw createError;
    }

    logger.info("Form section created successfully", {
      section_id: section?.id,
      organization_id,
      title,
    });

    return jsonResponse({
      success: true,
      section,
    });
  } catch (error) {
    logger.error("Create form section error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to create form section"),
      getErrorStatusCode(error),
    );
  }
});
