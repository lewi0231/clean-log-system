import { isInvalidRefreshTokenError } from "@/lib/is-invalid-refresh-token-error";
import { supabase } from "@/lib/supabase";
import { purgeStaleSupabaseAuthStorage } from "@/lib/purge-stale-supabase-auth-storage";
import { AuthError, Session, User } from "@supabase/supabase-js";
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

async function clearInvalidLocalSession(reason: string): Promise<void> {
  if (__DEV__) {
    console.log("🔐 Auth: Clearing invalid local session", { reason });
  }
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (signOutError) {
    if (__DEV__) {
      console.warn("🔐 Auth: Local signOut failed after invalid refresh token", signOutError);
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);

  const applySession = useCallback((currentSession: Session | null) => {
    const sessionUser = currentSession?.user ?? null;
    const sessionUserId = sessionUser?.id ?? null;

    setSession(currentSession);

    // Always clear user when session is gone (avoids stale user with null session).
    if (!sessionUser) {
      setUser(null);
      currentUserIdRef.current = null;
      return;
    }

    if (sessionUserId !== currentUserIdRef.current) {
      if (__DEV__) {
        console.log("🔐 Auth: User authenticated", {
          userId: sessionUser.id,
          email: sessionUser.email,
        });
      }
      setUser(sessionUser);
      currentUserIdRef.current = sessionUserId;
    }
  }, []);

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

      // Resolve session after purge so a dead refresh token doesn't race auth init.
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error && isInvalidRefreshTokenError(error)) {
        await clearInvalidLocalSession(error.message);
        applySession(null);
        setLoading(false);
        return;
      }

      if (error instanceof AuthError && __DEV__) {
        console.warn("🔐 Auth: getSession error", error.message);
      }

      applySession(data.session ?? null);
      setLoading(false);
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

      // Auto-refresh can fail asynchronously; treat as signed out.
      if (event === "TOKEN_REFRESHED" && !currentSession) {
        void clearInvalidLocalSession("TOKEN_REFRESHED without session");
      }

      if (!currentSession && event !== "INITIAL_SESSION" && __DEV__) {
        console.log("🔐 Auth: User signed out", { event });
      }

      applySession(currentSession);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applySession]);

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
