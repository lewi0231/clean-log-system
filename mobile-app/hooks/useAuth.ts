import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        console.log("🔐 Auth: Session found", {
          userId: session.user.id,
          email: session.user.email,
        });
      } else {
        console.log("🔐 Auth: No active session");
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("🔐 Auth: State changed", {
        event,
        hasSession: !!session,
        email: session?.user?.email,
      });

      if (session?.user) {
        console.log("🔐 Auth: User authenticated", {
          userId: session.user.id,
          email: session.user.email,
          event,
        });
      } else {
        console.log("🔐 Auth: User signed out", { event });
      }

      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading, signOut };
}
