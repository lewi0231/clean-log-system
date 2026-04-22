// useAuth.ts
"use client";

import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

async function getAuthUser(): Promise<User | null> {
  log.debug("useAuth: Fetching user...");
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    log.debug("useAuth: Error getting user", { error: error.message });
    return null;
  }

  if (user) {
    log.debug("useAuth: User found", {
      userId: user.id,
      email: user.email,
    });
    return user;
  }

  log.debug("useAuth: No authenticated user");
  return null;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const isInitialMount = useRef(true);

  // Query for initial user state
  const query = useQuery({
    queryKey: ["auth-user"],
    queryFn: getAuthUser,
    staleTime: 5 * 60 * 1000, // 5 minutes - allow refetch after navigation
    gcTime: Infinity,
    retry: false, // Don't retry auth failures
  });

  // Listen for auth state changes and invalidate the query
  // Skip the initial event to prevent loops (React Query already fetches on mount)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Skip the initial INITIAL_SESSION event - React Query handles the initial fetch
      if (isInitialMount.current) {
        isInitialMount.current = false;
        log.debug("useAuth: Skipping initial auth event", { event });
        return;
      }

      log.debug("useAuth: Auth state changed", {
        event,
        hasSession: !!session,
        userId: session?.user?.id,
      });

      // Invalidate the auth query to refetch user data on actual auth changes
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") {
        queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  return {
    user: query.data ?? null,
    loading: query.isLoading,
  };
}
