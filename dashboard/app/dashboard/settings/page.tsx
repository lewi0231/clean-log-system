"use client";

import { organizationSettingsKey } from "@/app/query-provider";
import InvoiceTemplateSettings from "@/components/settings/invoice-template-settings";
import { OrgSendingDomainCard } from "@/components/settings/org-sending-domain-card";
import { WorkerPayPeriodSettingsCard } from "@/components/settings/worker-pay-period-settings-card";
import { WorkforceEngagementSettingsCard } from "@/components/settings/workforce-engagement-settings-card";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FormSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton-loaders";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/ui/error-state";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { invokeTypedEdge } from "@/lib/supabase/invoke-edge-function";
import { isSendInvoicesImmediatelyEnabled } from "@/lib/utils";
import { getRatingConfigPreset, RATING_DIMENSION_LABELS } from "@/lib/constants/rating-config";
import { BusinessMode, OrganizationSettings, SupportedCurrency } from "@/lib/types";
import type { RatingConfigType } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";
import { DollarSign, ExternalLink, Upload, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { organizationId, userRole, loading: orgLoading, error: orgError } = useOrganization();
  const { fieldConfigs, loading: fieldConfigsLoading } = useFieldConfigs();
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
    feedback_requests_enabled: true,
    feedback_auto_send: false,
    feedback_request_mode: "internal",
    public_review_url: null,
    feedback_email_subject: null,
    feedback_email_body: null,
    feedback_email_reply_to: null,
    feedback_send_delay_hours: 0,
    auto_generate_invoices_immediately: false,
    bank_transfer_bsb: null,
    bank_transfer_account_number: null,
    bank_transfer_account_name: null,
    show_bank_transfer_on_invoices: true,
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
    edit_window_minutes: 180,
    colleague_confirmation_timeout_hours: 24,
    custom_email_domain_enabled: false,
    worker_payment_cycle_config: null,
    workforce_engagement: "employees",
  });

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });

  const [initialSettings, setInitialSettings] = useState<OrganizationSettings | null>(null);

  const fetchSettings = async () => {
    if (!organizationId) return;

    try {
      log.debug("Settings: Fetching organization settings");

      const data = await invokeTypedEdge("get-organization-settings", {
        organization_id: organizationId,
      });

      if (data?.settings) {
        // Parse business_address if it exists (format: "Street, City, State Postcode")
        const addressParts = data.settings.business_address
          ? parseBusinessAddress(data.settings.business_address)
          : { street: "", city: "", state: "", postcode: "" };

        setBusinessAddressFields(addressParts);

        setSettings({
          name: data.settings.name ?? "",
          use_predefined_locations: data.settings.use_predefined_locations ?? true,
          business_mode: data.settings.business_mode ?? "service_based",
          abn: data.settings.abn ?? null,
          logo_url: data.settings.logo_url ?? null,
          primary_contact_email: data.settings.primary_contact_email ?? null,
          primary_contact_phone: data.settings.primary_contact_phone ?? null,
          business_address: data.settings.business_address ?? null,
          invoice_send_immediately: data.settings.invoice_send_immediately ?? false,
          feedback_requests_enabled: data.settings.feedback_requests_enabled ?? true,
          feedback_auto_send: data.settings.feedback_auto_send ?? false,
          feedback_request_mode: data.settings.feedback_request_mode ?? "internal",
          public_review_url: data.settings.public_review_url ?? null,
          feedback_email_subject: data.settings.feedback_email_subject ?? null,
          feedback_email_body: data.settings.feedback_email_body ?? null,
          feedback_email_reply_to: data.settings.feedback_email_reply_to ?? null,
          feedback_send_delay_hours: data.settings.feedback_send_delay_hours ?? 0,
          auto_generate_invoices_immediately:
            data.settings.auto_generate_invoices_immediately ?? false,
          bank_transfer_bsb: data.settings.bank_transfer_bsb ?? null,
          bank_transfer_account_number: data.settings.bank_transfer_account_number ?? null,
          bank_transfer_account_name: data.settings.bank_transfer_account_name ?? null,
          show_bank_transfer_on_invoices: data.settings.show_bank_transfer_on_invoices ?? true,
          default_invoice_due_days: data.settings.default_invoice_due_days ?? 30,
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
          default_exclusive_group_label: data.settings.default_exclusive_group_label ?? null,
          edit_window_minutes: data.settings.edit_window_minutes ?? 180,
          colleague_confirmation_timeout_hours:
            data.settings.colleague_confirmation_timeout_hours ?? 24,
          custom_email_domain_enabled: data.settings.custom_email_domain_enabled ?? false,
          worker_payment_cycle_config: data.settings.worker_payment_cycle_config ?? null,
          workforce_engagement: data.settings.workforce_engagement ?? "employees",
        });
        setLogoPreview(normalizeLogoUrl(data.settings.logo_url ?? null));

        // Store initial settings snapshot to track changes
        const initialSnapshot: OrganizationSettings = {
          name: data.settings.name ?? "",
          use_predefined_locations: data.settings.use_predefined_locations ?? true,
          business_mode: data.settings.business_mode ?? "service_based",
          abn: data.settings.abn ?? null,
          logo_url: data.settings.logo_url ?? null,
          primary_contact_email: data.settings.primary_contact_email ?? null,
          primary_contact_phone: data.settings.primary_contact_phone ?? null,
          business_address: data.settings.business_address ?? null,
          invoice_send_immediately: data.settings.invoice_send_immediately ?? false,
          feedback_requests_enabled: data.settings.feedback_requests_enabled ?? true,
          feedback_auto_send: data.settings.feedback_auto_send ?? false,
          feedback_request_mode: data.settings.feedback_request_mode ?? "internal",
          public_review_url: data.settings.public_review_url ?? null,
          feedback_email_subject: data.settings.feedback_email_subject ?? null,
          feedback_email_body: data.settings.feedback_email_body ?? null,
          feedback_email_reply_to: data.settings.feedback_email_reply_to ?? null,
          feedback_send_delay_hours: data.settings.feedback_send_delay_hours ?? 0,
          auto_generate_invoices_immediately:
            data.settings.auto_generate_invoices_immediately ?? false,
          bank_transfer_bsb: data.settings.bank_transfer_bsb ?? null,
          bank_transfer_account_number: data.settings.bank_transfer_account_number ?? null,
          bank_transfer_account_name: data.settings.bank_transfer_account_name ?? null,
          show_bank_transfer_on_invoices: data.settings.show_bank_transfer_on_invoices ?? true,
          default_invoice_due_days: data.settings.default_invoice_due_days ?? 30,
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
          default_exclusive_group_label: data.settings.default_exclusive_group_label ?? null,
          edit_window_minutes: data.settings.edit_window_minutes ?? 180,
          colleague_confirmation_timeout_hours:
            data.settings.colleague_confirmation_timeout_hours ?? 24,
          custom_email_domain_enabled: data.settings.custom_email_domain_enabled ?? false,
          worker_payment_cycle_config: data.settings.worker_payment_cycle_config ?? null,
          workforce_engagement: data.settings.workforce_engagement ?? "employees",
        };
        setInitialSettings(initialSnapshot);
      }
    } catch (err) {
      log.error("Settings: Failed to fetch organization settings", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setErrorDialog({
        open: true,
        title: "Load Failed",
        message:
          err instanceof Error
            ? err.message
            : "Failed to load organization settings. Please try again.",
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

  const _handleBusinessModeChange = async (mode: BusinessMode) => {
    if (!organizationId) return;

    try {
      log.info("Settings: Updating business mode", { mode });

      const data = await invokeTypedEdge("update-organization-settings", {
        organization_id: organizationId,
        business_mode: mode,
      });

      const updated = data.settings;
      if (updated) {
        setSettings((prev) => ({
          ...prev,
          business_mode: updated.business_mode ?? prev.business_mode,
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

    log.info("Settings: Updating organization name", { hasName: !!name.trim() });

    const data = await invokeTypedEdge("update-organization-settings", {
      organization_id: organizationId,
      name,
    });

    const updated = data.settings;
    if (updated) {
      setSettings((prev) => ({
        ...prev,
        name: updated.name ?? prev.name,
      }));
    }

    log.info("Settings: Organization name updated successfully");
  };

  const handleABNChange = async (abn: string) => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    log.info("Settings: Updating ABN", { hasAbn: !!abn.trim() });

    const data = await invokeTypedEdge("update-organization-settings", {
      organization_id: organizationId,
      abn: abn || null,
    });

    const updated = data.settings;
    if (updated) {
      setSettings((prev) => ({
        ...prev,
        abn: updated.abn ?? prev.abn,
      }));
    }

    log.info("Settings: ABN updated successfully");
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !organizationId) {
      // Clear file input if no file selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Validate file type (including SVG)
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

    // Check file extension as fallback (SVG might not have correct MIME type)
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const isValidExtension =
      ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(fileExtension || "") ||
      validTypes.includes(file.type);

    if (!isValidExtension) {
      setErrorDialog({
        open: true,
        title: "Invalid File Type",
        message: "Please upload a valid image file (JPEG, PNG, WebP, GIF, or SVG).",
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
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
        "upload-organization-logo",
        {
          body: {
            file_name: file.name,
            file_type: file.type,
            file_data: base64,
            update_organization: true,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

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
        message: err instanceof Error ? err.message : "Failed to upload logo. Please try again.",
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
      const data = await invokeTypedEdge("update-organization-settings", {
        organization_id: organizationId,
        logo_url: null,
      });

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

    log.info("Settings: Updating primary contact email", {
      hasEmail: !!email.trim(),
    });

    const data = await invokeTypedEdge("update-organization-settings", {
      organization_id: organizationId,
      primary_contact_email: email || null,
    });

    const updated = data.settings;
    if (updated) {
      setSettings((prev) => ({
        ...prev,
        primary_contact_email: updated.primary_contact_email ?? null,
      }));
    }

    queryClient.invalidateQueries({
      queryKey: organizationSettingsKey(organizationId),
    });

    log.info("Settings: Primary contact email updated successfully");
  };

  const handlePrimaryContactPhoneChange = async (phone: string) => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    log.info("Settings: Updating primary contact phone", {
      hasPhone: !!phone.trim(),
    });

    const data = await invokeTypedEdge("update-organization-settings", {
      organization_id: organizationId,
      primary_contact_phone: phone || null,
    });

    const updated = data.settings;
    if (updated) {
      setSettings((prev) => ({
        ...prev,
        primary_contact_phone: updated.primary_contact_phone ?? null,
      }));
    }

    queryClient.invalidateQueries({
      queryKey: organizationSettingsKey(organizationId),
    });

    log.info("Settings: Primary contact phone updated successfully");
  };

  const handleTogglePredefinedLocations = async (checked: boolean) => {
    if (!organizationId) return;

    try {
      log.info("Settings: Updating predefined locations setting", { checked });

      const data = await invokeTypedEdge("update-organization-settings", {
        organization_id: organizationId,
        use_predefined_locations: checked,
      });

      const updated = data.settings;
      if (updated) {
        setSettings((prev) => ({
          ...prev,
          use_predefined_locations: updated.use_predefined_locations ?? true,
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
      const data = await invokeTypedEdge("update-organization-settings", {
        organization_id: organizationId,
        invoice_send_immediately: checked,
      });
      const updated = data.settings;
      if (updated) {
        setSettings((prev) => ({
          ...prev,
          invoice_send_immediately: updated.invoice_send_immediately ?? false,
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
      const data = await invokeTypedEdge("update-organization-settings", {
        organization_id: organizationId,
        auto_generate_invoices_immediately: checked,
      });
      const updated = data.settings;
      if (updated) {
        setSettings((prev) => ({
          ...prev,
          auto_generate_invoices_immediately: updated.auto_generate_invoices_immediately ?? false,
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

  const handleFeedbackEmailSendImmediatelyChange = async (checked: boolean) => {
    if (!organizationId) return;
    try {
      log.info("Settings: Updating feedback email send immediately", {
        checked,
      });
      const data = await invokeTypedEdge("update-organization-settings", {
        organization_id: organizationId,
        feedback_auto_send: checked,
      });
      const updated = data.settings;
      if (updated) {
        setSettings((prev) => ({
          ...prev,
          feedback_auto_send: updated.feedback_auto_send ?? false,
        }));
      }
      queryClient.invalidateQueries({
        queryKey: organizationSettingsKey(organizationId),
      });
      log.info("Settings: Feedback email send immediately updated");
    } catch (err) {
      log.error("Settings: Failed to update feedback email send immediately", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setErrorDialog({
        open: true,
        title: "Update Failed",
        message: "Failed to update setting. Please try again.",
      });
    }
  };

  const handleRatingConfigChange = async (value: string) => {
    const newType = value as RatingConfigType;
    const newConfig = getRatingConfigPreset(newType);
    if (!organizationId) return;
    try {
      log.info("Settings: Updating rating configuration", {
        type: newType,
        dimensions: newConfig.dimensions,
      });
      const data = await invokeTypedEdge("update-organization-settings", {
        organization_id: organizationId,
        rating_config: newConfig,
      });
      const updated = data.settings;
      if (updated) {
        setSettings((prev) => ({
          ...prev,
          rating_config: updated.rating_config ?? {
            type: "single",
            dimensions: ["overall"],
          },
        }));
      }
      queryClient.invalidateQueries({
        queryKey: organizationSettingsKey(organizationId),
      });
      log.info("Settings: Rating configuration updated");
    } catch (err) {
      log.error("Settings: Failed to update rating configuration", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setErrorDialog({
        open: true,
        title: "Update Failed",
        message: "Failed to update setting. Please try again.",
      });
    }
  };

  // GST auto-save handlers
  const handleGstRegisteredChange = async (checked: boolean) => {
    if (!organizationId) return;
    try {
      log.info("Settings: Updating GST registered", { checked });
      const data = await invokeTypedEdge("update-organization-settings", {
        organization_id: organizationId,
        gst_registered: checked,
      });
      const updated = data.settings;
      if (updated) {
        setSettings((prev) => ({
          ...prev,
          gst_registered: updated.gst_registered ?? false,
        }));
        if (initialSettings) {
          setInitialSettings({
            ...initialSettings,
            gst_registered: updated.gst_registered ?? false,
          });
        }
      }
      queryClient.invalidateQueries({
        queryKey: organizationSettingsKey(organizationId),
      });
      log.info("Settings: GST registered updated");
    } catch (err) {
      log.error("Settings: Failed to update GST registered", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setErrorDialog({
        open: true,
        title: "Update Failed",
        message: "Failed to update setting. Please try again.",
      });
    }
  };

  const handleGstInclusiveChange = async (checked: boolean) => {
    if (!organizationId) return;
    try {
      log.info("Settings: Updating GST inclusive", { checked });
      const data = await invokeTypedEdge("update-organization-settings", {
        organization_id: organizationId,
        gst_inclusive: checked,
      });
      const updated = data.settings;
      if (updated) {
        setSettings((prev) => ({
          ...prev,
          gst_inclusive: updated.gst_inclusive ?? true,
        }));
        if (initialSettings) {
          setInitialSettings({
            ...initialSettings,
            gst_inclusive: updated.gst_inclusive ?? true,
          });
        }
      }
      queryClient.invalidateQueries({
        queryKey: organizationSettingsKey(organizationId),
      });
      log.info("Settings: GST inclusive updated");
    } catch (err) {
      log.error("Settings: Failed to update GST inclusive", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setErrorDialog({
        open: true,
        title: "Update Failed",
        message: "Failed to update setting. Please try again.",
      });
    }
  };

  const handleGstRateChange = async (rate: number) => {
    if (!organizationId) return;
    if (typeof rate !== "number" || isNaN(rate) || rate < 0 || rate > 100) {
      setErrorDialog({
        open: true,
        title: "Validation Error",
        message: "GST rate must be between 0 and 100",
      });
      return;
    }
    try {
      log.info("Settings: Updating GST rate", { rate });
      const data = await invokeTypedEdge("update-organization-settings", {
        organization_id: organizationId,
        gst_rate_percent: rate,
      });
      const updated = data.settings;
      if (updated) {
        setSettings((prev) => ({
          ...prev,
          gst_rate_percent: updated.gst_rate_percent ?? 10,
        }));
        if (initialSettings) {
          setInitialSettings({
            ...initialSettings,
            gst_rate_percent: updated.gst_rate_percent ?? 10,
          });
        }
      }
      queryClient.invalidateQueries({
        queryKey: organizationSettingsKey(organizationId),
      });
      log.info("Settings: GST rate updated");
    } catch (err) {
      log.error("Settings: Failed to update GST rate", {
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
        const city = parts.length > 2 ? parts.slice(1, -1).join(", ") : parts[1];

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
      // Never log addresses.
      hasAddress: !!formattedAddress,
      hasStreet: !!businessAddressFields.street.trim(),
      hasCity: !!businessAddressFields.city.trim(),
      hasState: !!businessAddressFields.state.trim(),
      hasPostcode: !!businessAddressFields.postcode.trim(),
    });

    const data = await invokeTypedEdge("update-organization-settings", {
      organization_id: organizationId,
      business_address: formattedAddress || null,
    });

    const updated = data.settings;
    if (updated) {
      setSettings((prev) => ({
        ...prev,
        business_address: updated.business_address ?? prev.business_address,
      }));
    }

    queryClient.invalidateQueries({
      queryKey: organizationSettingsKey(organizationId),
    });

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

      const data = await invokeTypedEdge("update-organization-settings", {
        organization_id: organizationId,
        stripe_account_id: null,
        payment_provider: null,
      });

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

      const data = await invokeTypedEdge("update-organization-settings", {
        organization_id: organizationId,
        currency,
        locale,
      });

      const updated = data.settings;
      if (updated) {
        setSettings((prev) => ({
          ...prev,
          currency: updated.currency ?? prev.currency,
          locale: updated.locale ?? prev.locale,
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

  const applyBankTransferSettings = (updated: OrganizationSettings) => {
    setSettings((prev) => ({
      ...prev,
      bank_transfer_bsb: updated.bank_transfer_bsb ?? null,
      bank_transfer_account_number: updated.bank_transfer_account_number ?? null,
      bank_transfer_account_name: updated.bank_transfer_account_name ?? null,
      show_bank_transfer_on_invoices: updated.show_bank_transfer_on_invoices ?? true,
    }));
    setInitialSettings((init) =>
      init
        ? {
            ...init,
            bank_transfer_bsb: updated.bank_transfer_bsb ?? null,
            bank_transfer_account_number: updated.bank_transfer_account_number ?? null,
            bank_transfer_account_name: updated.bank_transfer_account_name ?? null,
            show_bank_transfer_on_invoices: updated.show_bank_transfer_on_invoices ?? true,
          }
        : init
    );
  };

  const handleShowBankTransferChange = async (enabled: boolean) => {
    if (!organizationId) return;
    const previous = settings.show_bank_transfer_on_invoices;
    setSettings((prev) => ({
      ...prev,
      show_bank_transfer_on_invoices: enabled,
    }));
    try {
      const data = await invokeTypedEdge("update-organization-settings", {
        organization_id: organizationId,
        show_bank_transfer_on_invoices: enabled,
      });
      if (data.settings) applyBankTransferSettings(data.settings);
      toast.success("Bank transfer display updated");
    } catch (err) {
      setSettings((prev) => ({
        ...prev,
        show_bank_transfer_on_invoices: previous,
      }));
      log.error("Settings: Failed to update bank transfer display", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setErrorDialog({
        open: true,
        title: "Update Failed",
        message:
          err instanceof Error
            ? err.message
            : "Failed to update bank transfer display. Please try again.",
      });
    }
  };

  const handleBankTransferBsbSave = async (value: string) => {
    if (!organizationId) return;
    const digits = value.replace(/\D/g, "").slice(0, 6);
    // Incomplete while typing — wait; empty clears the stored value
    if (digits.length > 0 && digits.length < 6) return;
    const trimmed = digits.length === 0 ? null : `${digits.slice(0, 3)}-${digits.slice(3)}`;
    const data = await invokeTypedEdge("update-organization-settings", {
      organization_id: organizationId,
      bank_transfer_bsb: trimmed,
    });
    if (data.settings) applyBankTransferSettings(data.settings);
  };

  const handleBankTransferAccountNumberSave = async (value: string) => {
    if (!organizationId) return;
    const trimmed = value.replace(/\D/g, "").slice(0, 10);
    // Incomplete while typing — wait; empty clears the stored value
    if (trimmed.length > 0 && trimmed.length < 6) return;
    const data = await invokeTypedEdge("update-organization-settings", {
      organization_id: organizationId,
      bank_transfer_account_number: trimmed || null,
    });
    if (data.settings) applyBankTransferSettings(data.settings);
  };

  const handleBankTransferAccountNameSave = async (value: string) => {
    if (!organizationId) return;
    const trimmed = value.trim();
    const data = await invokeTypedEdge("update-organization-settings", {
      organization_id: organizationId,
      bank_transfer_account_name: trimmed || null,
    });
    if (data.settings) applyBankTransferSettings(data.settings);
  };

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
    return <ErrorState message={orgError || "Failed to load organization"} fullScreen />;
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure global organization settings. For more on what each setting does, see{" "}
          <Link href="/dashboard/help" className="font-medium text-primary hover:underline">
            Help & FAQ
          </Link>
          .
        </p>
      </div>

      <Tabs
        defaultValue={
          ["organization", "invoicing", "payment", "features", "email"].includes(
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
          <TabsTrigger value="email">Email</TabsTrigger>
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
            <CardContent className="space-y-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AutoSaveInput
                label="Organization Name"
                value={settings.name}
                onSave={handleOrganizationNameChange}
                placeholder="Enter organization name"
                required
                description="The name of your business as it appears throughout the application"
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
                        unoptimized={process.env.NODE_ENV === "development" ? true : false}
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
              <AutoSaveInput
                label="ABN (Australian Business Number)"
                value={settings.abn}
                onSave={handleABNChange}
                placeholder="Enter ABN (optional)"
                description="Your Australian Business Number for invoicing and business records (optional)"
              />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="primary-contact-phone">Primary Contact Phone</Label>
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
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="primary-contact-email">Primary Contact Email</Label>
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
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={settings.currency}
                  onValueChange={(value) => handleCurrencyChange(value as SupportedCurrency)}
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
                      <span className="text-muted-foreground ml-2">Australian Dollar</span>
                    </SelectItem>
                    <SelectItem value="USD">
                      <span className="font-medium">USD</span>
                      <span className="text-muted-foreground ml-2">US Dollar</span>
                    </SelectItem>
                    <SelectItem value="GBP">
                      <span className="font-medium">GBP</span>
                      <span className="text-muted-foreground ml-2">British Pound</span>
                    </SelectItem>
                    <SelectItem value="EUR">
                      <span className="font-medium">EUR</span>
                      <span className="text-muted-foreground ml-2">Euro</span>
                    </SelectItem>
                    <SelectItem value="CAD">
                      <span className="font-medium">CAD</span>
                      <span className="text-muted-foreground ml-2">Canadian Dollar</span>
                    </SelectItem>
                    <SelectItem value="NZD">
                      <span className="font-medium">NZD</span>
                      <span className="text-muted-foreground ml-2">New Zealand Dollar</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Default currency for pricing and invoicing. This affects how prices are displayed
                  throughout the application.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">Business Address</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your business physical address for invoices and official documents.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="business-address-street">Street Address</Label>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoicing" className="space-y-6">
          {/* Sending & behavior */}
          <Card>
            <CardHeader>
              <CardTitle>Sending &amp; behavior</CardTitle>
              <CardDescription>When to send invoices and when payment is due</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isSendInvoicesImmediatelyEnabled() && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="invoice-send-immediately">Send Invoices Immediately</Label>
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
              )}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="auto-generate-invoices">Auto-Generate Invoices</Label>
                  <p className="text-sm text-muted-foreground">
                    Create a draft invoice as soon as a job is completed (for review before
                    sending). Location hierarchy can instead use a scheduled batch for specific
                    company groups; when that schedule is enabled, it overrides this immediate
                    setting for those locations.
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
                <Label htmlFor="default-invoice-due-days">Default Invoice Due Days</Label>
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
                        await invokeTypedEdge("update-organization-settings", {
                          organization_id: organizationId,
                          default_invoice_due_days: value,
                        });
                        queryClient.invalidateQueries({
                          queryKey: organizationSettingsKey(organizationId),
                        });
                      } catch (err) {
                        log.error("Failed to update invoice due days", {
                          error: err instanceof Error ? err.message : err,
                        });
                        setErrorDialog({
                          open: true,
                          title: "Update Failed",
                          message: "Failed to update invoice due days. Please try again.",
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
          <Card id="tax-gst">
            <CardHeader>
              <CardTitle>Tax / GST</CardTitle>
              <CardDescription>
                Configure GST for Australian tax invoices. If you&apos;re not GST-registered (e.g.
                under $75k), leave GST registered off. Invoices will show &quot;Invoice&quot; and no
                GST. If registered, we use &quot;Tax Invoice&quot; and show a GST breakdown when the
                total is $82.50 or more (AUD).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">GST registered</Label>
                  <p className="text-sm text-muted-foreground">
                    Your business is registered for GST (e.g. turnover $75k+)
                  </p>
                </div>
                <Switch
                  checked={settings.gst_registered}
                  onCheckedChange={handleGstRegisteredChange}
                  className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
                />
              </div>

              {settings.gst_registered && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base font-semibold">Prices include GST</Label>
                      <p className="text-sm text-muted-foreground">
                        {settings.gst_inclusive
                          ? "On (recommended for most AU businesses): amounts in Pricing already include GST. Invoices show GST as part of that total — the invoice total matches your price."
                          : "Off: amounts in Pricing are exclusive of GST. GST is added on top when creating invoices."}
                      </p>
                    </div>
                    <Switch
                      checked={settings.gst_inclusive}
                      onCheckedChange={handleGstInclusiveChange}
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
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v >= 0 && v <= 100) {
                          handleGstRateChange(v);
                        }
                      }}
                      className="max-w-xs"
                    />
                    <p className="text-xs text-muted-foreground">Default 10% for Australia</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Invoice template */}
          <InvoiceTemplateSettings
            organizationId={organizationId}
            fieldConfigs={fieldConfigs}
            fieldConfigsLoading={fieldConfigsLoading}
          />
        </TabsContent>

        <TabsContent value="email" className="space-y-6">
          <OrgSendingDomainCard
            organizationId={organizationId}
            isAdmin={userRole === "admin"}
            entitled={settings.custom_email_domain_enabled}
            organizationUserRole={userRole}
          />
        </TabsContent>

        <TabsContent value="features" className="space-y-6">
          {/* Feature-Specific Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Feature-Specific Settings</CardTitle>
              <CardDescription>
                Configure settings for specific features on their respective pages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="predefined-locations" className="text-base font-semibold">
                      Customer Locations
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      When enabled, your Customer Locations will appear as selectable options in the
                      mobile app. Workers can choose from your locations when completing jobs. You
                      can still configure custom fields in Mobile Application regardless of this
                      setting.
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
              <Separator />

              {/* Feedback & Rating Settings */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="feedback-auto-send" className="text-base font-semibold">
                      Automatically send feedback requests
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {settings.feedback_auto_send
                        ? "Feedback request emails are queued after a job is completed (after any delay and edit window)"
                        : "Feedback request emails require manual action to send"}
                    </p>
                  </div>
                  <Switch
                    id="feedback-auto-send"
                    checked={settings.feedback_auto_send ?? false}
                    onCheckedChange={handleFeedbackEmailSendImmediatelyChange}
                    className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
                  />
                </div>
                <Link
                  href="/dashboard/ratings"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  View customer ratings
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              <Separator />

              {/* Job Edit Window Settings */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="edit-window-minutes" className="text-base font-semibold">
                    Job Edit Window
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    How long the submitting worker can withdraw a multi-worker job after submission
                    (e.g. if they selected the wrong colleagues). This is separate from the
                    colleague confirmation window below.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Select
                    value={String(settings.edit_window_minutes ?? 180)}
                    onValueChange={async (value) => {
                      const minutes = parseInt(value, 10);
                      const previous = settings.edit_window_minutes ?? 180;
                      setSettings((prev) => ({
                        ...prev,
                        edit_window_minutes: minutes,
                      }));
                      try {
                        await invokeTypedEdge("update-organization-settings", {
                          organization_id: organizationId,
                          edit_window_minutes: minutes,
                        });
                        queryClient.invalidateQueries({
                          queryKey: organizationSettingsKey(organizationId),
                        });
                      } catch (err) {
                        setSettings((prev) => ({
                          ...prev,
                          edit_window_minutes: previous,
                        }));
                        log.error("Failed to update edit window", {
                          error: err instanceof Error ? err.message : err,
                        });
                        setErrorDialog({
                          open: true,
                          title: "Update Failed",
                          message:
                            err instanceof Error
                              ? err.message
                              : "Failed to update edit window setting.",
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="180">3 hours (default)</SelectItem>
                      <SelectItem value="360">6 hours</SelectItem>
                      <SelectItem value="720">12 hours</SelectItem>
                      <SelectItem value="1440">24 hours</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">
                    to withdraw after submission
                  </span>
                </div>
              </div>

              <Separator />

              {/* Colleague Confirmation Timeout */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label
                    htmlFor="colleague-confirmation-timeout"
                    className="text-base font-semibold"
                  >
                    Colleague Confirmation Window
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    How long colleagues have to confirm (or flag) a job before it auto-approves.
                    This is the countdown shown in the mobile app.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Select
                    value={String(settings.colleague_confirmation_timeout_hours ?? 24)}
                    onValueChange={async (value) => {
                      const hours = parseInt(value, 10);
                      const previous = settings.colleague_confirmation_timeout_hours ?? 24;
                      setSettings((prev) => ({
                        ...prev,
                        colleague_confirmation_timeout_hours: hours,
                      }));
                      try {
                        await invokeTypedEdge("update-organization-settings", {
                          organization_id: organizationId,
                          colleague_confirmation_timeout_hours: hours,
                        });
                        queryClient.invalidateQueries({
                          queryKey: organizationSettingsKey(organizationId),
                        });
                      } catch (err) {
                        setSettings((prev) => ({
                          ...prev,
                          colleague_confirmation_timeout_hours: previous,
                        }));
                        log.error("Failed to update confirmation timeout", {
                          error: err instanceof Error ? err.message : err,
                        });
                        setErrorDialog({
                          open: true,
                          title: "Update Failed",
                          message:
                            err instanceof Error
                              ? err.message
                              : "Failed to update colleague confirmation window.",
                        });
                      }
                    }}
                  >
                    <SelectTrigger id="colleague-confirmation-timeout" className="w-[200px]">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="3">3 hours</SelectItem>
                      <SelectItem value="6">6 hours</SelectItem>
                      <SelectItem value="12">12 hours</SelectItem>
                      <SelectItem value="24">24 hours (default)</SelectItem>
                      <SelectItem value="48">48 hours</SelectItem>
                      <SelectItem value="72">72 hours</SelectItem>
                      <SelectItem value="168">1 week</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">until auto-approve</span>
                </div>
              </div>

              <Separator />

              {/* Rating Configuration */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Rating Configuration</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose how customers rate your service. Based on industry best practices.
                  </p>
                </div>
                <RadioGroup
                  value={settings.rating_config?.type ?? "single"}
                  onValueChange={(v) => handleRatingConfigChange(v)}
                >
                  <div className="flex items-start space-x-2 space-y-0 rounded-md border p-4">
                    <RadioGroupItem value="single" id="rating-single" className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="rating-single" className="font-normal cursor-pointer">
                        Single Overall Rating
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Customers provide one overall satisfaction rating (1-5 stars). Simple and
                        quick.
                      </p>
                      <div className="text-xs text-muted-foreground mt-1">
                        Dimensions: Overall Satisfaction
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 space-y-0 rounded-md border p-4">
                    <RadioGroupItem value="three_dimensions" id="rating-three" className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="rating-three" className="font-normal cursor-pointer">
                        Three Dimensions
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Customers rate Service Quality, Communication, and Value for Money.
                        Recommended for most service businesses.
                      </p>
                      <div className="text-xs text-muted-foreground mt-1">
                        Dimensions:{" "}
                        {["quality", "communication", "value"]
                          .map((d) => RATING_DIMENSION_LABELS[d])
                          .join(", ")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 space-y-0 rounded-md border p-4">
                    <RadioGroupItem value="rater" id="rating-rater" className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="rating-rater" className="font-normal cursor-pointer">
                        Full RATER Framework
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Comprehensive 5-dimension rating system: Reliability, Assurance, Tangibles,
                        Empathy, and Responsiveness. Best for detailed feedback analysis.
                      </p>
                      <div className="text-xs text-muted-foreground mt-1">
                        Dimensions:{" "}
                        {["reliability", "assurance", "tangibles", "empathy", "responsiveness"]
                          .map((d) => RATING_DIMENSION_LABELS[d])
                          .join(", ")}
                      </div>
                    </div>
                  </div>
                </RadioGroup>
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
                  _handleBusinessModeChange(value as BusinessMode)
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
          {organizationId && (
            <WorkforceEngagementSettingsCard
              organizationId={organizationId}
              value={settings.workforce_engagement ?? "employees"}
              onApplied={(s) => {
                setSettings((prev) => ({
                  ...prev,
                  workforce_engagement: s.workforce_engagement ?? "employees",
                }));
                setInitialSettings((init) =>
                  init
                    ? {
                        ...init,
                        workforce_engagement: s.workforce_engagement ?? "employees",
                      }
                    : init
                );
              }}
            />
          )}
          {organizationId && (
            <WorkerPayPeriodSettingsCard
              organizationId={organizationId}
              value={settings.worker_payment_cycle_config}
              onApplied={(s) => {
                setSettings((prev) => ({
                  ...prev,
                  worker_payment_cycle_config: s.worker_payment_cycle_config ?? null,
                }));
                setInitialSettings((init) =>
                  init
                    ? {
                        ...init,
                        worker_payment_cycle_config: s.worker_payment_cycle_config ?? null,
                      }
                    : init
                );
              }}
            />
          )}
          {/* Bank transfer – primary payment method until Stripe is enabled */}
          <Card>
            <CardHeader>
              <CardTitle>Bank Transfer</CardTitle>
              <CardDescription>
                Add your bank account details to display on invoices for manual payment processing.
                Changes save automatically. Payments via bank transfer require manual status
                updates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">
                    Show Bank Transfer Details on Invoices
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Display bank transfer details on invoices. Payments via bank transfer will not
                    be automatically tracked and require manual payment status updates.
                  </p>
                </div>
                <Switch
                  checked={settings.show_bank_transfer_on_invoices}
                  onCheckedChange={(checked) => void handleShowBankTransferChange(checked)}
                  className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
                />
              </div>

              {settings.show_bank_transfer_on_invoices && (
                <div className="space-y-4 pt-4 border-t">
                  <AutoSaveInput
                    id="bank-transfer-bsb-pay"
                    label="BSB"
                    value={settings.bank_transfer_bsb}
                    onSave={async (value) => {
                      try {
                        await handleBankTransferBsbSave(value);
                      } catch (err) {
                        setErrorDialog({
                          open: true,
                          title: "Validation Error",
                          message:
                            err instanceof Error
                              ? err.message
                              : "BSB must be in format XXX-XXX (e.g., 123-456)",
                        });
                        throw err;
                      }
                    }}
                    normalizeValue={(val) => {
                      const digits = val.replace(/\D/g, "").slice(0, 6);
                      if (digits.length <= 3) return digits;
                      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
                    }}
                    placeholder="123-456"
                    maxLength={7}
                    className="max-w-xs"
                    description="Format: XXX-XXX (e.g., 123-456)"
                  />

                  <AutoSaveInput
                    id="bank-transfer-account-number-pay"
                    label="Account Number"
                    type="text"
                    inputMode="numeric"
                    value={settings.bank_transfer_account_number}
                    onSave={async (value) => {
                      try {
                        await handleBankTransferAccountNumberSave(value);
                      } catch (err) {
                        setErrorDialog({
                          open: true,
                          title: "Validation Error",
                          message:
                            err instanceof Error
                              ? err.message
                              : "Account number must be 6-10 digits",
                        });
                        throw err;
                      }
                    }}
                    normalizeValue={(val) => val.replace(/\D/g, "").slice(0, 10)}
                    placeholder="987654321"
                    maxLength={10}
                    className="max-w-xs"
                    description="6-10 digits"
                  />

                  <AutoSaveInput
                    id="bank-transfer-account-name-pay"
                    label="Account Name (Optional)"
                    value={settings.bank_transfer_account_name}
                    onSave={handleBankTransferAccountNameSave}
                    placeholder="Account Holder Name"
                    className="max-w-xs"
                    description="Name associated with the bank account"
                  />

                  <div className="rounded-lg bg-muted/50 border border-muted p-3">
                    <p className="text-sm text-muted-foreground">
                      <strong>Note:</strong> Payments via bank transfer will not be automatically
                      tracked. You will need to manually update the payment status when payments are
                      received. Include the invoice number in your payment reference to help match
                      payments.
                    </p>
                  </div>
                </div>
              )}
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
                      <span className="text-sm text-muted-foreground">Connected</span>
                      <Button variant="outline" size="sm" onClick={handleDisconnectStripe}>
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" onClick={handleConnectStripe} disabled={true}>
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
                    <p className="text-muted-foreground font-mono">{settings.stripe_account_id}</p>
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
            <AlertDialogDescription>{errorDialog.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setErrorDialog({ open: false, title: "", message: "" })}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
