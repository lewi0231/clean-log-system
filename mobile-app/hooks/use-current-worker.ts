import { supabase } from "@/lib/supabase";
import { Worker } from "@/types/worker";
import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { useOrganization } from "./useOrganization";

export function useCurrentWorker() {
    const { user } = useAuth();
    const { organizationId } = useOrganization();
    const [worker, setWorker] = useState<Worker | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !organizationId) {
            setWorker(null);
            setLoading(false);
            return;
        }

        async function fetchCurrentWorker() {
            if (!user) {
                setWorker(null);
                setLoading(false);
                return;
            }

            try {
                // Use edge function to get workers, then filter by auth_user_id
                const { data, error } = await supabase.functions.invoke(
                    "list-workers",
                    {
                        body: { organization_id: organizationId },
                    },
                );

                if (error) {
                    console.log("Current Worker: Error fetching workers", {
                        userId: user.id,
                        error: error.message,
                    });
                    setWorker(null);
                } else if (data?.workers) {
                    // Find the worker with matching auth_user_id
                    const currentWorker = data.workers.find(
                        (w: Worker) => w.auth_user_id === user.id && w.active,
                    );

                    if (currentWorker) {
                        console.log("Current Worker: Found", {
                            workerId: currentWorker.id,
                            name: currentWorker.name,
                        });
                        setWorker(currentWorker);
                    } else {
                        console.log(
                            "Current Worker: No worker found for user",
                            {
                                userId: user.id,
                            },
                        );
                        setWorker(null);
                    }
                } else {
                    setWorker(null);
                }
            } catch (err) {
                console.error("Current Worker: Failed to fetch", {
                    error: err instanceof Error ? err.message : "Unknown error",
                });
                setWorker(null);
            } finally {
                setLoading(false);
            }
        }

        fetchCurrentWorker();
    }, [user, organizationId]);

    return { worker, loading };
}
