"use client";

import LocationForm from "@/components/locations/location-form";
import LocationHierarchyManager from "@/components/locations/location-hierarchy-manager";
import LocationList from "@/components/locations/location-list";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocations } from "@/hooks/use-locations";
import useOrganization from "@/hooks/useOrganization";
import { Plus } from "lucide-react";
import { useState } from "react";

export default function LocationsPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const {
    locations,
    loading,
    error,
    createLocation,
    updateLocation,
    deleteLocation,
  } = useLocations();
  const [isLocationFormOpen, setIsLocationFormOpen] = useState(false);

  const handleAddLocation = async (locationData: {
    name: string;
    email: string;
    address: string;
    contact_person: string;
    phone?: string;
    hierarchy_parent_id?: string | null;
  }) => {
    if (!organizationId) return;
    await createLocation({
      organization_id: organizationId,
      ...locationData,
    });
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
    }
  ) => {
    await updateLocation({
      id: locationId,
      ...locationData,
    });
  };

  const handleDeleteLocation = async (locationId: string) => {
    await deleteLocation({ id: locationId });
  };

  if (orgLoading) {
    return <LoadingState message="Loading locations..." fullScreen />;
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
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization&apos;s locations and location hierarchy for
          regional pricing.
        </p>
      </div>

      <Tabs defaultValue="locations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="locations">Customer Locations</TabsTrigger>
          <TabsTrigger value="hierarchy">Location Hierarchy</TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="space-y-6">
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Customer Locations</strong> are the sites where your
              workers complete jobs. They appear in the mobile app when
              &quot;Use Predefined Locations&quot; is enabled.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Tip:</strong> Assign locations to a region (from the
              Location Hierarchy tab) to apply regional pricing rules
              automatically.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1" />
            <Button onClick={() => setIsLocationFormOpen(true)}>
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

        <TabsContent value="hierarchy">
          <LocationHierarchyManager />
        </TabsContent>
      </Tabs>

      <LocationForm
        open={isLocationFormOpen}
        onOpenChange={setIsLocationFormOpen}
        onSuccess={async (locationData, locationId) => {
          setIsLocationFormOpen(false);
          if (locationId) {
            await handleUpdateLocation(locationId, locationData);
          } else {
            await handleAddLocation(locationData);
          }
        }}
      />
    </>
  );
}
