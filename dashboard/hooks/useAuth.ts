"use client";

import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    log.debug("useAuth: Initializing auth state");

    // Use getUser() once on initial mount to verify with server
    supabase.auth.getUser().then(({ data: { user: authUser }, error }) => {
      if (error) {
        log.debug("useAuth: Error getting user", {
          error: error.message,
        });
        setUser(null);
        currentUserIdRef.current = null;
        setLoading(false);
        isInitialLoadRef.current = false;
        return;
      }

      if (authUser) {
        log.info("useAuth: User found", {
          userId: authUser.id,
          email: authUser.email,
        });
        setUser(authUser);
        currentUserIdRef.current = authUser.id;
      } else {
        log.debug("useAuth: No authenticated user");
        setUser(null);
        currentUserIdRef.current = null;
      }
      setLoading(false);
      isInitialLoadRef.current = false;
    });

    // Use onAuthStateChange for reactive updates, but use session data directly
    // instead of calling getUser() again to avoid excessive network requests
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Skip processing during initial load (we already handled it with getUser above)
      if (isInitialLoadRef.current) {
        return;
      }

      log.debug("useAuth: Auth state changed", {
        event,
        hasSession: !!session,
        sessionUserId: session?.user?.id,
      });

      const sessionUser = session?.user ?? null;
      const sessionUserId = sessionUser?.id ?? null;

      // Only update state if the user actually changed
      if (sessionUserId !== currentUserIdRef.current) {
        if (sessionUser) {
          log.info("useAuth: User authenticated", {
            userId: sessionUser.id,
            email: sessionUser.email,
            event,
          });
          setUser(sessionUser);
          currentUserIdRef.current = sessionUserId;
        } else {
          log.info("useAuth: User signed out", { event });
          setUser(null);
          currentUserIdRef.current = null;
        }
        setLoading(false);
      }
    });

    return () => {
      log.debug("useAuth: Cleaning up auth subscription");
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

export default useAuth;
