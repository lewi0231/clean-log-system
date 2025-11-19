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

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        log.info("useAuth: Session found", {
          userId: session.user.id,
          email: session.user.email,
        });
      } else {
        log.debug("useAuth: No active session");
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      log.debug("useAuth: Auth state changed", {
        event,
        hasSession: !!session,
      });

      if (session?.user) {
        log.info("useAuth: User authenticated", {
          userId: session.user.id,
          email: session.user.email,
          event,
        });
      } else {
        log.info("useAuth: User signed out", { event });
      }

      setUser(session?.user ?? null);
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
