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
    invoice_send_immediately: data.settings.invoice_send_immediately ?? false,
    feedback_email_send_immediately:
      data.settings.feedback_email_send_immediately ?? false,
    stripe_account_id: data.settings.stripe_account_id ?? null,
    payment_provider: data.settings.payment_provider ?? null,
    currency: data.settings.currency ?? "AUD",
    locale: data.settings.locale ?? "en-AU",
    default_exclusive_group_label:
      data.settings.default_exclusive_group_label ?? null,
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
