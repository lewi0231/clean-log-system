import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { useOrganization } from "./useOrganization";

export type UserRole = "admin" | "worker" | null;

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const { organizationId } = useOrganization();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (authLoading || !user?.id || !organizationId) {
      setRole(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    async function fetchUserRole() {
      try {
        const { data: roleData, error: roleError } = await supabase.functions.invoke(
          "get-user-role",
          {
            body: {
              organization_id: organizationId,
            },
          }
        );

        if (cancelled) return;

        if (roleError) {
          setRole(null);
          setLoading(false);
          return;
        }

        if (roleData?.role) {
          const mappedRole = roleData.user_type === "admin" ? "admin" : roleData.role;
          if (__DEV__) {
            console.log("User Role: Found", {
              role: mappedRole,
              user_type: roleData.user_type,
              email: user.email,
            });
          }
          setRole(mappedRole as UserRole);
        } else {
          if (__DEV__) {
            console.warn("User Role: No role found for user", {
              userId: user.id,
              email: user.email,
            });
          }
          setRole(null);
        }
        setLoading(false);
      } catch {
        if (cancelled) return;
        setRole(null);
        setLoading(false);
      }
    }

    setLoading(true);
    void fetchUserRole();

    return () => {
      cancelled = true;
    };
  }, [user?.id, organizationId, authLoading]);

  return {
    role,
    loading,
    isAdmin: role === "admin",
    isWorker: role === "worker",
  };
}
