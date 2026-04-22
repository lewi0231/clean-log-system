import { supabase } from "@/lib/supabase";
import { Worker } from "@/types/worker";
import { useEffect, useState } from "react";

export function useColleagues(organizationId: string | null) {
  const [colleagues, setColleagues] = useState<Worker[]>([]);

  useEffect(() => {
    if (!organizationId) return;

    async function fetchColleagues() {
      try {
        console.log(
          "Workers: Fetching workers for organization",
          organizationId
        );

        const { data, error } = await supabase.functions.invoke(
          "list-workers",
          {
            body: { organization_id: organizationId },
          }
        );

        if (error) {
          console.error("Fetch Workers Error", error);
          return;
        }

        console.log("Fetch Workers: Response received", {
          success: data?.success,
          workers: data?.workers,
        });

        if (data?.workers) {
          // Only active workers should appear as colleagues on jobs (defense in depth)
          setColleagues(
            (data.workers as Worker[]).filter((w) => w.active === true),
          );
        }
      } catch (err) {
        console.error("Workers: Failed to fetch", {
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    fetchColleagues();
  }, [organizationId]);

  return { colleagues };
}
