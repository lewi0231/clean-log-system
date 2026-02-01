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
import { useInvoices } from "@/hooks/use-invoices";
import { useLocations } from "@/hooks/use-locations";
import { useWorkers } from "@/hooks/use-workers";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import useOrganization from "@/hooks/useOrganization";
import { AlertTriangle, Building2, FileText, Users } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

export default function Dashboard() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const { formatCurrency } = useOrganizationCurrency();
  const { workers, loading: workersLoading } = useWorkers();
  const { locations, loading: locationsLoading } = useLocations();
  const { invoices, loading: invoicesLoading } = useInvoices();

  const loading = workersLoading || locationsLoading || invoicesLoading;

  const stats = useMemo(() => {
    const activeWorkers = workers.filter((w) => w.active).length;

    // Filter for overdue invoices (excluding test invoices)
    const overdueInvoices = invoices.filter(
      (inv) => inv.status === "overdue" && !inv.is_test
    );
    const overdueCount = overdueInvoices.length;
    const overdueTotal = overdueInvoices.reduce(
      (sum, inv) => sum + (inv.total || 0),
      0
    );

    // Count pending review invoices (excluding test invoices)
    const pendingReviewCount = invoices.filter(
      (inv) => inv.status === "pending_review" && !inv.is_test
    ).length;

    return {
      workers: workers.length,
      activeWorkers,
      locations: locations.length,
      overdueCount,
      overdueTotal,
      pendingReviewCount,
    };
  }, [workers, locations, invoices]);

  if (orgLoading || loading) {
    return (
      <>
        <PageHeaderSkeleton />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton />
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

        {/* Overdue Invoices Card */}
        <Card
          data-tour="overdue-invoices-card"
          className={
            stats.overdueCount > 0 ? "border-destructive/50 bg-destructive/5" : ""
          }
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Overdue Invoices
            </CardTitle>
            <AlertTriangle
              className={`h-4 w-4 ${
                stats.overdueCount > 0
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                stats.overdueCount > 0 ? "text-destructive" : ""
              }`}
            >
              {stats.overdueCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.overdueCount > 0
                ? `${formatCurrency(stats.overdueTotal)} outstanding`
                : "No overdue invoices"}
            </p>
            <Button
              asChild
              variant={stats.overdueCount > 0 ? "destructive" : "outline"}
              className="mt-4 w-full"
            >
              <Link href="/dashboard/invoicing?status=overdue">
                {stats.overdueCount > 0 ? "View Overdue" : "View Invoices"}
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Pending Review Card - Only show if there are pending invoices */}
        {stats.pendingReviewCount > 0 && (
          <Card
            data-tour="pending-review-card"
            className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Review
              </CardTitle>
              <FileText className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-500">
                {stats.pendingReviewCount}
              </div>
              <p className="text-xs text-muted-foreground">
                Invoice{stats.pendingReviewCount !== 1 ? "s" : ""} awaiting
                approval
              </p>
              <Button
                asChild
                variant="outline"
                className="mt-4 w-full border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-500 dark:hover:bg-amber-950"
              >
                <Link href="/dashboard/invoicing?status=pending_review">
                  Review Invoices
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </PageTourWrapper>
  );
}
