"use client";

import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useEffect } from "react";

export const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      queryClient.setQueryData(["auth-user"], session?.user ?? null);
      if (!session?.user) queryClient.clear();
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  return <>{children}</>;
}
