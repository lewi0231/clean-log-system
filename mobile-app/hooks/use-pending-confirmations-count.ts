import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";

/**
 * Hook to fetch the count of pending job confirmations for the current worker.
 * Used to display a badge on the Confirm tab.
 */
export function usePendingConfirmationsCount() {
  const { user, session } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCount = useCallback(async () => {
    if (!user || !session?.access_token) {
      setCount(0);
      setLoading(false);
      return;
    }

    try {
      setError(null);

      const { data, error: fetchError } = await supabase.functions.invoke(
        "list-pending-confirmations",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (fetchError) {
        console.error("usePendingConfirmationsCount: Error fetching", fetchError);
        setError("Failed to load pending confirmations count");
        return;
      }

      setCount(data?.count || 0);
    } catch (err) {
      console.error("usePendingConfirmationsCount: Failed to fetch", err);
      setError("Failed to load pending confirmations count");
    } finally {
      setLoading(false);
    }
  }, [user, session?.access_token]);

  useEffect(() => {
    fetchCount();

    // Refresh count periodically (every 60 seconds)
    const interval = setInterval(fetchCount, 60000);

    return () => clearInterval(interval);
  }, [fetchCount]);

  return {
    count,
    loading,
    error,
    refresh: fetchCount,
  };
}
