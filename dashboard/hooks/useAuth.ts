"use client";

import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    log.debug("useAuth: Initializing auth state");

    // Use getUser() instead of getSession() to verify with server
    supabase.auth.getUser().then(({ data: { user: authUser }, error }) => {
      if (error) {
        log.debug("useAuth: Error getting user", {
          error: error.message,
        });
        setUser(null);
        setLoading(false);
        return;
      }

      if (authUser) {
        log.info("useAuth: User found", {
          userId: authUser.id,
          email: authUser.email,
        });
        setUser(authUser);
      } else {
        log.debug("useAuth: No authenticated user");
        setUser(null);
      }
      setLoading(false);
    });

    // Keep onAuthStateChange for reactive updates, but verify with getUser()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      log.debug("useAuth: Auth state changed", {
        event,
        hasSession: !!session,
      });

      // Verify with getUser() to ensure authenticity
      const { data: { user: authUser }, error } = await supabase.auth.getUser();

      if (error) {
        log.debug("useAuth: Error verifying user on state change", {
          error: error.message,
          event,
        });
        setUser(null);
        setLoading(false);
        return;
      }

      if (authUser) {
        log.info("useAuth: User authenticated", {
          userId: authUser.id,
          email: authUser.email,
          event,
        });
        setUser(authUser);
      } else {
        log.info("useAuth: User signed out", { event });
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      log.debug("useAuth: Cleaning up auth subscription");
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

export default useAuth;
