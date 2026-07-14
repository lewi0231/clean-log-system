import { invokeAuthedFunction } from "@/lib/invoke-authed-function";
import { supabase } from "@/lib/supabase";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";

export function useOrganization() {
  const { user, session, loading: authLoading } = useAuth();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedUserIdRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user?.id) {
      setOrganizationId(null);
      setError(null);
      fetchedUserIdRef.current = null;
      setLoading(false);
      return;
    }

    // Workers need a session token for org resolution; admins can fall back to email.
    const accessToken = session?.access_token;
    if (!accessToken && !user.email) {
      return;
    }

    const fetchKey = `${user.id}:${accessToken ?? "no-token"}`;
    if (fetchedUserIdRef.current === fetchKey) {
      setLoading(false);
      return;
    }

    // Skip if we're already fetching
    if (isFetchingRef.current) {
      return;
    }

    async function fetchOrganization() {
      if (!user) return;

      // Mark as fetching to prevent concurrent calls
      isFetchingRef.current = true;

      try {
        if (__DEV__) {
          console.log("🏢 Organization: Fetching organization for user", {
            userId: user.id,
            email: user.email,
          });
        }

        // Call Edge Function to get organization_id
        // For workers: auth token is automatically included in headers
        // For admin users: we can optionally pass email, but the function
        // will also check auth token (for workers)
        const invokeOptions: {
          body: { email?: string; prefer_worker?: boolean };
          headers?: { Authorization: string };
        } = {
          body: {
            ...(user.email ? { email: user.email } : {}),
            prefer_worker: true,
          },
        };

        if (accessToken) {
          invokeOptions.headers = { Authorization: `Bearer ${accessToken}` };
        }

        const { data, error: fetchError } = accessToken
          ? await invokeAuthedFunction("get-organization-id", accessToken, invokeOptions)
          : await supabase.functions.invoke("get-organization-id", invokeOptions);

        if (fetchError) {
          console.error("🏢 Organization: Error fetching", fetchError);
          throw fetchError;
        }

        if (data?.organization_id) {
          if (__DEV__) {
            console.log("🏢 Organization: Found", {
              organizationId: data.organization_id,
            });
          }
          setOrganizationId(data.organization_id);
          fetchedUserIdRef.current = fetchKey;
        } else {
          if (__DEV__) {
            console.warn("🏢 Organization: No organization found for user");
          }
          setError("No organization found");
          fetchedUserIdRef.current = fetchKey; // Mark as fetched even if no org found
        }
      } catch (err) {
        console.error("🏢 Organization: Failed to fetch", {
          error: err instanceof Error ? err.message : "Unknown error",
        });
        setError(err instanceof Error ? err.message : "Failed to fetch organization");
        fetchedUserIdRef.current = fetchKey; // Mark as fetched even on error
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    }

    fetchOrganization();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // We intentionally use user?.id and user?.email instead of user to avoid
    // re-fetching when the user object reference changes but the data hasn't
  }, [user?.id, user?.email, authLoading, session?.access_token]);

  return { organizationId, loading, error };
}
