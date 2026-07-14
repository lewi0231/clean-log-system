import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type PendingConfirmationsContextValue = {
  count: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  decrementCount: () => void;
};

const PendingConfirmationsContext = createContext<PendingConfirmationsContextValue | null>(null);

export function PendingConfirmationsProvider({ children }: { children: ReactNode }) {
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

      setCount(data?.count ?? 0);
    } catch (err) {
      console.error("usePendingConfirmationsCount: Failed to fetch", err);
      setError("Failed to load pending confirmations count");
    } finally {
      setLoading(false);
    }
  }, [user, session?.access_token]);

  useEffect(() => {
    fetchCount();

    const interval = setInterval(fetchCount, 60000);

    return () => clearInterval(interval);
  }, [fetchCount]);

  const decrementCount = useCallback(() => {
    setCount((current) => Math.max(0, current - 1));
  }, []);

  const value: PendingConfirmationsContextValue = {
    count,
    loading,
    error,
    refresh: fetchCount,
    decrementCount,
  };

  return (
    <PendingConfirmationsContext.Provider value={value}>
      {children}
    </PendingConfirmationsContext.Provider>
  );
}

export function usePendingConfirmationsCount() {
  const context = useContext(PendingConfirmationsContext);
  if (!context) {
    throw new Error(
      "usePendingConfirmationsCount must be used within a PendingConfirmationsProvider"
    );
  }
  return context;
}
