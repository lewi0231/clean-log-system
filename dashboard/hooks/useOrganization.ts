"use client";

import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { useEffect, useRef, useState } from "react";
import useAuth from "./useAuth";

function useOrganization() {
  const { user, loading: authLoading } = useAuth();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedUserIdRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user?.email || !user?.id) {
      setLoading(false);
      // Reset if user is no longer available
      if (!user) {
        setOrganizationId(null);
        fetchedUserIdRef.current = null;
      }
      return;
    }

    // Skip if we've already fetched for this user
    if (fetchedUserIdRef.current === user.id) {
      setLoading(false);
      return;
    }

    // Skip if we're already fetching
    if (isFetchingRef.current) {
      return;
    }

    async function fetchOrganization() {
      if (!user?.email || !user?.id) return;

      // Mark as fetching to prevent concurrent calls
      isFetchingRef.current = true;

      try {
        log.debug("useOrganization: Fetching organization for user", {
          email: user.email,
          userId: user.id,
        });

        // Call Edge Function to get organization_id
        // Since RLS requires service_role, we'll use an Edge Function
        const { data, error: fetchError } = await supabase.functions.invoke(
          "get-organization-id",
          {
            body: { email: user.email },
          },
        );

        if (fetchError) {
          log.error("useOrganization: Edge function error", {
            error: fetchError,
            message: fetchError.message || "Unknown edge function error",
            context: fetchError.context || {},
          });
          throw fetchError;
        }

        if (data?.organization_id) {
          log.info("useOrganization: Organization found", {
            organizationId: data.organization_id,
          });
          setOrganizationId(data.organization_id);
          fetchedUserIdRef.current = user.id;
          setError(null);
        } else {
          log.warn("useOrganization: No organization found for user", {
            email: user.email,
            userId: user.id,
            responseData: data,
          });
          setError("No organization found");
          fetchedUserIdRef.current = user.id; // Mark as fetched even if no org found
        }
      } catch (err) {
        const errorMessage = err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : "Unknown error";

        const errorDetails = err && typeof err === "object"
          ? { ...err }
          : { originalError: err };

        log.error("useOrganization: Failed to fetch organization", {
          error: errorMessage,
          details: errorDetails,
          userEmail: user?.email,
          userId: user?.id,
        });

        setError(errorMessage || "Failed to fetch organization");
        fetchedUserIdRef.current = user.id; // Mark as fetched even on error
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    }

    fetchOrganization();

    // We intentionally use user?.id and user?.email instead of user to avoid
    // re-fetching when the user object reference changes but the data hasn't
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email, authLoading]);

  return { organizationId, loading, error };
}

export default useOrganization;
