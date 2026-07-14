import { useAuth } from "@/hooks/useAuth";
import { invokeAuthedFunction } from "@/lib/invoke-authed-function";
import { Worker } from "@/types/worker";
import { useEffect, useState } from "react";

export function useColleagues(organizationId: string | null) {
  const { session, loading: authLoading } = useAuth();
  const [colleagues, setColleagues] = useState<Worker[]>([]);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!organizationId || authLoading || !accessToken) return;

    async function fetchColleagues() {
      try {
        if (__DEV__) {
          console.log("Workers: Fetching workers for organization", organizationId);
        }

        const { data, error } = await invokeAuthedFunction("list-workers", accessToken, {
          body: { organization_id: organizationId },
        });

        if (error) {
          console.error("Fetch Workers Error", error);
          return;
        }

        if (__DEV__) {
          console.log("Fetch Workers: Response received", {
            success: data?.success,
            workers: data?.workers,
          });
        }

        if (data?.workers) {
          // Only active workers should appear as colleagues on jobs (defense in depth)
          setColleagues((data.workers as Worker[]).filter((w) => w.active === true));
        }
      } catch (err) {
        console.error("Workers: Failed to fetch", {
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    fetchColleagues();
  }, [organizationId, session?.access_token, authLoading]);

  return { colleagues };
}
