import { log } from "@/lib/logger";
import { invokeTypedEdge } from "@/lib/supabase/invoke-edge-function";
import type { InvoiceTemplateConfig } from "@/lib/types";
import type { UpdateInvoiceTemplateConfigRequest } from "@/lib/types/api";

export class InvoiceTemplateService {
  /**
   * Get invoice template configuration for an organization
   */
  static async getConfig(organizationId: string): Promise<InvoiceTemplateConfig> {
    try {
      log.debug("InvoiceTemplateService: Getting template config", {
        organizationId,
      });

      const data = await invokeTypedEdge("get-invoice-template-config", {
        organization_id: organizationId,
      });

      if (!data || !data.success || !data.config) {
        throw new Error("Failed to get invoice template config");
      }

      log.info("InvoiceTemplateService: Template config retrieved successfully");
      return data.config;
    } catch (err) {
      log.error("InvoiceTemplateService: Failed to get template config", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Update invoice template configuration for an organization
   */
  static async updateConfig(
    request: UpdateInvoiceTemplateConfigRequest
  ): Promise<InvoiceTemplateConfig> {
    try {
      log.debug("InvoiceTemplateService: Updating template config", {
        organizationId: request.organization_id,
      });

      const data = await invokeTypedEdge("update-invoice-template-config", request);

      if (!data || !data.success || !data.config) {
        throw new Error("Failed to update invoice template config");
      }

      log.info("InvoiceTemplateService: Template config updated successfully");
      return data.config;
    } catch (err) {
      log.error("InvoiceTemplateService: Failed to update template config", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }
}
