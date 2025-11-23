"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { Building2, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const [stats, setStats] = useState({
    workers: 0,
    activeWorkers: 0,
    locations: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organizationId) {
      const fetchStats = async () => {
        try {
          setLoading(true);
          log.debug("Dashboard: Fetching stats");

          const { data, error: fetchError } = await supabase.functions.invoke(
            "list-workers-and-locations",
            {
              body: { organization_id: organizationId },
            }
          );

          if (fetchError) {
            throw fetchError;
          }

          if (data?.workers && data?.locations) {
            const activeWorkers = data.workers.filter(
              (w: { active: boolean }) => w.active
            ).length;
            setStats({
              workers: data.workers.length,
              activeWorkers,
              locations: data.locations.length,
            });
            log.info("Dashboard: Stats fetched successfully", {
              workersCount: data.workers.length,
              locationsCount: data.locations.length,
            });
          }
        } catch (err) {
          log.error("Dashboard: Failed to fetch stats", {
            error: err instanceof Error ? err.message : "Unknown error",
          });
        } finally {
          setLoading(false);
        }
      };

      fetchStats();
    }
  }, [organizationId]);

  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (orgError || !organizationId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-destructive">
            {orgError || "Failed to load organization"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your organization
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.workers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeWorkers} active
            </p>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href="/dashboard/workers">Manage Workers</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.locations}</div>
            <p className="text-xs text-muted-foreground">Total locations</p>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href="/dashboard/locations">Manage Locations</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
