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

type ModifierType = "per_unit" | "flat" | "multiplier";

interface CreateRateCardRequest {
  action: "create";
  organization_id: string;
  worker_id: string;
  modifier_type: ModifierType;
  modifier_value: number;
  currency?: string;
  effective_from?: string;
  effective_to?: string | null;
  role_title?: string | null;
  notes?: string | null;
  field_config_ids?: string[];
}

interface UpdateRateCardRequest {
  action: "update";
  organization_id: string;
  id: string;
  modifier_type?: ModifierType;
  modifier_value?: number;
  effective_from?: string;
  effective_to?: string | null;
  role_title?: string | null;
  is_active?: boolean;
  notes?: string | null;
  field_config_ids?: string[];
}

interface DeactivateRateCardRequest {
  action: "deactivate";
  organization_id: string;
  id: string;
}

interface DeleteRateCardRequest {
  action: "delete";
  organization_id: string;
  id: string;
}

interface ListRateCardsRequest {
  action: "list";
  organization_id: string;
}

type RateCardRequest =
  | CreateRateCardRequest
  | UpdateRateCardRequest
  | DeactivateRateCardRequest
  | DeleteRateCardRequest
  | ListRateCardsRequest;

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "manage-worker-rate-card" });

  try {
    const body = (await req.json()) as RateCardRequest;

    // Validate organization_id is present
    const validation = validateRequiredFields(
      body as unknown as Record<string, unknown>,
      ["organization_id", "action"],
    );

    if (!validation.valid) {
      logger.warn("Missing required fields for rate card operation", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Missing required fields", 400);
    }

    const { organization_id, action } = body;

    const supabase = createServiceRoleClient();

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to manage rate cards", {
        organization_id,
      });
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    switch (action) {
      case "list": {
        const { data, error } = await supabase
          .from("worker_rate_card")
          .select(
            `
            *,
            worker:worker_id (
              id,
              first_name,
              last_name
            ),
            worker_rate_card_field (
              field_config_id
            )
          `,
          )
          .eq("organization_id", organization_id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Transform field mappings
        const rateCards = (data || []).map((card) => ({
          ...card,
          field_config_ids:
            card.worker_rate_card_field?.map(
              (f: { field_config_id: string }) => f.field_config_id,
            ) || [],
        }));

        return jsonResponse({ success: true, rate_cards: rateCards });
      }

      case "create": {
        const createReq = body as CreateRateCardRequest;

        // Validate required fields for create
        if (!createReq.worker_id || !createReq.modifier_type || createReq.modifier_value === undefined) {
          return errorResponse(
            "worker_id, modifier_type, and modifier_value are required",
            400,
          );
        }

        // Validate modifier_value
        if (createReq.modifier_value <= 0) {
          return errorResponse("modifier_value must be greater than 0", 400);
        }

        // Validate modifier_type
        if (!["per_unit", "flat", "multiplier"].includes(createReq.modifier_type)) {
          return errorResponse(
            "modifier_type must be per_unit, flat, or multiplier",
            400,
          );
        }

        // Create rate card
        const { data: rateCard, error: createError } = await supabase
          .from("worker_rate_card")
          .insert({
            organization_id,
            worker_id: createReq.worker_id,
            modifier_type: createReq.modifier_type,
            modifier_value: createReq.modifier_value,
            currency: createReq.currency || "AUD",
            effective_from:
              createReq.effective_from ||
              new Date().toISOString().split("T")[0],
            effective_to: createReq.effective_to || null,
            role_title: createReq.role_title || null,
            notes: createReq.notes || null,
            is_active: true,
          })
          .select()
          .single();

        if (createError) throw createError;

        // Create field mappings for per_unit type
        if (
          createReq.modifier_type === "per_unit" &&
          createReq.field_config_ids &&
          createReq.field_config_ids.length > 0
        ) {
          const fieldMappings = createReq.field_config_ids.map(
            (fieldConfigId) => ({
              rate_card_id: rateCard.id,
              field_config_id: fieldConfigId,
            }),
          );

          const { error: mappingError } = await supabase
            .from("worker_rate_card_field")
            .insert(fieldMappings);

          if (mappingError) {
            logger.warn("Failed to create field mappings", {
              error: mappingError.message,
            });
          }
        }

        logger.info("Rate card created successfully", {
          rate_card_id: rateCard.id,
          organization_id,
          worker_id: createReq.worker_id,
        });

        return jsonResponse({
          success: true,
          rate_card: {
            ...rateCard,
            field_config_ids: createReq.field_config_ids || [],
          },
        });
      }

      case "update": {
        const updateReq = body as UpdateRateCardRequest;

        if (!updateReq.id) {
          return errorResponse("id is required for update", 400);
        }

        // Verify rate card belongs to organization
        const { data: existing, error: fetchError } = await supabase
          .from("worker_rate_card")
          .select("id")
          .eq("id", updateReq.id)
          .eq("organization_id", organization_id)
          .single();

        if (fetchError || !existing) {
          return errorResponse("Rate card not found", 404);
        }

        // Build update object
        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (updateReq.modifier_type !== undefined) {
          updateData.modifier_type = updateReq.modifier_type;
        }
        if (updateReq.modifier_value !== undefined) {
          updateData.modifier_value = updateReq.modifier_value;
        }
        if (updateReq.effective_from !== undefined) {
          updateData.effective_from = updateReq.effective_from;
        }
        if (updateReq.effective_to !== undefined) {
          updateData.effective_to = updateReq.effective_to;
        }
        if (updateReq.role_title !== undefined) {
          updateData.role_title = updateReq.role_title;
        }
        if (updateReq.is_active !== undefined) {
          updateData.is_active = updateReq.is_active;
        }
        if (updateReq.notes !== undefined) {
          updateData.notes = updateReq.notes;
        }

        const { data: updated, error: updateError } = await supabase
          .from("worker_rate_card")
          .update(updateData)
          .eq("id", updateReq.id)
          .select()
          .single();

        if (updateError) throw updateError;

        // Update field mappings if provided
        if (updateReq.field_config_ids !== undefined) {
          // Delete existing mappings
          await supabase
            .from("worker_rate_card_field")
            .delete()
            .eq("rate_card_id", updateReq.id);

          // Create new mappings if any
          if (updateReq.field_config_ids.length > 0) {
            const fieldMappings = updateReq.field_config_ids.map(
              (fieldConfigId) => ({
                rate_card_id: updateReq.id,
                field_config_id: fieldConfigId,
              }),
            );

            await supabase.from("worker_rate_card_field").insert(fieldMappings);
          }
        }

        logger.info("Rate card updated successfully", {
          rate_card_id: updateReq.id,
          organization_id,
        });

        return jsonResponse({
          success: true,
          rate_card: {
            ...updated,
            field_config_ids: updateReq.field_config_ids || [],
          },
        });
      }

      case "deactivate": {
        const deactivateReq = body as DeactivateRateCardRequest;

        if (!deactivateReq.id) {
          return errorResponse("id is required for deactivate", 400);
        }

        // Verify rate card belongs to organization
        const { data: existing, error: fetchError } = await supabase
          .from("worker_rate_card")
          .select("id")
          .eq("id", deactivateReq.id)
          .eq("organization_id", organization_id)
          .single();

        if (fetchError || !existing) {
          return errorResponse("Rate card not found", 404);
        }

        const { error: deactivateError } = await supabase
          .from("worker_rate_card")
          .update({
            is_active: false,
            effective_to: new Date().toISOString().split("T")[0],
            updated_at: new Date().toISOString(),
          })
          .eq("id", deactivateReq.id);

        if (deactivateError) throw deactivateError;

        logger.info("Rate card deactivated successfully", {
          rate_card_id: deactivateReq.id,
          organization_id,
        });

        return jsonResponse({ success: true });
      }

      case "delete": {
        const deleteReq = body as DeleteRateCardRequest;

        if (!deleteReq.id) {
          return errorResponse("id is required for delete", 400);
        }

        // Verify rate card belongs to organization
        const { data: existing, error: fetchError } = await supabase
          .from("worker_rate_card")
          .select("id")
          .eq("id", deleteReq.id)
          .eq("organization_id", organization_id)
          .single();

        if (fetchError || !existing) {
          return errorResponse("Rate card not found", 404);
        }

        // Field mappings will be cascade deleted due to FK constraint
        const { error: deleteError } = await supabase
          .from("worker_rate_card")
          .delete()
          .eq("id", deleteReq.id);

        if (deleteError) throw deleteError;

        logger.info("Rate card deleted successfully", {
          rate_card_id: deleteReq.id,
          organization_id,
        });

        return jsonResponse({ success: true });
      }

      default:
        return errorResponse(
          "Invalid action. Must be list, create, update, deactivate, or delete",
          400,
        );
    }
  } catch (error) {
    logger.error("Manage worker rate card error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to manage rate card"),
      getErrorStatusCode(error),
    );
  }
});
