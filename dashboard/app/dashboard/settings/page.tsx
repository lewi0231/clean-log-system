"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  FormSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/skeleton-loaders";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { organizationSettingsKey } from "@/app/query-provider";
import InvoiceTemplateSettings from "@/components/settings/invoice-template-settings";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import {
  BusinessMode,
  OrganizationSettings,
  SupportedCurrency,
} from "@/lib/types";
import {
  DollarSign,
  ExternalLink,
  Info,
  Loader2,
  Save,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function SettingsPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // Separate state for business address fields
  const [businessAddressFields, setBusinessAddressFields] = useState({
    street: "",
    city: "",
    state: "",
    postcode: "",
  });

  const [settings, setSettings] = useState<OrganizationSettings>({
    name: "",
    use_predefined_locations: true,
    business_mode: "service_based",
    abn: null,
    logo_url: null,
    primary_contact_email: null,
    primary_contact_phone: null,
    business_address: null,
    invoice_send_immediately: false,
    feedback_email_send_immediately: false,
    auto_generate_invoices_immediately: false,
    bank_transfer_bsb: null,
    bank_transfer_account_number: null,
    bank_transfer_account_name: null,
    show_bank_transfer_on_invoices: false,
    default_invoice_due_days: 30,
    gst_registered: false,
    gst_inclusive: true,
    gst_rate_percent: 10,
    rating_config: { type: "single", dimensions: ["overall"] },
    stripe_account_id: null,
    payment_provider: null,
    currency: "AUD",
    locale: "en-AU",
    default_exclusive_group_label: null,
  });

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });

  // Track unsaved changes and saving state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialSettings, setInitialSettings] =
    useState<OrganizationSettings | null>(null);

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
        // Parse business_address if it exists (format: "Street, City, State Postcode")
        const addressParts = data.settings.business_address
          ? parseBusinessAddress(data.settings.business_address)
          : { street: "", city: "", state: "", postcode: "" };

        setBusinessAddressFields(addressParts);

        setSettings({
          name: data.settings.name ?? "",
          use_predefined_locations:
            data.settings.use_predefined_locations ?? true,
          business_mode: data.settings.business_mode ?? "service_based",
          abn: data.settings.abn ?? null,
          logo_url: data.settings.logo_url ?? null,
          primary_contact_email: data.settings.primary_contact_email ?? null,
          primary_contact_phone: data.settings.primary_contact_phone ?? null,
          business_address: data.settings.business_address ?? null,
          invoice_send_immediately:
            data.settings.invoice_send_immediately ?? false,
          feedback_email_send_immediately:
            data.settings.feedback_email_send_immediately ?? false,
          auto_generate_invoices_immediately:
            data.settings.auto_generate_invoices_immediately ?? false,
          bank_transfer_bsb: data.settings.bank_transfer_bsb ?? null,
          bank_transfer_account_number:
            data.settings.bank_transfer_account_number ?? null,
          bank_transfer_account_name:
            data.settings.bank_transfer_account_name ?? null,
          show_bank_transfer_on_invoices:
            data.settings.show_bank_transfer_on_invoices ?? false,
          default_invoice_due_days:
            data.settings.default_invoice_due_days ?? 30,
          gst_registered: data.settings.gst_registered ?? false,
          gst_inclusive: data.settings.gst_inclusive ?? true,
          gst_rate_percent: data.settings.gst_rate_percent ?? 10,
          rating_config: data.settings.rating_config ?? {
            type: "single",
            dimensions: ["overall"],
          },
          stripe_account_id: data.settings.stripe_account_id ?? null,
          payment_provider: data.settings.payment_provider ?? null,
          currency: data.settings.currency ?? "AUD",
          locale: data.settings.locale ?? "en-AU",
          default_exclusive_group_label:
            data.settings.default_exclusive_group_label ?? null,
        });
        setLogoPreview(normalizeLogoUrl(data.settings.logo_url ?? null));

        // Store initial settings snapshot to track changes
        const initialSnapshot: OrganizationSettings = {
          name: data.settings.name ?? "",
          use_predefined_locations:
            data.settings.use_predefined_locations ?? true,
          business_mode: data.settings.business_mode ?? "service_based",
          abn: data.settings.abn ?? null,
          logo_url: data.settings.logo_url ?? null,
          primary_contact_email: data.settings.primary_contact_email ?? null,
          primary_contact_phone: data.settings.primary_contact_phone ?? null,
          business_address: data.settings.business_address ?? null,
          invoice_send_immediately:
            data.settings.invoice_send_immediately ?? false,
          feedback_email_send_immediately:
            data.settings.feedback_email_send_immediately ?? false,
          auto_generate_invoices_immediately:
            data.settings.auto_generate_invoices_immediately ?? false,
          bank_transfer_bsb: data.settings.bank_transfer_bsb ?? null,
          bank_transfer_account_number:
            data.settings.bank_transfer_account_number ?? null,
          bank_transfer_account_name:
            data.settings.bank_transfer_account_name ?? null,
          show_bank_transfer_on_invoices:
            data.settings.show_bank_transfer_on_invoices ?? false,
          default_invoice_due_days:
            data.settings.default_invoice_due_days ?? 30,
          gst_registered: data.settings.gst_registered ?? false,
          gst_inclusive: data.settings.gst_inclusive ?? true,
          gst_rate_percent: data.settings.gst_rate_percent ?? 10,
          rating_config: data.settings.rating_config ?? {
            type: "single",
            dimensions: ["overall"],
          },
          stripe_account_id: data.settings.stripe_account_id ?? null,
          payment_provider: data.settings.payment_provider ?? null,
          currency: data.settings.currency ?? "AUD",
          locale: data.settings.locale ?? "en-AU",
          default_exclusive_group_label:
            data.settings.default_exclusive_group_label ?? null,
        };
        setInitialSettings(initialSnapshot);
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      log.error("Settings: Failed to fetch organization settings", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  // Track changes to bank transfer settings
  useEffect(() => {
    if (!initialSettings) return;

    const hasBankTransferChanges =
      settings.bank_transfer_bsb !== initialSettings.bank_transfer_bsb ||
      settings.bank_transfer_account_number !==
        initialSettings.bank_transfer_account_number ||
      settings.bank_transfer_account_name !==
        initialSettings.bank_transfer_account_name ||
      settings.show_bank_transfer_on_invoices !==
        initialSettings.show_bank_transfer_on_invoices;

    setHasUnsavedChanges(hasBankTransferChanges);
  }, [
    settings.bank_transfer_bsb,
    settings.bank_transfer_account_number,
    settings.bank_transfer_account_name,
    settings.show_bank_transfer_on_invoices,
    initialSettings,
  ]);

  // Warn user if they try to leave with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const normalizeLogoUrl = (url: string | null): string | null => {
    if (!url) return null;

    if (url.includes("kong:8000")) {
      return url.replace(/http:\/\/kong:8000/, "http://127.0.0.1:54321");
    }
    return url;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    if (!file || !organizationId) {
      // Clear file input if no file selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Validate file type (including SVG)
    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml",
    ];

    // Check file extension as fallback (SVG might not have correct MIME type)
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const isValidExtension =
      ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(
        fileExtension || ""
      ) || validTypes.includes(file.type);

    if (!isValidExtension) {
      setErrorDialog({
        open: true,
        title: "Invalid File Type",
        message:
          "Please upload a valid image file (JPEG, PNG, WebP, GIF, or SVG).",
      });
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorDialog({
        open: true,
        title: "File Too Large",
        message: "Image size must be less than 5MB.",
      });
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    try {
      setUploadingLogo(true);

      // Create preview
      const previewUrl = URL.createObjectURL(file);
      setLogoPreview(normalizeLogoUrl(previewUrl));

      // Get authenticated user (verify with server)
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Not authenticated");
      }

      // Get session for access token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Not authenticated - no access token");
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
      setErrorDialog({
        open: true,
        title: "Upload Failed",
        message:
          err instanceof Error
            ? err.message
            : "Failed to upload logo. Please try again.",
      });
      // Reset preview on error
      setLogoPreview(normalizeLogoUrl(settings.logo_url));
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setUploadingLogo(false);
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
      setErrorDialog({
        open: true,
        title: "Delete Failed",
        message: "Failed to delete logo. Please try again.",
      });
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

  const handlePrimaryContactPhoneChange = async (phone: string) => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    log.info("Settings: Updating primary contact phone", { phone });

    const { data, error: updateError } = await supabase.functions.invoke(
      "update-organization-settings",
      {
        body: {
          organization_id: organizationId,
          primary_contact_phone: phone || null,
        },
      }
    );

    if (updateError) {
      log.error("Settings: Failed to update primary contact phone", {
        error: updateError,
      });
      throw updateError;
    }

    if (data?.settings) {
      setSettings((prev) => ({
        ...prev,
        primary_contact_phone: data.settings.primary_contact_phone,
      }));
    }

    log.info("Settings: Primary contact phone updated successfully");
  };

  const handleTogglePredefinedLocations = async (checked: boolean) => {
    if (!organizationId) return;

    try {
      log.info("Settings: Updating predefined locations setting", { checked });

      const { data, error: updateError } = await supabase.functions.invoke(
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

      if (data?.settings) {
        setSettings((prev) => ({
          ...prev,
          use_predefined_locations:
            data.settings.use_predefined_locations ?? true,
        }));
      }

      queryClient.invalidateQueries({
        queryKey: organizationSettingsKey(organizationId),
      });

      log.info("Settings: Predefined locations setting updated successfully");
    } catch (err) {
      log.error("Settings: Failed to update predefined locations setting", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setErrorDialog({
        open: true,
        title: "Update Failed",
        message: "Failed to update setting. Please try again.",
      });
    }
  };

  const handleInvoiceSendImmediatelyChange = async (checked: boolean) => {
    if (!organizationId) return;
    try {
      log.info("Settings: Updating invoice send immediately", { checked });
      const { data, error } = await supabase.functions.invoke(
        "update-organization-settings",
        {
          body: {
            organization_id: organizationId,
            invoice_send_immediately: checked,
          },
        }
      );
      if (error) throw error;
      if (data?.settings) {
        setSettings((prev) => ({
          ...prev,
          invoice_send_immediately:
            data.settings.invoice_send_immediately ?? false,
        }));
      }
      queryClient.invalidateQueries({
        queryKey: organizationSettingsKey(organizationId),
      });
      log.info("Settings: Invoice send immediately updated");
    } catch (err) {
      log.error("Settings: Failed to update invoice send immediately", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setErrorDialog({
        open: true,
        title: "Update Failed",
        message: "Failed to update setting. Please try again.",
      });
    }
  };

  const handleAutoGenerateInvoicesChange = async (checked: boolean) => {
    if (!organizationId) return;
    try {
      log.info("Settings: Updating auto-generate invoices", { checked });
      const { data, error } = await supabase.functions.invoke(
        "update-organization-settings",
        {
          body: {
            organization_id: organizationId,
            auto_generate_invoices_immediately: checked,
          },
        }
      );
      if (error) throw error;
      if (data?.settings) {
        setSettings((prev) => ({
          ...prev,
          auto_generate_invoices_immediately:
            data.settings.auto_generate_invoices_immediately ?? false,
        }));
      }
      queryClient.invalidateQueries({
        queryKey: organizationSettingsKey(organizationId),
      });
      log.info("Settings: Auto-generate invoices updated");
    } catch (err) {
      log.error("Settings: Failed to update auto-generate invoices", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setErrorDialog({
        open: true,
        title: "Update Failed",
        message: "Failed to update setting. Please try again.",
      });
    }
  };

  // Helper function to capitalize first letter of each word (title case)
  const toTitleCase = (str: string): string => {
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Helper function to capitalize state (all caps)
  const toStateCase = (str: string): string => {
    return str.toUpperCase().trim();
  };

  const parseBusinessAddress = (
    address: string
  ): {
    street: string;
    city: string;
    state: string;
    postcode: string;
  } => {
    // Try to parse format: "Street, City, State Postcode"
    const parts = address.split(",").map((p) => p.trim());
    if (parts.length >= 2) {
      const street = parts[0];
      // Last part should contain state and postcode (e.g., "NSW 2000")
      const lastPart = parts[parts.length - 1];
      const statePostcodeMatch = lastPart.match(/^(.+?)\s+(\d{4})$/);

      if (statePostcodeMatch) {
        // Format: "Street, City, State Postcode" or "Street, City, Suburb, State Postcode"
        const state = statePostcodeMatch[1].trim();
        const postcode = statePostcodeMatch[2];
        // City is everything between street and the last part
        const city =
          parts.length > 2 ? parts.slice(1, -1).join(", ") : parts[1];

        return {
          street: toTitleCase(street),
          city: toTitleCase(city),
          state: toStateCase(state),
          postcode,
        };
      }

      // If no postcode match, try to parse as "Street, City, State" or "Street, City"
      if (parts.length >= 3) {
        return {
          street: toTitleCase(parts[0]),
          city: toTitleCase(parts[1]),
          state: toStateCase(parts[2]),
          postcode: "",
        };
      }

      // Two parts: assume "Street, City"
      return {
        street: toTitleCase(parts[0]),
        city: toTitleCase(parts[1]),
        state: "",
        postcode: "",
      };
    }
    // If format doesn't match, return as street address
    return {
      street: toTitleCase(address),
      city: "",
      state: "",
      postcode: "",
    };
  };

  // Helper function to format address fields into a single string
  const formatBusinessAddress = (fields: {
    street: string;
    city: string;
    state: string;
    postcode: string;
  }): string => {
    // Apply capitalization before formatting
    const capitalizedFields = {
      street: toTitleCase(fields.street),
      city: toTitleCase(fields.city),
      state: toStateCase(fields.state),
      postcode: fields.postcode,
    };

    const parts = [
      capitalizedFields.street,
      capitalizedFields.city,
      capitalizedFields.state && capitalizedFields.postcode
        ? `${capitalizedFields.state} ${capitalizedFields.postcode}`
        : capitalizedFields.state || capitalizedFields.postcode,
    ].filter(Boolean);
    return parts.join(", ") || "";
  };

  const handleBusinessAddressChange = async () => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const formattedAddress = formatBusinessAddress(businessAddressFields);

    log.info("Settings: Updating business address", {
      address: formattedAddress,
      fields: businessAddressFields,
    });

    const { data, error: updateError } = await supabase.functions.invoke(
      "update-organization-settings",
      {
        body: {
          organization_id: organizationId,
          business_address: formattedAddress || null,
        },
      }
    );

    if (updateError) {
      log.error("Settings: Failed to update business address", {
        error: updateError,
      });
      throw updateError;
    }

    if (data?.settings) {
      setSettings((prev) => ({
        ...prev,
        business_address: data.settings.business_address,
      }));
    }

    log.info("Settings: Business address updated successfully");
  };

  const handleConnectStripe = async () => {
    // TODO: Implement Stripe OAuth connection
    // 1. Call edge function to initiate Stripe OAuth flow
    // 2. Redirect user to Stripe authorization page
    // 3. Handle OAuth callback
    // 4. Store stripe_account_id in organization
    setErrorDialog({
      open: true,
      title: "Coming Soon",
      message: "Stripe connection will be implemented soon.",
    });
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
      setErrorDialog({
        open: true,
        title: "Disconnection Failed",
        message: "Failed to disconnect Stripe account. Please try again.",
      });
    }
  };

  const handleCurrencyChange = async (currency: SupportedCurrency) => {
    if (!organizationId) return;

    // Map currency to appropriate locale
    const currencyLocaleMap: Record<SupportedCurrency, string> = {
      AUD: "en-AU",
      USD: "en-US",
      GBP: "en-GB",
      EUR: "de-DE",
      CAD: "en-CA",
      NZD: "en-NZ",
    };

    const locale = currencyLocaleMap[currency];

    try {
      log.info("Settings: Updating currency", { currency, locale });

      const { data, error: updateError } = await supabase.functions.invoke(
        "update-organization-settings",
        {
          body: {
            organization_id: organizationId,
            currency,
            locale,
          },
        }
      );

      if (updateError) {
        throw updateError;
      }

      if (data?.settings) {
        setSettings((prev) => ({
          ...prev,
          currency: data.settings.currency,
          locale: data.settings.locale,
        }));
      }

      log.info("Settings: Currency updated successfully", { currency });
    } catch (err) {
      log.error("Settings: Failed to update currency", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setErrorDialog({
        open: true,
        title: "Update Failed",
        message: "Failed to update currency. Please try again.",
      });
    }
  };

  const handleShowBankTransferChange = (enabled: boolean) => {
    // Just update local state - will be saved with other bank transfer settings
    setSettings((prev) => ({
      ...prev,
      show_bank_transfer_on_invoices: enabled,
    }));
  };

  // Save all bank transfer settings together
  const handleSaveBankTransferSettings = async () => {
    if (!organizationId) return;

    // Validate BSB format if provided
    if (settings.bank_transfer_bsb && settings.bank_transfer_bsb.trim()) {
      const trimmedBsb = settings.bank_transfer_bsb.trim();
      if (!/^\d{3}-\d{3}$/.test(trimmedBsb)) {
        setErrorDialog({
          open: true,
          title: "Validation Error",
          message: "BSB must be in format XXX-XXX (e.g., 123-456)",
        });
        return;
      }
    }

    // Validate account number if provided
    if (
      settings.bank_transfer_account_number &&
      settings.bank_transfer_account_number.trim()
    ) {
      const trimmedAccount = settings.bank_transfer_account_number.trim();
      if (
        !/^\d+$/.test(trimmedAccount) ||
        trimmedAccount.length < 6 ||
        trimmedAccount.length > 10
      ) {
        setErrorDialog({
          open: true,
          title: "Validation Error",
          message: "Account number must be 6-10 digits",
        });
        return;
      }
    }

    setSaving(true);
    try {
      log.info("Settings: Saving bank transfer settings", {
        bsb: settings.bank_transfer_bsb,
        accountNumber: settings.bank_transfer_account_number ? "***" : null,
        accountName: settings.bank_transfer_account_name,
        showOnInvoices: settings.show_bank_transfer_on_invoices,
      });

      const { data, error: updateError } = await supabase.functions.invoke(
        "update-organization-settings",
        {
          body: {
            organization_id: organizationId,
            bank_transfer_bsb: settings.bank_transfer_bsb?.trim() || null,
            bank_transfer_account_number:
              settings.bank_transfer_account_number?.trim() || null,
            bank_transfer_account_name:
              settings.bank_transfer_account_name?.trim() || null,
            show_bank_transfer_on_invoices:
              settings.show_bank_transfer_on_invoices,
          },
        }
      );

      if (updateError) {
        log.error("Settings: Failed to save bank transfer settings", {
          error: updateError,
        });
        throw updateError;
      }

      if (data?.settings) {
        setSettings((prev) => ({
          ...prev,
          bank_transfer_bsb: data.settings.bank_transfer_bsb,
          bank_transfer_account_number:
            data.settings.bank_transfer_account_number,
          bank_transfer_account_name: data.settings.bank_transfer_account_name,
          show_bank_transfer_on_invoices:
            data.settings.show_bank_transfer_on_invoices,
        }));

        // Update initial settings to mark as saved
        if (initialSettings) {
          setInitialSettings({
            ...initialSettings,
            bank_transfer_bsb: data.settings.bank_transfer_bsb,
            bank_transfer_account_number:
              data.settings.bank_transfer_account_number,
            bank_transfer_account_name:
              data.settings.bank_transfer_account_name,
            show_bank_transfer_on_invoices:
              data.settings.show_bank_transfer_on_invoices,
          });
        }
        setHasUnsavedChanges(false);
      }

      log.info("Settings: Bank transfer settings saved successfully");
    } catch (err) {
      log.error("Settings: Failed to save bank transfer settings", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setErrorDialog({
        open: true,
        title: "Save Failed",
        message:
          err instanceof Error
            ? err.message
            : "Failed to save bank transfer settings. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGstSettings = async () => {
    if (!organizationId) return;

    const rate = settings.gst_rate_percent;
    if (typeof rate !== "number" || isNaN(rate) || rate < 0 || rate > 100) {
      setErrorDialog({
        open: true,
        title: "Validation Error",
        message: "GST rate must be between 0 and 100",
      });
      return;
    }

    setSaving(true);
    try {
      log.info("Settings: Saving GST settings", {
        gst_registered: settings.gst_registered,
        gst_inclusive: settings.gst_inclusive,
        gst_rate_percent: settings.gst_rate_percent,
      });

      const { data, error: updateError } = await supabase.functions.invoke(
        "update-organization-settings",
        {
          body: {
            organization_id: organizationId,
            gst_registered: settings.gst_registered,
            gst_inclusive: settings.gst_inclusive,
            gst_rate_percent: settings.gst_rate_percent,
          },
        }
      );

      if (updateError) throw updateError;

      if (data?.settings) {
        setSettings((prev) => ({
          ...prev,
          gst_registered: data.settings.gst_registered,
          gst_inclusive: data.settings.gst_inclusive,
          gst_rate_percent: data.settings.gst_rate_percent,
        }));
        if (initialSettings) {
          setInitialSettings({
            ...initialSettings,
            gst_registered: data.settings.gst_registered,
            gst_inclusive: data.settings.gst_inclusive,
            gst_rate_percent: data.settings.gst_rate_percent,
          });
        }
      }
      queryClient.invalidateQueries({
        queryKey: organizationSettingsKey(organizationId),
      });
      log.info("Settings: GST settings saved successfully");
    } catch (err) {
      log.error("Settings: Failed to save GST settings", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setErrorDialog({
        open: true,
        title: "Save Failed",
        message:
          err instanceof Error
            ? err.message
            : "Failed to save GST settings. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasGstUnsaved =
    initialSettings &&
    (settings.gst_registered !== initialSettings.gst_registered ||
      settings.gst_inclusive !== initialSettings.gst_inclusive ||
      settings.gst_rate_percent !== initialSettings.gst_rate_percent);

  useEffect(() => {
    if (organizationId) {
      fetchSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  if (orgLoading) {
    return (
      <>
        <PageHeaderSkeleton />
        <div className="space-y-6">
          <div className="h-10 w-64 bg-muted animate-pulse rounded-md" />
          <FormSkeleton fields={6} />
        </div>
      </>
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
          Configure global organization settings. Feature-specific settings are
          available on their respective pages.
        </p>
      </div>

      <Tabs
        defaultValue={
          ["organization", "invoicing", "payment", "features"].includes(
            searchParams.get("tab") || ""
          )
            ? searchParams.get("tab")!
            : "organization"
        }
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="invoicing">Invoicing</TabsTrigger>
          <TabsTrigger value="payment">Payments</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
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
                      accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="cursor-pointer disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {uploadingLogo
                        ? "Uploading logo..."
                        : "Upload a logo (max 5MB, JPEG, PNG, WebP, GIF, or SVG)"}
                    </p>
                  </div>
                </div>
              </div>

              <TooltipProvider>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="primary-contact-email">
                      Primary Contact Email
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          This email is used for business communications and
                          notifications. It does not change your sign-in email
                          address.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <AutoSaveInput
                    id="primary-contact-email"
                    type="email"
                    value={settings.primary_contact_email}
                    onSave={handlePrimaryContactEmailChange}
                    placeholder="Enter primary contact email"
                    description="The primary business contact email for account communications and notifications."
                  />
                </div>
              </TooltipProvider>

              <TooltipProvider>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="primary-contact-phone">
                      Primary Contact Phone
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          This phone number is displayed on invoices for
                          customer contact purposes.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <AutoSaveInput
                    id="primary-contact-phone"
                    type="tel"
                    value={settings.primary_contact_phone}
                    onSave={handlePrimaryContactPhoneChange}
                    placeholder="Enter primary contact phone (e.g., 0412 345 678)"
                    description="The primary business contact phone number displayed on invoices."
                  />
                </div>
              </TooltipProvider>

              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">
                    Business Address
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your business physical address for invoices and official
                    documents.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="business-address-street">
                      Street Address
                    </Label>
                    <Input
                      id="business-address-street"
                      value={businessAddressFields.street}
                      onChange={(e) =>
                        setBusinessAddressFields((prev) => ({
                          ...prev,
                          street: e.target.value,
                        }))
                      }
                      onBlur={(e) => {
                        // Apply title case on blur
                        const capitalized = toTitleCase(e.target.value);
                        if (capitalized !== e.target.value) {
                          setBusinessAddressFields((prev) => ({
                            ...prev,
                            street: capitalized,
                          }));
                        }
                        // Then save the address
                        handleBusinessAddressChange();
                      }}
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="business-address-city">City</Label>
                      <Input
                        id="business-address-city"
                        value={businessAddressFields.city}
                        onChange={(e) =>
                          setBusinessAddressFields((prev) => ({
                            ...prev,
                            city: e.target.value,
                          }))
                        }
                        onBlur={(e) => {
                          // Apply title case on blur
                          const capitalized = toTitleCase(e.target.value);
                          if (capitalized !== e.target.value) {
                            setBusinessAddressFields((prev) => ({
                              ...prev,
                              city: capitalized,
                            }));
                          }
                          // Then save the address
                          handleBusinessAddressChange();
                        }}
                        placeholder="Sydney"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="business-address-state">State</Label>
                      <Input
                        id="business-address-state"
                        value={businessAddressFields.state}
                        onChange={(e) =>
                          setBusinessAddressFields((prev) => ({
                            ...prev,
                            state: e.target.value.toUpperCase(),
                          }))
                        }
                        onBlur={handleBusinessAddressChange}
                        placeholder="NSW"
                        maxLength={3}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="business-address-postcode">Postcode</Label>
                    <Input
                      id="business-address-postcode"
                      value={businessAddressFields.postcode}
                      onChange={(e) =>
                        setBusinessAddressFields((prev) => ({
                          ...prev,
                          postcode: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                      onBlur={handleBusinessAddressChange}
                      placeholder="2000"
                      maxLength={4}
                      inputMode="numeric"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={settings.currency}
                  onValueChange={(value) =>
                    handleCurrencyChange(value as SupportedCurrency)
                  }
                >
                  <SelectTrigger id="currency" className="w-full max-w-xs">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Select currency" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUD">
                      <span className="font-medium">AUD</span>
                      <span className="text-muted-foreground ml-2">
                        Australian Dollar
                      </span>
                    </SelectItem>
                    <SelectItem value="USD">
                      <span className="font-medium">USD</span>
                      <span className="text-muted-foreground ml-2">
                        US Dollar
                      </span>
                    </SelectItem>
                    <SelectItem value="GBP">
                      <span className="font-medium">GBP</span>
                      <span className="text-muted-foreground ml-2">
                        British Pound
                      </span>
                    </SelectItem>
                    <SelectItem value="EUR">
                      <span className="font-medium">EUR</span>
                      <span className="text-muted-foreground ml-2">Euro</span>
                    </SelectItem>
                    <SelectItem value="CAD">
                      <span className="font-medium">CAD</span>
                      <span className="text-muted-foreground ml-2">
                        Canadian Dollar
                      </span>
                    </SelectItem>
                    <SelectItem value="NZD">
                      <span className="font-medium">NZD</span>
                      <span className="text-muted-foreground ml-2">
                        New Zealand Dollar
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Default currency for pricing and invoicing. This affects how
                  prices are displayed throughout the application.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoicing" className="space-y-6">
          {/* Sending & behavior */}
          <Card>
            <CardHeader>
              <CardTitle>Sending &amp; behavior</CardTitle>
              <CardDescription>
                When to send invoices and when payment is due
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
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
                  className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="auto-generate-invoices">
                    Auto-Generate Invoices
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create invoices in pending review when jobs are
                    completed. Location-specific auto-generate takes precedence.
                  </p>
                </div>
                <Switch
                  id="auto-generate-invoices"
                  checked={settings.auto_generate_invoices_immediately}
                  onCheckedChange={handleAutoGenerateInvoicesChange}
                  className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default-invoice-due-days">
                  Default Invoice Due Days
                </Label>
                <p className="text-sm text-muted-foreground">
                  Number of days after invoice creation when payment is due
                </p>
                <div className="flex items-center gap-3">
                  <Input
                    id="default-invoice-due-days"
                    type="number"
                    min={1}
                    max={365}
                    value={settings.default_invoice_due_days}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value >= 1 && value <= 365) {
                        setSettings((prev) => ({
                          ...prev,
                          default_invoice_due_days: value,
                        }));
                      }
                    }}
                    onBlur={async (e) => {
                      const value = parseInt(e.target.value, 10);
                      if (isNaN(value) || value < 1 || value > 365) return;
                      try {
                        const { error } = await supabase.functions.invoke(
                          "update-organization-settings",
                          {
                            body: {
                              organization_id: organizationId,
                              default_invoice_due_days: value,
                            },
                          }
                        );
                        if (error) throw error;
                        queryClient.invalidateQueries({
                          queryKey: organizationSettingsKey(organizationId),
                        });
                      } catch (err) {
                        log.error("Failed to update invoice due days", {
                          error: err,
                        });
                        setErrorDialog({
                          open: true,
                          title: "Update Failed",
                          message:
                            "Failed to update invoice due days. Please try again.",
                        });
                      }
                    }}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax / GST */}
          <Card>
            <CardHeader>
              <CardTitle>Tax / GST</CardTitle>
              <CardDescription>
                Configure GST for Australian tax invoices. If you&apos;re not
                GST-registered (e.g. under $75k), leave GST registered off.
                Invoices will show &quot;Invoice&quot; and no GST. If
                registered, we use &quot;Tax Invoice&quot; and show a GST
                breakdown when the total is $82.50 or more (AUD).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">
                    GST registered
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Your business is registered for GST (e.g. turnover $75k+)
                  </p>
                </div>
                <Switch
                  checked={settings.gst_registered}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, gst_registered: checked }))
                  }
                  className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
                />
              </div>

              {settings.gst_registered && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base font-semibold">
                        Prices include GST
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Your prices in Pricing are GST-inclusive
                      </p>
                    </div>
                    <Switch
                      checked={settings.gst_inclusive}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({
                          ...prev,
                          gst_inclusive: checked,
                        }))
                      }
                      className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gst-rate-percent-inv">GST rate (%)</Label>
                    <Input
                      id="gst-rate-percent-inv"
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={settings.gst_rate_percent}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v >= 0 && v <= 100) {
                          setSettings((prev) => ({
                            ...prev,
                            gst_rate_percent: v,
                          }));
                        }
                      }}
                      className="max-w-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Default 10% for Australia
                    </p>
                  </div>
                </>
              )}

              {hasGstUnsaved && (
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={handleSaveGstSettings}
                    disabled={saving}
                    className="cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save GST Settings
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice template */}
          <InvoiceTemplateSettings organizationId={organizationId} />

          {/* Bank transfer on invoices */}
          <Card>
            <CardHeader>
              <CardTitle>Bank Transfer on Invoices</CardTitle>
              <CardDescription>
                Add your bank account details to display on invoices for manual
                payment processing. Payments via bank transfer require manual
                status updates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">
                    Show Bank Transfer Details on Invoices
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Display bank transfer details on invoices. Payments via bank
                    transfer will not be automatically tracked and require
                    manual payment status updates.
                  </p>
                </div>
                <Switch
                  checked={settings.show_bank_transfer_on_invoices}
                  onCheckedChange={handleShowBankTransferChange}
                  className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
                />
              </div>

              {settings.show_bank_transfer_on_invoices && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="bank-transfer-bsb-inv">BSB</Label>
                    <Input
                      id="bank-transfer-bsb-inv"
                      value={settings.bank_transfer_bsb || ""}
                      onChange={(e) => {
                        let value = e.target.value;
                        const digits = value.replace(/\D/g, "");
                        if (digits.length <= 3) {
                          value = digits;
                        } else if (digits.length <= 6) {
                          value = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                        } else {
                          value = `${digits.slice(0, 3)}-${digits.slice(3, 6)}`;
                        }
                        setSettings((prev) => ({
                          ...prev,
                          bank_transfer_bsb: value,
                        }));
                      }}
                      placeholder="123-456"
                      maxLength={7}
                      className="max-w-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: XXX-XXX (e.g., 123-456)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank-transfer-account-number-inv">
                      Account Number
                    </Label>
                    <Input
                      id="bank-transfer-account-number-inv"
                      type="text"
                      inputMode="numeric"
                      value={settings.bank_transfer_account_number || ""}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          bank_transfer_account_number: e.target.value.replace(
                            /\D/g,
                            ""
                          ),
                        }))
                      }
                      placeholder="987654321"
                      maxLength={10}
                      className="max-w-xs"
                    />
                    <p className="text-xs text-muted-foreground">6-10 digits</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank-transfer-account-name-inv">
                      Account Name (Optional)
                    </Label>
                    <Input
                      id="bank-transfer-account-name-inv"
                      value={settings.bank_transfer_account_name || ""}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          bank_transfer_account_name: e.target.value,
                        }))
                      }
                      placeholder="Account Holder Name"
                      className="max-w-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Name associated with the bank account
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/50 border border-muted p-3">
                    <p className="text-sm text-muted-foreground">
                      <strong>Note:</strong> Payments via bank transfer will not
                      be automatically tracked. You will need to manually update
                      the payment status when payments are received. Include the
                      invoice number in your payment reference to help match
                      payments.
                    </p>
                  </div>

                  {hasUnsavedChanges && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        You have unsaved changes
                      </p>
                      <Button
                        onClick={handleSaveBankTransferSettings}
                        disabled={saving}
                        className="cursor-pointer"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Bank Transfer Settings
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-6">
          {/* Feature-Specific Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Feature-Specific Settings</CardTitle>
              <CardDescription>
                Configure settings for specific features on their respective
                pages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="predefined-locations"
                      className="text-base font-semibold"
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
                    checked={settings.use_predefined_locations ?? true}
                    onCheckedChange={handleTogglePredefinedLocations}
                    className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
                  />
                </div>
                <Link
                  href="/dashboard/locations"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Manage locations
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Feedback & Rating Settings</p>
                  <p className="text-sm text-muted-foreground">
                    Configure feedback requests and rating system
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/ratings">
                    Go to Ratings
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Mode tab content hidden - feature not currently in use */}
        {/* <TabsContent value="business" className="space-y-6">
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
        </TabsContent> */}

        <TabsContent value="payment" className="space-y-6">
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

      {/* Error Dialog */}
      <AlertDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{errorDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {errorDialog.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() =>
                setErrorDialog({ open: false, title: "", message: "" })
              }
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
