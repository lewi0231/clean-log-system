// useAuth.ts
"use client";

import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";

async function getAuthUser(): Promise<User | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    log.debug("useAuth: Error getting user", { error: error.message });
    return null;
  }

  if (user) {
    log.info("useAuth: User found", {
      userId: user.id,
      email: user.email,
    });
    return user;
  }

  log.debug("useAuth: No authenticated user");
  return null;
}

export function useAuth() {
  // Query for initial user state
  const query = useQuery({
    queryKey: ["auth-user"],
    queryFn: getAuthUser,
    staleTime: Infinity, // User state managed by subscription
    gcTime: Infinity,
    retry: false, // Don't retry auth failures
  });

  return {
    user: query.data ?? null,
    loading: query.isLoading,
  };
}
