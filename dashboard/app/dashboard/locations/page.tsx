"use client";

import LocationForm from "@/components/locations/location-form";
import LocationList from "@/components/locations/location-list";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
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
          Manage your organization&apos;s locations
        </p>
      </div>

      <div className="mb-6 p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          These locations will appear as select options in the mobile app when
          the &quot;Use Predefined Locations&quot; setting is enabled. You can
          also configure custom location fields in{" "}
          <a
            href="/dashboard/mobile-config"
            className="text-primary hover:underline font-medium"
          >
            Mobile Config
          </a>
          .
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
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
