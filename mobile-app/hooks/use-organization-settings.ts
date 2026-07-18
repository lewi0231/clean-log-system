import { useAuth } from "@/hooks/useAuth";
import { invokeAuthedFunction } from "@/lib/invoke-authed-function";
import { OrganizationSettings } from "@clean-log/shared/types/organization-settings";
import { useEffect, useState } from "react";

export function useOrganizationSettings(organizationId: string | null) {
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!organizationId || authLoading || !accessToken) {
      if (!authLoading) {
        setLoading(false);
      }
      return;
    }

    const fetchSettings = async () => {
      if (__DEV__) {
        console.log("Organization Settings: Fetching...", { organizationId });
      }

      try {
        setLoading(true);
        const { data, error: fetchError } = await invokeAuthedFunction<{
          settings?: OrganizationSettings;
        }>("get-organization-settings", accessToken, {
          body: { organization_id: organizationId },
        });

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
        setError(err instanceof Error ? err.message : "Organization Settings: Failed to fetch");
      } finally {
        setLoading(false);
      }
    };

    void fetchSettings();
  }, [organizationId, session?.access_token, authLoading]);

  return { settings, loading, error };
}
