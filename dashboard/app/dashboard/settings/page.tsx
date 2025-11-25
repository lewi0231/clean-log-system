"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { OrganizationSettings } from "@/lib/types";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();

  const [settings, setSettings] = useState<OrganizationSettings>({
    use_predefined_locations: true,
  });

  const fetchSettings = async () => {
    if (!organizationId) return;

    try {
      log.debug("Settings: Fetching organization settings");

      const { data, error: fetchError } = await supabase.functions.invoke(
        "get-organization-settings",
        {
          body: { organization_id: organizationId },
        }
      );

      if (fetchError) {
        throw fetchError;
      }

      if (data?.settings) {
        setSettings(data.settings);
      }
    } catch (err) {
      log.error("Settings: Failed to fetch organization settings", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleTogglePredefinedLocations = async (checked: boolean) => {
    if (!organizationId) return;

    try {
      log.info("Settings: Updating predefined locations setting", { checked });

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

      setSettings({ use_predefined_locations: checked });
      log.info("Settings: Predefined locations setting updated successfully");
    } catch (err) {
      log.error("Settings: Failed to update predefined locations setting", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Loading settings...</p>
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
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure organization settings
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Location Settings</CardTitle>
            <CardDescription>
              Control whether predefined locations appear in the mobile app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label
                  htmlFor="predefined-locations"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Use Predefined Locations
                </label>
                <p className="text-sm text-muted-foreground">
                  When enabled, your predefined locations will appear as select
                  options in the mobile app. You can still configure custom
                  fields in Mobile Config regardless of this setting.
                </p>
              </div>
              <Switch
                id="predefined-locations"
                checked={settings.use_predefined_locations}
                onCheckedChange={handleTogglePredefinedLocations}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
