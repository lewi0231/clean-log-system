"use client";

import { organizationSettingsKey } from "@/app/query-provider";
import LocationForm from "@/components/locations/location-form";
import LocationHierarchyManager from "@/components/locations/location-hierarchy-manager";
import LocationList from "@/components/locations/location-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton-loaders";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocations } from "@/hooks/use-locations";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Smartphone } from "lucide-react";
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
  const { settings, loading: settingsLoading } = useOrganizationSettings();
  const queryClient = useQueryClient();
  const [isLocationFormOpen, setIsLocationFormOpen] = useState(false);

  const handleTogglePredefinedLocations = async (checked: boolean) => {
    if (!organizationId) return;

    try {
      log.info("Locations: Updating predefined locations setting", { checked });

      const { error: updateError } = await supabase.functions.invoke(
        "update-organization-settings",
        {
          body: {
            organization_id: organizationId,
            use_predefined_locations: checked,
          },
        }
      );

      if (updateError) {
        throw updateError;
      }

      // Invalidate settings query to refetch updated data
      queryClient.invalidateQueries({
        queryKey: organizationSettingsKey(organizationId),
      });

      log.info("Locations: Predefined locations setting updated successfully");
    } catch (err) {
      log.error("Locations: Failed to update predefined locations setting", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      alert("Failed to update setting. Please try again.");
    }
  };

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
      pricing_mode?: "field_based" | "fixed_price";
      fixed_customer_price?: number | null;
      fixed_worker_payment?: number | null;
      fixed_price_currency?: string | null;
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
          {/* Mobile App Integration Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <CardTitle>Mobile App Integration</CardTitle>
              </div>
              <CardDescription>
                Control how locations appear in the mobile app for workers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <Label
                    htmlFor="predefined-locations"
                    className="text-sm font-medium leading-none"
                  >
                    Use Predefined Locations
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, your predefined locations will appear as
                    select options in the mobile app. Workers can choose from
                    your locations when completing jobs. You can still configure
                    custom fields in Mobile Application regardless of this
                    setting.
                  </p>
                </div>
                <Switch
                  id="predefined-locations"
                  checked={settings?.use_predefined_locations ?? true}
                  onCheckedChange={handleTogglePredefinedLocations}
                  disabled={settingsLoading}
                />
              </div>
            </CardContent>
          </Card>

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
