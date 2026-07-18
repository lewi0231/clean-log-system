import { supabase } from "@/lib/supabase";
import { purgeStaleSupabaseAuthStorage } from "@/lib/purge-stale-supabase-auth-storage";
import { Session, User } from "@supabase/supabase-js";
import { useRouter } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);

  const signOut = useCallback(async () => {
    currentUserIdRef.current = null;
    setUser(null);
    setSession(null);
    setLoading(false);

    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
      await purgeStaleSupabaseAuthStorage(supabaseUrl);
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (cancelled) return;

      if (__DEV__) {
        console.log("🔐 Auth: State changed", {
          event,
          hasSession: !!currentSession,
          email: currentSession?.user?.email,
        });
      }

      const sessionUser = currentSession?.user ?? null;
      const sessionUserId = sessionUser?.id ?? null;

      setSession(currentSession);

      if (sessionUserId !== currentUserIdRef.current) {
        if (sessionUser) {
          if (__DEV__) {
            console.log("🔐 Auth: User authenticated", {
              userId: sessionUser.id,
              email: sessionUser.email,
              event,
            });
          }
        } else if (event !== "INITIAL_SESSION" && __DEV__) {
          console.log("🔐 Auth: User signed out", { event });
        }

        setUser(sessionUser);
        currentUserIdRef.current = sessionUserId;
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ user, session, loading, signOut }),
    [user, session, loading, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
