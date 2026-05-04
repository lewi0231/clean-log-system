import { supabase } from "@/lib/supabase";
import { OrganizationSettings } from "@clean-log/shared/types/organization-settings";
import { useEffect, useState } from "react";

export function useOrganizationSettings(organizationId: string | null) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!organizationId) return;

    const fetchSettings = async () => {
      if (__DEV__) {
        console.log("Organization Settings: Fetching...", { organizationId });
      }

      try {
        const { data, error: fetchError } = await supabase.functions.invoke(
          "get-organization-settings",
          {
            body: { organization_id: organizationId },
          },
        );

        if (fetchError) {
          console.error("🏢 Organization Settings: Error fetching", fetchError);
          throw fetchError;
        }

        if (data?.settings) {
          if (__DEV__) {
            console.info("Organization Settings: Success!", data.settings);
          }
          setSettings(data.settings);
        } else {
          if (__DEV__) {
            console.warn("🏢 Organization Settings: None found");
          }
          setError("No organization settings found");
        }
      } catch (err) {
        console.error("🏢 Organization Settings: Failed to fetch", {
          error: err instanceof Error ? err.message : "Unknown error",
        });
        setError(
          err instanceof Error
            ? err.message
            : "Organization Settings: Failed to fetch",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [organizationId]);

  return { settings, loading, error };
}
