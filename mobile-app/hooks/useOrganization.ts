import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";

export function useOrganization() {
  const { user, loading: authLoading } = useAuth();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchOrganization() {
      if (!user) return;

      try {
        console.log("🏢 Organization: Fetching organization for user", {
          userId: user.id,
          email: user.email,
        });

        // Call Edge Function to get organization_id
        // For workers: auth token is automatically included in headers
        // For admin users: we can optionally pass email, but the function
        // will also try to use the auth token first
        const { data, error: fetchError } = await supabase.functions.invoke(
          "get-organization-id",
          {
            // Pass email if available (for admin users), but function will
            // also check auth token (for workers)
            body: user.email ? { email: user.email } : {},
          }
        );

        if (fetchError) {
          console.error("🏢 Organization: Error fetching", fetchError);
          throw fetchError;
        }

        if (data?.organization_id) {
          console.log("🏢 Organization: Found", {
            organizationId: data.organization_id,
          });
          setOrganizationId(data.organization_id);
        } else {
          console.warn("🏢 Organization: No organization found for user");
          setError("No organization found");
        }
      } catch (err) {
        console.error("🏢 Organization: Failed to fetch", {
          error: err instanceof Error ? err.message : "Unknown error",
        });
        setError(
          err instanceof Error ? err.message : "Failed to fetch organization"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchOrganization();
  }, [user, authLoading]);

  return { organizationId, loading, error };
}
