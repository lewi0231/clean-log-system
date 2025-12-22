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
import {
  validateBusinessMode,
  validateRequiredFields,
} from "../_utils/validation.ts";

// Template definitions (matching dashboard/lib/templates.ts)
const TEMPLATES: Record<
  string,
  Array<{
    name: string;
    label: string;
    field_type: string;
    description: string | null;
    required: boolean;
    order_position: number;
    validation_rules: Record<string, unknown> | null;
    options: string[] | null;
  }>
> = {
  service_based: [
    {
      name: "service_type",
      label: "Service Type",
      field_type: "select",
      description: "Select the service performed",
      required: true,
      order_position: 0,
      validation_rules: null,
      options: [
        "Vacuum + Clean",
        "Wax",
        "Interior Detail",
        "Full Detail",
        "Exterior Wash",
      ],
    },
    {
      name: "number_of_vehicles",
      label: "Number of Vehicles",
      field_type: "number",
      description: "How many vehicles were serviced",
      required: true,
      order_position: 1,
      validation_rules: {
        min: 1,
        max: null,
      },
      options: null,
    },
    {
      name: "notes",
      label: "Notes",
      field_type: "text",
      description: "Additional notes about the job",
      required: false,
      order_position: 2,
      validation_rules: null,
      options: null,
    },
  ],
  resource_tracking: [
    {
      name: "services_performed",
      label: "Services Performed",
      field_type: "grouped_breakdown",
      description: "Select services performed per car",
      required: true,
      order_position: 0,
      validation_rules: null,
      options: ["Vacuum", "Soap", "Wipe", "Polish", "Wax"],
    },
    {
      name: "number_of_cars",
      label: "Number of Cars",
      field_type: "number",
      description: "Total number of cars processed",
      required: true,
      order_position: 1,
      validation_rules: {
        min: 1,
        max: null,
      },
      options: null,
    },
    {
      name: "bulk_services",
      label: "Bulk Services",
      field_type: "grouped_breakdown",
      description: "Services performed in bulk (e.g., vacuum 10 cars)",
      required: false,
      order_position: 2,
      validation_rules: null,
      options: ["Vacuum", "Soap", "Wipe", "Polish", "Wax"],
    },
    {
      name: "notes",
      label: "Notes",
      field_type: "text",
      description: "Additional notes about the job",
      required: false,
      order_position: 3,
      validation_rules: null,
      options: null,
    },
  ],
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, {
    functionName: "apply-field-config-template",
  });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_id",
      "business_mode",
    ]);

    if (!validation.valid) {
      logger.warn("Missing required fields for template application", {
        missingFields: validation.missingFields,
      });
      return errorResponse(
        "Organization ID and business mode are required",
        400,
      );
    }

    const { organization_id, business_mode, reset_existing } = body;

    if (!validateBusinessMode(business_mode)) {
      logger.warn("Invalid business_mode provided", { business_mode });
      return errorResponse(
        "Invalid business_mode. Must be 'service_based' or 'resource_tracking'",
        400,
      );
    }

    const supabase = createServiceRoleClient();

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to apply field config template", {
        organization_id,
      });
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // Check if organization already has field configs
    const { data: existingConfigs, error: checkError } = await supabase
      .from("organization_field_configs")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("active", true)
      .limit(1);

    if (checkError) throw checkError;

    // If fields exist and reset_existing is not true, return error
    if (existingConfigs && existingConfigs.length > 0 && !reset_existing) {
      return errorResponse(
        "Organization already has field configurations. Set 'reset_existing: true' to replace existing fields with template.",
        400,
      );
    }

    // Get template fields
    const templateFields = TEMPLATES[business_mode];
    if (!templateFields || templateFields.length === 0) {
      return errorResponse("Template not found for business mode", 404);
    }

    // If reset_existing is true, archive all existing active field configs
    if (reset_existing && existingConfigs && existingConfigs.length > 0) {
      const { error: archiveError } = await supabase
        .from("organization_field_configs")
        .update({ active: false, archived_at: new Date().toISOString() })
        .eq("organization_id", organization_id)
        .eq("active", true);

      if (archiveError) throw archiveError;
    }

    // Get all existing field configs (including archived) for this organization
    const { data: allExistingConfigs, error: fetchAllError } = await supabase
      .from("organization_field_configs")
      .select("id, name")
      .eq("organization_id", organization_id);

    if (fetchAllError) throw fetchAllError;

    // Create a map of existing field names to their IDs
    const existingFieldsMap = new Map<string, string>();
    if (allExistingConfigs) {
      allExistingConfigs.forEach((fc) => {
        existingFieldsMap.set(fc.name, fc.id);
      });
    }

    // Process template fields: update existing or insert new
    const fieldsToUpdate: Array<{
      id: string;
      data: Record<string, unknown>;
    }> = [];
    const fieldsToInsert: Array<Record<string, unknown>> = [];
    const updatedFieldIds: string[] = [];

    templateFields.forEach((field) => {
      const existingId = existingFieldsMap.get(field.name);
      const fieldData = {
        label: field.label,
        field_type: field.field_type,
        description: field.description,
        required: field.required,
        order_position: field.order_position,
        validation_rules: field.validation_rules,
        options: field.options,
        active: true,
        archived_at: null,
        updated_at: new Date().toISOString(),
      };

      if (existingId) {
        // Update existing field (even if archived)
        fieldsToUpdate.push({ id: existingId, data: fieldData });
        updatedFieldIds.push(existingId);
      } else {
        // Insert new field
        fieldsToInsert.push({
          organization_id,
          name: field.name,
          ...fieldData,
        });
      }
    });

    // Update existing fields
    for (const { id, data } of fieldsToUpdate) {
      const { error: updateError } = await supabase
        .from("organization_field_configs")
        .update(data)
        .eq("id", id);

      if (updateError) throw updateError;
    }

    // Insert new fields (only if there are any)
    const insertedIds: string[] = [];
    if (fieldsToInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("organization_field_configs")
        .insert(fieldsToInsert)
        .select("id");

      if (insertError) throw insertError;
      if (inserted) {
        inserted.forEach((fc: { id: string }) => {
          insertedIds.push(fc.id);
        });
      }
    }

    // Fetch all updated/inserted configs
    const allFieldIds = [...updatedFieldIds, ...insertedIds];
    const { data: createdConfigs, error: fetchError } = await supabase
      .from("organization_field_configs")
      .select()
      .in("id", allFieldIds);

    if (fetchError) throw fetchError;

    logger.info("Field config template applied successfully", {
      organization_id,
      business_mode,
      reset_existing: reset_existing || false,
      field_config_count: createdConfigs?.length || 0,
      updated_count: fieldsToUpdate.length,
      inserted_count: fieldsToInsert.length,
    });

    return jsonResponse({
      success: true,
      field_configs: createdConfigs,
      count: createdConfigs?.length || 0,
    });
  } catch (error) {
    logger.error("Apply template error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to apply field config template"),
      getErrorStatusCode(error),
    );
  }
});
