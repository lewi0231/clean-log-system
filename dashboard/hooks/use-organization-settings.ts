"use client";

import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { OrganizationSettings } from "@/lib/types";
import { useEffect, useState } from "react";
import useOrganization from "./useOrganization";

export function useOrganizationSettings() {
  const { organizationId } = useOrganization();
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    async function fetchSettings() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase.functions.invoke(
          "get-organization-settings",
          {
            body: { organization_id: organizationId },
          }
        );

        if (fetchError) {
          throw fetchError;
        }

        if (data?.settings) {
          setSettings({
            use_predefined_locations:
              data.settings.use_predefined_locations ?? true,
            business_mode: data.settings.business_mode ?? "service_based",
          });
        }
      } catch (err) {
        log.error("useOrganizationSettings: Failed to fetch settings", {
          error: err instanceof Error ? err.message : "Unknown error",
        });
        setError(
          err instanceof Error ? err.message : "Failed to fetch settings"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, [organizationId]);

  return { settings, loading, error };
}
