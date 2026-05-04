import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { useOrganization } from "./useOrganization";

export type UserRole = "admin" | "worker" | null;

export function useUserRole() {
    const { user } = useAuth();
    const { organizationId } = useOrganization();
    const [role, setRole] = useState<UserRole>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !organizationId) {
            setRole(null);
            setLoading(false);
            return;
        }

        async function fetchUserRole() {
            if (!user || !organizationId) {
                setRole(null);
                setLoading(false);
                return;
            }

            try {
                // Call edge function to get user role
                const { data: roleData, error: roleError } = await supabase
                    .functions.invoke("get-user-role", {
                        body: {
                            organization_id: organizationId,
                        },
                    });

                if (roleError) {
                    console.error("User Role: Error fetching role", roleError);
                    setRole(null);
                    setLoading(false);
                    return;
                }

                if (roleData?.role) {
                    // Map admin/viewer to "admin", worker to "worker"
                    const mappedRole = roleData.user_type === "admin"
                        ? "admin"
                        : roleData.role;
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
            } catch (err) {
                console.error("User Role: Failed to fetch", {
                    error: err instanceof Error ? err.message : "Unknown error",
                });
                setRole(null);
                setLoading(false);
            }
        }

        fetchUserRole();
    }, [user, organizationId]);

    return {
        role,
        loading,
        isAdmin: role === "admin",
        isWorker: role === "worker",
    };
}
