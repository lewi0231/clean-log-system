import { log } from "@/lib/logger";
import { invokeEdgeFunction } from "@/lib/supabase/invoke-edge-function";
import type {
  BillingAddressConfig,
  InvoiceEmailRecipientConfig,
  InvoiceTemplateConfig,
  LineItemDisplayConfig,
  ServiceAddressConfig,
} from "@/lib/types";

export interface GetInvoiceTemplateConfigRequest {
  organization_id: string;
}

export interface GetInvoiceTemplateConfigResponse {
  success: boolean;
  config: InvoiceTemplateConfig;
}

export interface UpdateInvoiceTemplateConfigRequest {
  organization_id: string;
  invoice_title?: string;
  show_logo?: boolean;
  show_abn?: boolean;
  bill_to_fields?: string[];
  service_address_config?: ServiceAddressConfig;
  billing_address_config?: BillingAddressConfig;
  email_recipient_config?: InvoiceEmailRecipientConfig;
  line_item_display?: Partial<LineItemDisplayConfig>;
}

export interface UpdateInvoiceTemplateConfigResponse {
  success: boolean;
  config: InvoiceTemplateConfig;
}

export class InvoiceTemplateService {
  /**
   * Get invoice template configuration for an organization
   */
  static async getConfig(
    organizationId: string,
  ): Promise<InvoiceTemplateConfig> {
    try {
      log.debug("InvoiceTemplateService: Getting template config", {
        organizationId,
      });

      const data = await invokeEdgeFunction<GetInvoiceTemplateConfigResponse>(
        "get-invoice-template-config",
        { organization_id: organizationId },
      );

      if (!data || !data.success || !data.config) {
        throw new Error("Failed to get invoice template config");
      }

      log.info(
        "InvoiceTemplateService: Template config retrieved successfully",
      );
      return data.config as InvoiceTemplateConfig;
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
    request: UpdateInvoiceTemplateConfigRequest,
  ): Promise<InvoiceTemplateConfig> {
    try {
      log.debug("InvoiceTemplateService: Updating template config", {
        organizationId: request.organization_id,
      });

      const data = await invokeEdgeFunction<UpdateInvoiceTemplateConfigResponse>(
        "update-invoice-template-config",
        request as unknown as Record<string, unknown>,
      );

      if (!data || !data.success || !data.config) {
        throw new Error("Failed to update invoice template config");
      }

      log.info("InvoiceTemplateService: Template config updated successfully");
      return data.config as InvoiceTemplateConfig;
    } catch (err) {
      log.error("InvoiceTemplateService: Failed to update template config", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }
}
