import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type {
  PricingCondition,
  PricingRule,
  PricingScope,
  PricingType,
} from "@/lib/types";

export interface ListPricingRulesRequest {
  organization_id: string;
  scopes?: PricingScope[];
  include_inactive?: boolean;
  effective_at?: string;
  location_hierarchy_id?: string | null;
  location_id?: string | null;
  field_config_id?: string;
  option_value?: string;
  pricing_context?: "customer" | "worker";
}

export interface UpsertPricingRuleRequest {
  id?: string;
  organization_id: string;
  scope: PricingScope;
  pricing_type: PricingType;
  pricing_context?: "customer" | "worker"; // Defaults to 'customer' for backward compatibility
  field_config_id?: string | null;
  option_value?: string | null;
  applies_to_field_type?: string | null;
  location_hierarchy_id?: string | null;
  location_id?: string | null;
  currency?: string;
  base_price?: number | null;
  percentage_rate?: number | null;
  minimum_quantity?: number | null;
  maximum_quantity?: number | null;
  tier_definition?: unknown;
  metadata?: Record<string, unknown>;
  worker_payment_type?: "same_structure" | "percentage" | "fixed_rate" | null;
  worker_payment_value?: number | null;
  priority?: number;
  active?: boolean;
  effective_at?: string;
  expires_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  conditions?: Array<
    Omit<
      PricingCondition,
      | "id"
      | "pricing_rule_id"
      | "metadata"
      | "priority"
      | "condition_value"
      | "action_value"
    > & {
      condition_value: string | number;
      action_value: number;
      metadata?: Record<string, unknown>;
      priority?: number;
    }
  >;
}

export class PricingService {
  static async listRules(
    request: ListPricingRulesRequest,
  ): Promise<PricingRule[]> {
    try {
      log.debug("PricingService: listing pricing rules", {
        organizationId: request.organization_id,
        scopes: request.scopes,
      });

      const { data, error } = await supabase.functions.invoke(
        "list-pricing-rules",
        {
          body: request,
        },
      );

      if (error) throw error;

      if (!data || !data.success) {
        throw new Error("Failed to list pricing rules");
      }

      return data.pricing_rules as PricingRule[];
    } catch (err) {
      log.error("PricingService: Failed to list pricing rules", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  static async upsertRule(
    request: UpsertPricingRuleRequest,
  ): Promise<PricingRule> {
    const functionName = request.id
      ? "update-pricing-rule"
      : "create-pricing-rule";

    try {
      log.debug("PricingService: upserting pricing rule", {
        organizationId: request.organization_id,
        scope: request.scope,
        pricingType: request.pricing_type,
        hasId: Boolean(request.id),
      });

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: request,
      });

      // Handle Supabase FunctionsHttpError - when edge function returns non-2xx
      if (error) {
        // Try to extract error message from multiple sources
        let errorMessage = "Failed to upsert pricing rule";

        // First, check if data contains error information (sometimes Supabase puts error response in data)
        if (data && typeof data === "object" && "error" in data) {
          if (typeof data.error === "string") {
            errorMessage = data.error;
          }
        }

        // Check if error has a context with response data
        if (
          typeof error === "object" &&
          error !== null &&
          "context" in error &&
          typeof error.context === "object" &&
          error.context !== null
        ) {
          const context = error.context as Record<string, unknown>;
          // Check for response body
          if ("body" in context) {
            try {
              const body = typeof context.body === "string"
                ? JSON.parse(context.body)
                : context.body;
              if (
                typeof body === "object" &&
                body !== null &&
                "error" in body &&
                typeof body.error === "string"
              ) {
                errorMessage = body.error;
              }
            } catch {
              // Ignore JSON parse errors
            }
          }
          // Check for response data directly
          if ("data" in context && typeof context.data === "object") {
            const responseData = context.data as Record<string, unknown>;
            if (
              "error" in responseData &&
              typeof responseData.error === "string"
            ) {
              errorMessage = responseData.error;
            }
          }
        }

        // Check if error has message property
        if (
          typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string" &&
          errorMessage === "Failed to upsert pricing rule"
        ) {
          errorMessage = error.message;
        } else if (
          error instanceof Error &&
          errorMessage === "Failed to upsert pricing rule"
        ) {
          errorMessage = error.message;
        } else if (typeof error === "string") {
          errorMessage = error;
        }

        log.error("PricingService: Supabase function invoke error", {
          error: errorMessage,
          errorObject: error,
          errorType: error?.constructor?.name,
          hasContext: error && typeof error === "object" && "context" in error,
          data,
        });
        throw new Error(errorMessage);
      }

      // Check for error in response data (edge functions return errors in data.error)
      if (data && typeof data === "object" && "error" in data) {
        const errorMessage = typeof data.error === "string"
          ? data.error
          : "Failed to upsert pricing rule";
        log.error("PricingService: Edge function returned error", {
          error: errorMessage,
          data,
        });
        throw new Error(errorMessage);
      }

      if (!data || !data.pricing_rule) {
        const errorMessage = data?.error || "Failed to upsert pricing rule";
        log.error("PricingService: Missing pricing rule in response", {
          data,
        });
        throw new Error(errorMessage);
      }

      return data.pricing_rule as PricingRule;
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
        ? String(err.message)
        : "Unknown error";

      log.error("PricingService: Failed to upsert pricing rule", {
        error: errorMessage,
        errorObject: err,
        request: {
          organizationId: request.organization_id,
          scope: request.scope,
          pricingType: request.pricing_type,
          hasId: Boolean(request.id),
        },
      });

      throw err instanceof Error ? err : new Error(errorMessage);
    }
  }

  static async deleteRule(id: string): Promise<void> {
    try {
      log.debug("PricingService: deleting pricing rule", { id });

      const { data, error } = await supabase.functions.invoke(
        "delete-pricing-rule",
        {
          body: { id },
        },
      );

      if (error) throw error;
      if (!data || !data.success) {
        throw new Error("Failed to delete pricing rule");
      }
    } catch (err) {
      log.error("PricingService: Failed to delete pricing rule", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  static async listHistory(
    organizationId: string,
    options?: {
      dateFrom?: string;
      dateTo?: string;
      pricingContext?: "customer" | "worker";
    },
  ): Promise<PricingHistoryEntry[]> {
    try {
      log.debug("PricingService: listing pricing history", {
        organizationId,
        dateFrom: options?.dateFrom,
        dateTo: options?.dateTo,
        pricingContext: options?.pricingContext,
      });

      const { data, error } = await supabase.functions.invoke(
        "list-pricing-history",
        {
          body: {
            organization_id: organizationId,
            date_from: options?.dateFrom,
            date_to: options?.dateTo,
            pricing_context: options?.pricingContext,
          },
        },
      );

      if (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : typeof error === "string"
          ? error
          : JSON.stringify(error);
        throw new Error(`Edge function error: ${errorMessage}`);
      }

      if (!data) {
        throw new Error("No data returned from edge function");
      }

      if (!data.success) {
        const errorMessage = data.error || "Failed to list pricing history";
        throw new Error(errorMessage);
      }

      if (!Array.isArray(data.pricing_history)) {
        throw new Error(
          "Invalid response format: pricing_history is not an array",
        );
      }

      return data.pricing_history as PricingHistoryEntry[];
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
        ? String(err.message)
        : typeof err === "string"
        ? err
        : JSON.stringify(err);
      log.error("PricingService: Failed to list pricing history", {
        error: errorMessage,
        errorObject: err,
      });
      throw new Error(errorMessage);
    }
  }
}

export interface PricingHistoryEntry {
  id: string;
  field_name: string;
  option_value?: string;
  location_name?: string;
  old_price?: number;
  new_price: number;
  effective_at: string;
  changed_at?: string; // When the change was actually made (audit timestamp)
  expires_at?: string;
  changed_by?: string;
  change_type: "created" | "updated" | "expired";
  pricing_context?: "customer" | "worker";
}
