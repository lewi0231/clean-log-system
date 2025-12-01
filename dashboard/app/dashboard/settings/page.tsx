"use client";

import InvoiceTemplateSettings from "@/components/settings/invoice-template-settings";
import { AutoSaveInput } from "@/components/ui/auto-save-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { BusinessMode, OrganizationSettings } from "@/lib/types";
import { Package, Sparkles, Upload, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function SettingsPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();

  const [settings, setSettings] = useState<OrganizationSettings>({
    name: "",
    use_predefined_locations: true,
    business_mode: "service_based",
    abn: null,
    logo_url: null,
    primary_contact_email: null,
    invoice_send_immediately: false,
    stripe_account_id: null,
    payment_provider: null,
  });

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setSettings({
          name: data.settings.name ?? "",
          use_predefined_locations:
            data.settings.use_predefined_locations ?? true,
          business_mode: data.settings.business_mode ?? "service_based",
          abn: data.settings.abn ?? null,
          logo_url: data.settings.logo_url ?? null,
          primary_contact_email: data.settings.primary_contact_email ?? null,
          invoice_send_immediately:
            data.settings.invoice_send_immediately ?? false,
          stripe_account_id: data.settings.stripe_account_id ?? null,
          payment_provider: data.settings.payment_provider ?? null,
        });
        setLogoPreview(normalizeLogoUrl(data.settings.logo_url ?? null));
      }
    } catch (err) {
      log.error("Settings: Failed to fetch organization settings", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const normalizeLogoUrl = (url: string | null): string | null => {
    if (!url) return null;

    if (url.includes("kong:8000")) {
      return url.replace(/http:\/\/kong:8000/, "http://127.0.0.1:54321");
    }
    return url;
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

      setSettings((prev) => ({
        ...prev,
        use_predefined_locations: checked,
      }));
      log.info("Settings: Predefined locations setting updated successfully");
    } catch (err) {
      log.error("Settings: Failed to update predefined locations setting", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleBusinessModeChange = async (mode: BusinessMode) => {
    if (!organizationId) return;

    try {
      log.info("Settings: Updating business mode", { mode });

      const { data, error: updateError } = await supabase.functions.invoke(
        "update-organization-settings",
        {
          body: {
            organization_id: organizationId,
            business_mode: mode,
          },
        }
      );

      if (updateError) {
        throw updateError;
      }

      if (data?.settings) {
        setSettings((prev) => ({
          ...prev,
          business_mode: data.settings.business_mode,
        }));
      }

      log.info("Settings: Business mode updated successfully", { mode });
    } catch (err) {
      log.error("Settings: Failed to update business mode", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleOrganizationNameChange = async (name: string) => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    log.info("Settings: Updating organization name", { name });

    const { data, error: updateError } = await supabase.functions.invoke(
      "update-organization-settings",
      {
        body: {
          organization_id: organizationId,
          name,
        },
      }
    );

    if (updateError) {
      log.error("Settings: Failed to update organization name", {
        error: updateError,
      });
      throw updateError;
    }

    if (data?.settings) {
      setSettings((prev) => ({
        ...prev,
        name: data.settings.name,
      }));
    }

    log.info("Settings: Organization name updated successfully");
  };

  const handleABNChange = async (abn: string) => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    log.info("Settings: Updating ABN", { abn });

    const { data, error: updateError } = await supabase.functions.invoke(
      "update-organization-settings",
      {
        body: {
          organization_id: organizationId,
          abn: abn || null,
        },
      }
    );

    if (updateError) {
      log.error("Settings: Failed to update ABN", {
        error: updateError,
      });
      throw updateError;
    }

    if (data?.settings) {
      setSettings((prev) => ({
        ...prev,
        abn: data.settings.abn,
      }));
    }

    log.info("Settings: ABN updated successfully");
  };

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !organizationId) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      alert("Please upload a valid image file (JPEG, PNG, WebP, or GIF)");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }

    try {
      setUploadingLogo(true);

      // Create preview
      const previewUrl = URL.createObjectURL(file);
      setLogoPreview(normalizeLogoUrl(previewUrl));

      // Get auth token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      // Convert file to base64 for transmission
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // Upload via edge function
      const { data: uploadData, error: uploadError } =
        await supabase.functions.invoke("upload-organization-logo", {
          body: {
            file_name: file.name,
            file_type: file.type,
            file_data: base64,
            update_organization: true,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

      if (uploadError) {
        throw uploadError;
      }

      if (uploadData?.logo_url) {
        // Update local state
        setSettings((prev) => ({
          ...prev,
          logo_url: uploadData.logo_url,
        }));
        setLogoPreview(normalizeLogoUrl(uploadData.logo_url));

        // Refresh settings to ensure consistency
        await fetchSettings();
      }

      log.info("Settings: Logo uploaded successfully");
    } catch (err) {
      log.error("Settings: Failed to upload logo", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      alert("Failed to upload logo. Please try again.");
      // Reset preview on error
      setLogoPreview(normalizeLogoUrl(settings.logo_url));
    } finally {
      setUploadingLogo(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleLogoDelete = async () => {
    if (!organizationId || !settings.logo_url) return;

    try {
      log.info("Settings: Deleting logo");

      // Update organization to remove logo_url
      // Note: The old logo file will remain in storage but won't be referenced
      // You may want to create a cleanup function later to remove orphaned files
      const { data, error: updateError } = await supabase.functions.invoke(
        "update-organization-settings",
        {
          body: {
            organization_id: organizationId,
            logo_url: null,
          },
        }
      );

      if (updateError) {
        throw updateError;
      }

      // Update local state
      if (data?.settings) {
        setSettings((prev) => ({
          ...prev,
          logo_url: null,
        }));
        setLogoPreview(null);
      }

      log.info("Settings: Logo deleted successfully");
    } catch (err) {
      log.error("Settings: Failed to delete logo", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      alert("Failed to delete logo. Please try again.");
    }
  };

  const handlePrimaryContactEmailChange = async (email: string) => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    log.info("Settings: Updating primary contact email", { email });

    const { data, error: updateError } = await supabase.functions.invoke(
      "update-organization-settings",
      {
        body: {
          organization_id: organizationId,
          primary_contact_email: email || null,
        },
      }
    );

    if (updateError) {
      log.error("Settings: Failed to update primary contact email", {
        error: updateError,
      });
      throw updateError;
    }

    if (data?.settings) {
      setSettings((prev) => ({
        ...prev,
        primary_contact_email: data.settings.primary_contact_email,
      }));
    }

    log.info("Settings: Primary contact email updated successfully");
  };

  const handleInvoiceSendImmediatelyChange = async (checked: boolean) => {
    if (!organizationId) return;

    try {
      log.info("Settings: Updating invoice send immediately setting", {
        checked,
      });

      const { data, error: updateError } = await supabase.functions.invoke(
        "update-organization-settings",
        {
          body: {
            organization_id: organizationId,
            invoice_send_immediately: checked,
          },
        }
      );

      if (updateError) {
        throw updateError;
      }

      if (data?.settings) {
        setSettings((prev) => ({
          ...prev,
          invoice_send_immediately: data.settings.invoice_send_immediately,
        }));
      }

      log.info(
        "Settings: Invoice send immediately setting updated successfully"
      );
    } catch (err) {
      log.error("Settings: Failed to update invoice send immediately setting", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      alert("Failed to update setting. Please try again.");
    }
  };

  const handleConnectStripe = async () => {
    // TODO: Implement Stripe OAuth connection
    // 1. Call edge function to initiate Stripe OAuth flow
    // 2. Redirect user to Stripe authorization page
    // 3. Handle OAuth callback
    // 4. Store stripe_account_id in organization
    alert("Stripe connection will be implemented soon");
  };

  const handleDisconnectStripe = async () => {
    if (!organizationId) return;

    try {
      log.info("Settings: Disconnecting Stripe account");

      const { data, error: updateError } = await supabase.functions.invoke(
        "update-organization-settings",
        {
          body: {
            organization_id: organizationId,
            stripe_account_id: null,
            payment_provider: null,
          },
        }
      );

      if (updateError) {
        throw updateError;
      }

      if (data?.settings) {
        setSettings((prev) => ({
          ...prev,
          stripe_account_id: null,
          payment_provider: null,
        }));
      }

      log.info("Settings: Stripe account disconnected successfully");
    } catch (err) {
      log.error("Settings: Failed to disconnect Stripe account", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      alert("Failed to disconnect Stripe account. Please try again.");
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

      <Tabs defaultValue="organization" className="space-y-6">
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="business">Business Mode</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="invoice">Invoice Template</TabsTrigger>
          <TabsTrigger value="payment">Payment & Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Information</CardTitle>
              <CardDescription>
                Manage your organization&apos;s basic information and details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <AutoSaveInput
                label="Organization Name"
                value={settings.name}
                onSave={handleOrganizationNameChange}
                placeholder="Enter organization name"
                required
                description="The name of your business as it appears throughout the application"
              />

              <AutoSaveInput
                label="ABN (Australian Business Number)"
                value={settings.abn}
                onSave={handleABNChange}
                placeholder="Enter ABN (optional)"
                description="Your Australian Business Number for invoicing and business records (optional)"
              />

              <div className="space-y-2">
                <Label htmlFor="logo">Logo</Label>
                <div className="flex items-center gap-4">
                  {logoPreview || settings.logo_url ? (
                    <div className="relative group">
                      <Image
                        alt="Organization logo"
                        className="h-20 w-20 rounded-md object-cover border"
                        width={80}
                        height={80}
                        unoptimized={
                          process.env.NODE_ENV === "development" ? true : false
                        }
                        src={logoPreview || settings.logo_url || ""}
                      />
                      <button
                        type="button"
                        onClick={handleLogoDelete}
                        disabled={uploadingLogo}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
                        aria-label="Delete logo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-md border border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      ref={fileInputRef}
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="cursor-pointer disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {uploadingLogo
                        ? "Uploading logo..."
                        : "Upload a logo (max 5MB, JPEG, PNG, WebP, or GIF)"}
                    </p>
                  </div>
                </div>
              </div>

              <AutoSaveInput
                label="Primary Contact Email"
                type="email"
                value={settings.primary_contact_email}
                onSave={handlePrimaryContactEmailChange}
                placeholder="Enter primary contact email"
                description="The primary business contact email for account communications and notifications."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Mode</CardTitle>
              <CardDescription>
                Select how your business operates to get tailored guidance and
                features throughout the application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={settings.business_mode}
                onValueChange={(value) =>
                  handleBusinessModeChange(value as BusinessMode)
                }
                className="grid gap-4 md:grid-cols-2"
              >
                <div className="relative">
                  <RadioGroupItem
                    value="service_based"
                    id="service_based"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="service_based"
                    className="flex flex-col rounded-lg border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <div className="font-semibold">Service-Based</div>
                        <div className="text-sm text-muted-foreground">
                          Car Detailer
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Offer specific services at fixed prices (e.g., Vacuum +
                      Clean, Wax, Interior Detail)
                    </p>
                  </Label>
                </div>
                <div className="relative">
                  <RadioGroupItem
                    value="resource_tracking"
                    id="resource_tracking"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="resource_tracking"
                    className="flex flex-col rounded-lg border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Package className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <div className="font-semibold">Resource Tracking</div>
                        <div className="text-sm text-muted-foreground">
                          Car Yard Business
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Track materials and resources used per job (e.g., Soaps,
                      Wipes, Polish)
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="location" className="space-y-6">
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
                    When enabled, your predefined locations will appear as
                    select options in the mobile app. You can still configure
                    custom fields in Mobile Application regardless of this
                    setting.
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
        </TabsContent>

        <TabsContent value="invoice" className="space-y-6">
          <InvoiceTemplateSettings />
        </TabsContent>

        <TabsContent value="payment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Sending</CardTitle>
              <CardDescription>
                Configure how invoices are sent to customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="invoice-send-immediately">
                    Send Invoices Immediately
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {settings.invoice_send_immediately
                      ? "Invoices will be sent to customers immediately upon creation"
                      : "Invoices will be created in draft status and require review before sending"}
                  </p>
                </div>
                <Switch
                  id="invoice-send-immediately"
                  checked={settings.invoice_send_immediately}
                  onCheckedChange={handleInvoiceSendImmediatelyChange}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Providers</CardTitle>
              <CardDescription>
                Connect payment providers to accept payments on invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stripe Connection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Stripe</Label>
                    <p className="text-sm text-muted-foreground">
                      Connect your Stripe account to accept payments
                    </p>
                  </div>
                  {settings.stripe_account_id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Connected
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDisconnectStripe}
                      >
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={handleConnectStripe}
                      disabled={true}
                    >
                      {/* TODO: Implement Stripe OAuth connection flow
                          - Create edge function to initiate Stripe OAuth
                          - Handle OAuth callback to store stripe_account_id
                          - Verify connection status
                          - Store stripe_account_id in organization.stripe_account_id
                      */}
                      Connect Stripe
                    </Button>
                  )}
                </div>
                {settings.stripe_account_id && (
                  <div className="rounded-md bg-muted p-3 text-sm">
                    <p className="font-medium">Stripe Account ID:</p>
                    <p className="text-muted-foreground font-mono">
                      {settings.stripe_account_id}
                    </p>
                  </div>
                )}
                {/* TODO: Full Stripe Integration
                    - Implement Stripe OAuth connection flow
                    - Add webhook handlers for payment events
                    - Create payment processing functions
                    - Add payment status tracking to invoices
                    - Implement payment link generation
                    - Add payment history view
                */}
              </div>

              {/* Future Payment Providers */}
              <Separator />
              <div className="space-y-2">
                <Label className="text-muted-foreground">Coming Soon</Label>
                <p className="text-sm text-muted-foreground">
                  Additional payment providers will be available in the future
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
