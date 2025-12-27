"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { organizationSettingsKey } from "@/app/query-provider";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { OrganizationSettings } from "@/lib/types";
import useOrganization from "./useOrganization";

async function fetchOrganizationSettings(
  organizationId: string,
): Promise<OrganizationSettings> {
  const { data, error: fetchError } = await supabase.functions.invoke(
    "get-organization-settings",
    {
      body: { organization_id: organizationId },
    },
  );

  if (fetchError) {
    throw fetchError;
  }

  if (!data?.settings) {
    throw new Error("No settings found");
  }

  return {
    name: data.settings.name ?? "",
    use_predefined_locations: data.settings.use_predefined_locations ?? true,
    business_mode: data.settings.business_mode ?? "service_based",
    abn: data.settings.abn ?? null,
    logo_url: data.settings.logo_url ?? null,
    primary_contact_email: data.settings.primary_contact_email ?? null,
    primary_contact_phone: data.settings.primary_contact_phone ?? null,
    business_address: data.settings.business_address ?? null,
    invoice_send_immediately: data.settings.invoice_send_immediately ?? false,
    feedback_email_send_immediately:
      data.settings.feedback_email_send_immediately ?? false,
    rating_config: data.settings.rating_config ?? {
      type: "single",
      dimensions: ["overall"],
    },
    stripe_account_id: data.settings.stripe_account_id ?? null,
    payment_provider: data.settings.payment_provider ?? null,
    currency: data.settings.currency ?? "AUD",
    locale: data.settings.locale ?? "en-AU",
    default_exclusive_group_label:
      data.settings.default_exclusive_group_label ?? null,
    auto_generate_invoices_immediately:
      data.settings.auto_generate_invoices_immediately ?? false,
    bank_transfer_bsb: data.settings.bank_transfer_bsb ?? null,
    bank_transfer_account_number: data.settings.bank_transfer_account_number ??
      null,
    bank_transfer_account_name: data.settings.bank_transfer_account_name ??
      null,
    show_bank_transfer_on_invoices:
      data.settings.show_bank_transfer_on_invoices ?? false,
    default_invoice_due_days: data.settings.default_invoice_due_days ?? 30,
  };
}

export function useOrganizationSettings() {
  const { organizationId } = useOrganization();

  const query = useQuery({
    queryKey: organizationSettingsKey(organizationId),
    enabled: !!organizationId,
    queryFn: () => fetchOrganizationSettings(organizationId as string),
    placeholderData: (previous) => previous,
  });

  // Log errors when they occur
  useEffect(() => {
    if (query.error) {
      log.error("useOrganizationSettings: Failed to fetch settings", {
        error: query.error instanceof Error
          ? query.error.message
          : "Unknown error",
      });
    }
  }, [query.error]);

  return {
    settings: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  };
}
