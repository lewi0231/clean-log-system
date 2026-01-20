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
  createRateCardSchema,
  deactivateRateCardSchema,
  deleteRateCardSchema,
  rateCardRequestSchema,
  updateRateCardSchema,
  validateRequest,
} from "../_utils/zod-schemas.ts";

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
  const correlationId = logger.getCorrelationId();

  try {
    const rawBody = await req.json();

    // Validate request body with Zod schema
    const validation = validateRequest(rateCardRequestSchema, rawBody);
    if (!validation.success) {
      logger.warn("Validation failed for rate card operation", {
        errors: validation.issues,
      });
      return errorResponse(
        {
          type: "about:blank",
          title: "Validation Failed",
          status: 400,
          detail: validation.error,
          invalidFields: validation.issues.map((issue) => ({
            field: issue.path.join("."),
            error: issue.message,
          })),
        },
        400,
        {},
        correlationId,
      );
    }

    const body = validation.data;
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
        {},
        correlationId,
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
          field_config_ids: card.worker_rate_card_field?.map(
            (f: { field_config_id: string }) => f.field_config_id,
          ) || [],
        }));

        return jsonResponse(
          { success: true, rate_cards: rateCards },
          200,
          {},
          correlationId,
        );
      }

      case "create": {
        const createReq = body as CreateRateCardRequest;

        // Additional validation specific to create operation
        const createValidation = validateRequest(createRateCardSchema, rawBody);
        if (!createValidation.success) {
          logger.warn("Create validation failed", {
            errors: createValidation.issues,
          });
          return errorResponse(
            {
              type: "about:blank",
              title: "Validation Failed",
              status: 400,
              detail: createValidation.error,
              invalidFields: createValidation.issues.map((issue) => ({
                field: issue.path.join("."),
                error: issue.message,
              })),
            },
            400,
            {},
            correlationId,
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
            effective_from: createReq.effective_from ||
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

        return jsonResponse(
          {
            success: true,
            rate_card: {
              ...rateCard,
              field_config_ids: createReq.field_config_ids || [],
            },
          },
          201,
          {},
          correlationId,
        );
      }

      case "update": {
        const updateReq = body as UpdateRateCardRequest;

        // Additional validation specific to update operation
        const updateValidation = validateRequest(updateRateCardSchema, rawBody);
        if (!updateValidation.success) {
          logger.warn("Update validation failed", {
            errors: updateValidation.issues,
          });
          return errorResponse(
            {
              type: "about:blank",
              title: "Validation Failed",
              status: 400,
              detail: updateValidation.error,
              invalidFields: updateValidation.issues.map((issue) => ({
                field: issue.path.join("."),
                error: issue.message,
              })),
            },
            400,
            {},
            correlationId,
          );
        }

        // Verify rate card belongs to organization
        const { data: existing, error: fetchError } = await supabase
          .from("worker_rate_card")
          .select("id")
          .eq("id", updateReq.id)
          .eq("organization_id", organization_id)
          .single();

        if (fetchError || !existing) {
          return errorResponse(
            {
              type: "about:blank",
              title: "Not Found",
              status: 404,
              detail: "Rate card not found or access denied",
            },
            404,
            {},
            correlationId,
          );
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
          const { error: deleteError } = await supabase
            .from("worker_rate_card_field")
            .delete()
            .eq("rate_card_id", updateReq.id);

          if (deleteError) {
            logger.error("Failed to delete existing field mappings", {
              error: deleteError.message,
              rate_card_id: updateReq.id,
            });
            throw deleteError;
          }

          // Create new mappings if any
          if (updateReq.field_config_ids.length > 0) {
            const fieldMappings = updateReq.field_config_ids.map(
              (fieldConfigId) => ({
                rate_card_id: updateReq.id,
                field_config_id: fieldConfigId,
              }),
            );

            const { error: insertError } = await supabase
              .from("worker_rate_card_field")
              .insert(fieldMappings);

            if (insertError) {
              logger.error("Failed to create new field mappings", {
                error: insertError.message,
                rate_card_id: updateReq.id,
              });
              throw insertError;
            }
          }
        }

        // Fetch actual field mappings from database
        const { data: fieldMappings, error: fieldError } = await supabase
          .from("worker_rate_card_field")
          .select("field_config_id")
          .eq("rate_card_id", updateReq.id);

        if (fieldError) {
          logger.warn("Failed to fetch field mappings after update", {
            error: fieldError.message,
            rate_card_id: updateReq.id,
          });
        }

        const fieldConfigIds = fieldMappings?.map((f) => f.field_config_id) ||
          [];

        logger.info("Rate card updated successfully", {
          rate_card_id: updateReq.id,
          organization_id,
        });

        return jsonResponse(
          {
            success: true,
            rate_card: {
              ...updated,
              field_config_ids: fieldConfigIds,
            },
          },
          200,
          {},
          correlationId,
        );
      }

      case "deactivate": {
        const deactivateReq = body as DeactivateRateCardRequest;

        // Additional validation specific to deactivate operation
        const deactivateValidation = validateRequest(
          deactivateRateCardSchema,
          rawBody,
        );
        if (!deactivateValidation.success) {
          logger.warn("Deactivate validation failed", {
            errors: deactivateValidation.issues,
          });
          return errorResponse(
            {
              type: "about:blank",
              title: "Validation Failed",
              status: 400,
              detail: deactivateValidation.error,
              invalidFields: deactivateValidation.issues.map((issue) => ({
                field: issue.path.join("."),
                error: issue.message,
              })),
            },
            400,
            {},
            correlationId,
          );
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

        return jsonResponse({ success: true }, 200, {}, correlationId);
      }

      case "delete": {
        const deleteReq = body as DeleteRateCardRequest;

        // Additional validation specific to delete operation
        const deleteValidation = validateRequest(deleteRateCardSchema, rawBody);
        if (!deleteValidation.success) {
          logger.warn("Delete validation failed", {
            errors: deleteValidation.issues,
          });
          return errorResponse(
            {
              type: "about:blank",
              title: "Validation Failed",
              status: 400,
              detail: deleteValidation.error,
              invalidFields: deleteValidation.issues.map((issue) => ({
                field: issue.path.join("."),
                error: issue.message,
              })),
            },
            400,
            {},
            correlationId,
          );
        }

        // Verify rate card belongs to organization
        const { data: existing, error: fetchError } = await supabase
          .from("worker_rate_card")
          .select("id")
          .eq("id", deleteReq.id)
          .eq("organization_id", organization_id)
          .single();

        if (fetchError || !existing) {
          return errorResponse(
            {
              type: "about:blank",
              title: "Not Found",
              status: 404,
              detail: "Rate card not found or access denied",
            },
            404,
            {},
            correlationId,
          );
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

        return jsonResponse({ success: true }, 204, {}, correlationId);
      }

      default:
        return errorResponse(
          {
            type: "about:blank",
            title: "Bad Request",
            status: 400,
            detail:
              "Invalid action. Must be list, create, update, deactivate, or delete",
          },
          400,
          {},
          correlationId,
        );
    }
  } catch (error) {
    logger.error("Manage worker rate card error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to manage rate card"),
      getErrorStatusCode(error),
      {},
      correlationId,
    );
  }
});
