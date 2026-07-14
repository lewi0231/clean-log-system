import { supabase } from "@/lib/supabase";
import { Session, User } from "@supabase/supabase-js";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);

  const signOut = async () => {
    await supabase.auth.signOut();
    // Redirect to login page after sign out
    router.replace("/login");
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (currentSession?.user) {
        if (__DEV__) {
          console.log("🔐 Auth: Session found", {
            userId: currentSession.user.id,
            email: currentSession.user.email,
          });
        }
        currentUserIdRef.current = currentSession.user.id;
      } else {
        if (__DEV__) {
          console.log("🔐 Auth: No active session");
        }
        currentUserIdRef.current = null;
      }
      setUser(currentSession?.user ?? null);
      setSession(currentSession);
      setLoading(false);
      isInitialLoadRef.current = false;
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      // Skip processing during initial load (we already handled it with getSession above)
      if (isInitialLoadRef.current) {
        return;
      }

      if (__DEV__) {
        console.log("🔐 Auth: State changed", {
          event,
          hasSession: !!currentSession,
          email: currentSession?.user?.email,
        });
      }

      const sessionUser = currentSession?.user ?? null;
      const sessionUserId = sessionUser?.id ?? null;

      // Always update session (it may have refreshed tokens even if user didn't change)
      setSession(currentSession);

      // Only update user state if the user actually changed
      if (sessionUserId !== currentUserIdRef.current) {
        if (sessionUser) {
          if (__DEV__) {
            console.log("🔐 Auth: User authenticated", {
              userId: sessionUser.id,
              email: sessionUser.email,
              event,
            });
          }
        } else {
          if (__DEV__) {
            console.log("🔐 Auth: User signed out", { event });
          }
        }

        setUser(sessionUser);
        currentUserIdRef.current = sessionUserId;
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, session, loading, signOut };
}
