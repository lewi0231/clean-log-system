import { supabase } from "@/lib/supabase";
import { Location } from "@/types/location";
import { useEffect, useState } from "react";

export function useLocations(organizationId: string | null) {
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    if (!organizationId) return;

    async function fetchLocations() {
      try {
        if (__DEV__) {
          console.log("Locations: Fetching locations for organization", organizationId);
        }

        const { data, error } = await supabase.functions.invoke("list-locations", {
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
  }, [organizationId]);

  return { locations };
}
