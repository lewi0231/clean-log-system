"use client";

import { organizationSettingsKey } from "@/app/query-provider";
import LocationForm from "@/components/locations/location-form";
import LocationHierarchyManager from "@/components/locations/location-hierarchy-manager";
import LocationList from "@/components/locations/location-list";
import { PageTourWrapper } from "@/components/tours/page-tour-wrapper";
import { locationsTourSteps } from "@/components/tours/tour-definitions";
import { TourTriggerButton } from "@/components/tours/tour-trigger-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton-loaders";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocations } from "@/hooks/use-locations";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
  MapPin,
  Plus,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

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
  const searchParams = useSearchParams();
  const [isLocationFormOpen, setIsLocationFormOpen] = useState(false);
  const [locationSettingsOpen, setLocationSettingsOpen] = useState(false);

  // Get initial tab from URL params, default to "locations"
  const initialTab = useMemo(() => {
    const tab = searchParams.get("tab");
    return tab === "hierarchy" ? "hierarchy" : "locations";
  }, [searchParams]);

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
      active?: boolean;
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
    <PageTourWrapper pageId="locations" steps={locationsTourSteps}>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
          <p className="text-muted-foreground mt-2">
            Manage your organization&apos;s locations and location hierarchy for
            regional pricing.
          </p>
        </div>
        <TourTriggerButton />
      </div>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="locations" data-tour="locations-tab">
            <MapPin className="h-4 w-4 mr-2" />
            Customer Locations
          </TabsTrigger>
          <TabsTrigger value="hierarchy" data-tour="hierarchy-tab">
            <Layers className="h-4 w-4 mr-2" />
            Location Hierarchy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="space-y-6">
          {/* Location Settings */}
          <Collapsible
            open={locationSettingsOpen}
            onOpenChange={setLocationSettingsOpen}
            className="mb-6"
          >
            <Card data-tour="location-settings">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <CardTitle>Location Settings</CardTitle>
                        <CardDescription className="mt-1">
                          Configure how locations appear in the mobile app
                        </CardDescription>
                      </div>
                    </div>
                    {locationSettingsOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="flex items-center justify-between gap-8">
                    <div className="space-y-2 flex-1">
                      <Label
                        htmlFor="predefined-locations"
                        className="text-sm font-medium leading-none"
                      >
                        Customer Locations
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        When enabled, your Customer Locations will appear as
                        selectable options in the mobile app. Workers can choose
                        from your locations when completing jobs. You can still
                        configure custom fields in Mobile Application regardless
                        of this setting.
                      </p>
                    </div>
                    <Switch
                      id="predefined-locations"
                      checked={settings?.use_predefined_locations ?? true}
                      onCheckedChange={handleTogglePredefinedLocations}
                      disabled={settingsLoading}
                      className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <div className="flex items-center justify-between">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Info className="h-4 w-4" />
                    <span>Location pricing tip</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="max-w-xs bg-popover text-popover-foreground border border-border"
                >
                  <p className="text-popover-foreground">
                    Assign locations to a region or company (from the{" "}
                    <Link
                      href="/dashboard/locations?tab=hierarchy"
                      className="text-primary hover:underline font-medium"
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      Location Hierarchy
                    </Link>{" "}
                    tab) to apply regional pricing rules automatically.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
    </PageTourWrapper>
  );
}
