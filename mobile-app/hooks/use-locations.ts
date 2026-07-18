import { useAuth } from "@/hooks/useAuth";
import { invokeAuthedFunction } from "@/lib/invoke-authed-function";
import { Location } from "@/types/location";
import { useEffect, useState } from "react";

export function useLocations(organizationId: string | null) {
  const { session, loading: authLoading } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!organizationId || authLoading || !accessToken) return;

    async function fetchLocations() {
      try {
        if (__DEV__) {
          console.log("Locations: Fetching locations for organization", organizationId);
        }

        const { data, error } = await invokeAuthedFunction("list-locations", accessToken, {
          body: { organization_id: organizationId },
        });

        if (error) {
          console.error("Fetch Locations Error", error);
          return;
        }

        if (__DEV__) {
          console.log("Fetch Locations: Response received", {
            success: data?.success,
            locations: data?.locations,
          });
        }

        if (data?.locations) {
          setLocations(data.locations);
        }
      } catch (err) {
        console.error("Locations: Failed to fetch", {
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    fetchLocations();
  }, [organizationId, session?.access_token, authLoading]);

  return { locations };
}
