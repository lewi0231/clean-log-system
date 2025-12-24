"use client";

import { PageTourWrapper } from "@/components/tours/page-tour-wrapper";
import { dashboardTourSteps } from "@/components/tours/tour-definitions";
import { TourTriggerButton } from "@/components/tours/tour-trigger-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import {
  CardSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/skeleton-loaders";
import { useLocations } from "@/hooks/use-locations";
import { useWorkers } from "@/hooks/use-workers";
import useOrganization from "@/hooks/useOrganization";
import { Building2, Users } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

export default function Dashboard() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const { workers, loading: workersLoading } = useWorkers();
  const { locations, loading: locationsLoading } = useLocations();

  const loading = workersLoading || locationsLoading;

  const stats = useMemo(() => {
    const activeWorkers = workers.filter((w) => w.active).length;
    return {
      workers: workers.length,
      activeWorkers,
      locations: locations.length,
    };
  }, [workers, locations]);

  if (orgLoading || loading) {
    return (
      <>
        <PageHeaderSkeleton />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </>
    );
  }

  if (orgError || !organizationId) {
    return (
      <ErrorState
        message={orgError || "Failed to load organization"}
        fullScreen
      />
    );
  }

  return (
    <PageTourWrapper pageId="dashboard" steps={dashboardTourSteps}>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Overview of your organization
          </p>
        </div>
        <TourTriggerButton />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card data-tour="workers-card">
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
              <Link href="/dashboard/users">Manage Users</Link>
            </Button>
          </CardContent>
        </Card>

        <Card data-tour="locations-card">
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
    </PageTourWrapper>
  );
}
