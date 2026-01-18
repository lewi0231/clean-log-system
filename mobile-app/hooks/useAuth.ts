import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);

  const signOut = async () => {
    await supabase.auth.signOut();
    // Redirect to login page after sign out
    router.replace("/login");
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        console.log("🔐 Auth: Session found", {
          userId: session.user.id,
          email: session.user.email,
        });
        currentUserIdRef.current = session.user.id;
      } else {
        console.log("🔐 Auth: No active session");
        currentUserIdRef.current = null;
      }
      setUser(session?.user ?? null);
      setLoading(false);
      isInitialLoadRef.current = false;
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Skip processing during initial load (we already handled it with getSession above)
      if (isInitialLoadRef.current) {
        return;
      }

      console.log("🔐 Auth: State changed", {
        event,
        hasSession: !!session,
        email: session?.user?.email,
      });

      const sessionUser = session?.user ?? null;
      const sessionUserId = sessionUser?.id ?? null;

      // Only update state if the user actually changed
      if (sessionUserId !== currentUserIdRef.current) {
        if (sessionUser) {
          console.log("🔐 Auth: User authenticated", {
            userId: sessionUser.id,
            email: sessionUser.email,
            event,
          });
        } else {
          console.log("🔐 Auth: User signed out", { event });
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

  return { user, loading, signOut };
}
