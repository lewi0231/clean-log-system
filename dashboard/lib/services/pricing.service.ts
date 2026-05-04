import { log } from "@/lib/logger";
import { invokeTypedEdge } from "@/lib/supabase/invoke-edge-function";
import type { PricingRule } from "@/lib/types";
import type {
  ListPricingHistoryRequest,
  ListPricingRulesRequest,
  PricingHistoryEntry,
  UpsertPricingRuleRequest,
} from "@/lib/types/pricing-api";

export type {
  ListPricingRulesRequest,
  UpsertPricingRuleRequest,
  PricingHistoryEntry,
} from "@/lib/types/pricing-api";

export class PricingService {
  static async listRules(request: ListPricingRulesRequest): Promise<PricingRule[]> {
    try {
      log.debug("PricingService: listing pricing rules", {
        organizationId: request.organization_id,
        scopes: request.scopes,
      });

      const data = await invokeTypedEdge("list-pricing-rules", request);

      if (!data || !data.success) {
        throw new Error("Failed to list pricing rules");
      }

      return data.pricing_rules || [];
    } catch (err) {
      log.error("PricingService: Failed to list pricing rules", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  static async upsertRule(request: UpsertPricingRuleRequest): Promise<PricingRule> {
    try {
      log.debug("PricingService: upserting pricing rule", {
        organizationId: request.organization_id,
        scope: request.scope,
        pricingType: request.pricing_type,
        hasId: Boolean(request.id),
      });

      const data = request.id
        ? await invokeTypedEdge("update-pricing-rule", request)
        : await invokeTypedEdge("create-pricing-rule", request);

      // Check for error in response data (edge functions return errors in data.error)
      if (data && typeof data === "object" && "error" in data) {
        const errorMessage =
          typeof data.error === "string" ? data.error : "Failed to upsert pricing rule";
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
      const errorMessage =
        err instanceof Error
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

      const data = await invokeTypedEdge("delete-pricing-rule", { id });
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
    }
  ): Promise<PricingHistoryEntry[]> {
    try {
      log.debug("PricingService: listing pricing history", {
        organizationId,
        dateFrom: options?.dateFrom,
        dateTo: options?.dateTo,
        pricingContext: options?.pricingContext,
      });

      const body: ListPricingHistoryRequest = {
        organization_id: organizationId,
        date_from: options?.dateFrom,
        date_to: options?.dateTo,
        pricing_context: options?.pricingContext,
      };

      const data = await invokeTypedEdge("list-pricing-history", body);

      if (!data) {
        throw new Error("No data returned from edge function");
      }

      if (!data.success) {
        const errorMessage = data.error || "Failed to list pricing history";
        throw new Error(errorMessage);
      }

      if (!Array.isArray(data.pricing_history)) {
        throw new Error("Invalid response format: pricing_history is not an array");
      }

      return data.pricing_history as PricingHistoryEntry[];
    } catch (err) {
      const errorMessage =
        err instanceof Error
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
      throw err instanceof Error ? err : new Error(errorMessage);
    }
  }
}
