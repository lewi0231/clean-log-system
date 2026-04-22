"use client";

import LocationForm from "@/components/locations/location-form";
import LocationHierarchyManager from "@/components/locations/location-hierarchy-manager";
import LocationList from "@/components/locations/location-list";
import { PageTourWrapper } from "@/components/tours/page-tour-wrapper";
import { locationsTourSteps } from "@/components/tours/tour-definitions";
import { TourTriggerButton } from "@/components/tours/tour-trigger-button";
import { Button } from "@/components/ui/button";
import { ContextualHelp } from "@/components/ui/contextual-help";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton-loaders";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocations } from "@/hooks/use-locations";
import useOrganization from "@/hooks/useOrganization";
import { Layers, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function LocationsPage() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization();
  const { locations, loading, error, createLocation, updateLocation, deleteLocation } =
    useLocations();
  const searchParams = useSearchParams();
  const [isLocationFormOpen, setIsLocationFormOpen] = useState(false);

  // Get initial tab from URL params, default to "locations"
  const initialTab = useMemo(() => {
    const tab = searchParams.get("tab");
    return tab === "hierarchy" ? "hierarchy" : "locations";
  }, [searchParams]);

  const handleAddLocation = async (locationData: {
    name: string;
    email: string;
    address: string;
    contact_person: string;
    phone?: string;
    hierarchy_parent_id?: string | null;
    pricing_mode?: "field_based" | "fixed_price";
    fixed_customer_price?: number | null;
    fixed_worker_payment?: number | null;
    fixed_price_currency?: string | null;
  }) => {
    if (!organizationId) return;
    try {
      await createLocation({
        organization_id: organizationId,
        ...locationData,
      });
      toast.success("Location created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create location");
      throw err;
    }
  };

  const handleUpdateLocation = async (
    locationId: string,
    locationData: {
      name: string;
      email: string;
      address: string;
      contact_person: string;
      phone?: string;
      hierarchy_parent_id?: string | null;
      active?: boolean;
      pricing_mode?: "field_based" | "fixed_price";
      fixed_customer_price?: number | null;
      fixed_worker_payment?: number | null;
      fixed_price_currency?: string | null;
    }
  ) => {
    try {
      await updateLocation({
        id: locationId,
        ...locationData,
      });
      toast.success("Location updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update location");
      throw err;
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    try {
      await deleteLocation({ id: locationId });
      toast.success("Location deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete location");
      throw err;
    }
  };

  if (orgLoading) {
    return (
      <>
        <PageHeaderSkeleton />
        <div className="space-y-6">
          <div className="h-10 w-64 bg-muted animate-pulse rounded-md" />
          <TableSkeleton rows={5} columns={6} />
        </div>
      </>
    );
  }

  if (orgError || !organizationId) {
    return <ErrorState message={orgError || "Failed to load organization"} fullScreen />;
  }

  return (
    <PageTourWrapper pageId="locations" steps={locationsTourSteps}>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
          <p className="text-muted-foreground mt-2">
            Manage customer sites and optional hierarchy for regional pricing.
          </p>
        </div>
        <TourTriggerButton />
      </div>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="locations" data-tour="locations-tab" className="cursor-pointer">
            <MapPin className="h-4 w-4 mr-2" />
            Customer Locations
          </TabsTrigger>
          <TabsTrigger value="hierarchy" data-tour="hierarchy-tab" className="cursor-pointer">
            <Layers className="h-4 w-4 mr-2" />
            Location Hierarchy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="space-y-6">
          <div className="flex items-center justify-between gap-2">
            <ContextualHelp label="Customer locations">
              <p>
                Customer locations are the <strong>static sites</strong> a worker can pick when
                submitting a job (e.g. depots or branches). They are not the worker&apos;s GPS
                position — they define <strong>where</strong> the work was done for pricing and
                reporting. Optional feature toggles live in{" "}
                <Link
                  href="/dashboard/settings?tab=features"
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  Settings → Features
                </Link>
                .
              </p>
            </ContextualHelp>
            <Button
              onClick={() => setIsLocationFormOpen(true)}
              className="cursor-pointer"
              data-tour="add-location-button"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </div>

          <div className="space-y-4">
            <LocationList
              locations={locations}
              loading={loading}
              error={error}
              onDeleteLocation={handleDeleteLocation}
              onUpdateLocation={handleUpdateLocation}
            />
          </div>
        </TabsContent>

        <TabsContent value="hierarchy" className="space-y-4">
          <div className="flex items-start gap-2">
            <ContextualHelp label="Location hierarchy" className="mt-0.5">
              <p>
                Use hierarchy to group customer locations (e.g. by company or region) for{" "}
                <strong>structured pricing</strong> and reporting. Workers still pick a{" "}
                <strong>customer location</strong> on the job; hierarchy helps organize those
                locations and apply rules at the right level.
              </p>
            </ContextualHelp>
          </div>
          <LocationHierarchyManager />
        </TabsContent>
      </Tabs>

      <LocationForm
        open={isLocationFormOpen}
        onOpenChange={setIsLocationFormOpen}
        onSuccess={async (locationData, locationId) => {
          if (locationId) {
            await handleUpdateLocation(locationId, locationData);
          } else {
            await handleAddLocation(locationData);
          }
        }}
      />
    </PageTourWrapper>
  );
}
