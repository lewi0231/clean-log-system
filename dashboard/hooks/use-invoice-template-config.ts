"use client";

import { InvoiceTemplateService } from "@/lib/services/invoice-template.service";
import type { InvoiceTemplateConfig } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";
import useOrganization from "./useOrganization";

interface UseInvoiceTemplateConfigResult {
  config: InvoiceTemplateConfig | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateConfig: (
    updates: Partial<InvoiceTemplateConfig>,
  ) => Promise<InvoiceTemplateConfig>;
}

export function useInvoiceTemplateConfig(): UseInvoiceTemplateConfigResult {
  const { organizationId } = useOrganization();
  const [config, setConfig] = useState<InvoiceTemplateConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      setConfig(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const fetchedConfig = await InvoiceTemplateService.getConfig(
        organizationId,
      );
      setConfig(fetchedConfig);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch template config",
      );
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = useCallback(
    async (
      updates: Partial<InvoiceTemplateConfig>,
    ): Promise<InvoiceTemplateConfig> => {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      try {
        setError(null);
        const updatedConfig = await InvoiceTemplateService.updateConfig({
          organization_id: organizationId,
          invoice_title: updates.invoice_title,
          show_logo: updates.show_logo,
          show_abn: updates.show_abn,
          bill_to_fields: updates.bill_to_fields,
          service_address_config: updates.service_address_config,
          billing_address_config: updates.billing_address_config,
          email_recipient_config: updates.email_recipient_config,
          line_item_display: updates.line_item_display,
        });

        setConfig(updatedConfig);
        return updatedConfig;
      } catch (err) {
        const errorMessage = err instanceof Error
          ? err.message
          : "Failed to update template config";
        setError(errorMessage);
        throw err;
      }
    },
    [organizationId],
  );

  return {
    config,
    loading,
    error,
    refetch: fetchConfig,
    updateConfig,
  };
}
