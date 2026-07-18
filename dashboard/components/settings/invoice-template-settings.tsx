"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { FormSkeleton } from "@/components/ui/skeleton-loaders";
import { Switch } from "@/components/ui/switch";
import type { FieldConfig } from "@clean-log/shared/types";
import { useInvoiceTemplateConfig } from "@/hooks/use-invoice-template-config";
import { useLocations } from "@/hooks/use-locations";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import {
  DEFAULT_BILLING_ADDRESS_CONFIG,
  DEFAULT_EMAIL_RECIPIENT_CONFIG,
  DEFAULT_INVOICE_TITLE,
  DEFAULT_LINE_ITEM_DISPLAY,
  DEFAULT_SERVICE_ADDRESS_CONFIG,
} from "@/lib/constants/invoice-template-defaults";
import type {
  BillingAddressConfig,
  InvoiceEmailRecipientConfig,
  LineItemDisplayConfig,
  ServiceAddressConfig,
} from "@/lib/types";
import { log } from "@/lib/logger";
import { normalizeEmailRecipientConfigOrDefault } from "@/lib/utils/normalize-email-recipient-config";
import { validateInvoiceTemplateConfig } from "@/lib/validations/invoice-template";
import { AlertCircle, Eye, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface InvoiceTemplateSettingsProps {
  /** Optional for backward compatibility; org is resolved via useOrganization in child hooks. */
  organizationId?: string | null;
  /** Field configs from the page (avoids useFieldConfigs in nested components). */
  fieldConfigs: FieldConfig[];
  fieldConfigsLoading: boolean;
}

export default function InvoiceTemplateSettings(
  props?: InvoiceTemplateSettingsProps
): React.ReactElement {
  const {
    config,
    loading: configLoading,
    updateConfig,
    error: configError,
  } = useInvoiceTemplateConfig();
  const fieldConfigs = props?.fieldConfigs ?? [];
  const fieldConfigsLoading = props?.fieldConfigsLoading ?? false;
  const { locations, loading: locationsLoading } = useLocations();
  const { settings: orgSettings } = useOrganizationSettings();
  const hasLocations = locations && locations.length > 0;
  const usePredefinedLocations = orgSettings?.use_predefined_locations ?? true;
  const [showPreview, setShowPreview] = useState(false);

  // Track saving state per-section for visual feedback
  const [savingSection, setSavingSection] = useState<string | null>(null);

  // Helper to normalize logo URL for display
  const normalizeLogoUrl = (url: string | null): string | null => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    // Assume it's a Supabase storage path
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return `${supabaseUrl}/storage/v1/object/public/${url}`;
  };
  const [validationErrors, setValidationErrors] = useState<Partial<Record<string, string>>>({});

  // Local state for form (invoice_title, show_logo, show_abn are no longer user-editable:
  // title is derived from GST; logo/ABN always shown when present)
  const [serviceAddressConfig, setServiceAddressConfig] = useState<ServiceAddressConfig>(
    DEFAULT_SERVICE_ADDRESS_CONFIG
  );
  const [billingAddressConfig, setBillingAddressConfig] = useState<BillingAddressConfig>(
    DEFAULT_BILLING_ADDRESS_CONFIG
  );
  const [lineItemDisplay, setLineItemDisplay] =
    useState<LineItemDisplayConfig>(DEFAULT_LINE_ITEM_DISPLAY);
  const [emailRecipientConfig, setEmailRecipientConfig] = useState<InvoiceEmailRecipientConfig>(
    DEFAULT_EMAIL_RECIPIENT_CONFIG
  );

  // Debounce ref for text inputs (description_format)
  const descriptionFormatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize form from config
  useEffect(() => {
    if (config) {
      const legacyBillToFields = config.bill_to_fields || [];
      const existingServiceConfig = config.service_address_config || DEFAULT_SERVICE_ADDRESS_CONFIG;
      const service = {
        ...existingServiceConfig,
        form_fields: existingServiceConfig.form_fields || legacyBillToFields,
      };
      const billing = config.billing_address_config || DEFAULT_BILLING_ADDRESS_CONFIG;
      const lineItem = config.line_item_display || DEFAULT_LINE_ITEM_DISPLAY;
      const email = normalizeEmailRecipientConfigOrDefault(
        config.email_recipient_config as InvoiceEmailRecipientConfig | null,
        DEFAULT_EMAIL_RECIPIENT_CONFIG
      );

      setServiceAddressConfig(service);
      setBillingAddressConfig(billing);
      setLineItemDisplay(lineItem);
      setEmailRecipientConfig(email);
    }
  }, [config]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (descriptionFormatTimeoutRef.current) {
        clearTimeout(descriptionFormatTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Auto-save: validates and saves the current config immediately.
   * Each control change calls this with the updated state.
   */
  const saveConfig = useCallback(
    async (
      updates: {
        serviceAddressConfig?: ServiceAddressConfig;
        billingAddressConfig?: BillingAddressConfig;
        lineItemDisplay?: LineItemDisplayConfig;
        emailRecipientConfig?: InvoiceEmailRecipientConfig;
      },
      section: string
    ) => {
      if (!config) return;

      const configToSave = {
        invoice_title: DEFAULT_INVOICE_TITLE,
        show_logo: true,
        show_abn: true,
        service_address_config: updates.serviceAddressConfig ?? serviceAddressConfig,
        billing_address_config: updates.billingAddressConfig ?? billingAddressConfig,
        email_recipient_config: {
          ...(updates.emailRecipientConfig ?? emailRecipientConfig),
          default_email: null,
        },
        line_item_display: updates.lineItemDisplay ?? lineItemDisplay,
      };

      const validation = validateInvoiceTemplateConfig(configToSave);

      if (!validation.success) {
        setValidationErrors(validation.errors || {});
        return;
      }

      // Clear validation errors on valid config
      setValidationErrors({});

      try {
        setSavingSection(section);
        await updateConfig(configToSave);
      } catch (err) {
        log.error("Failed to save invoice template config:", err);
        // Could show a toast here, but for now just log
      } finally {
        setSavingSection(null);
      }
    },
    [
      config,
      serviceAddressConfig,
      billingAddressConfig,
      lineItemDisplay,
      emailRecipientConfig,
      updateConfig,
    ]
  );

  // Auto-save handlers for each control type
  const handleServiceAddressSourceChange = (value: "auto" | "location" | "form_fields") => {
    const updated = { ...serviceAddressConfig, source: value };
    setServiceAddressConfig(updated);
    saveConfig({ serviceAddressConfig: updated }, "service-source");
  };

  const handleLocationFieldToggle = (
    field: "name" | "email" | "address" | "contact_person" | "phone",
    checked: boolean
  ) => {
    const currentFields = serviceAddressConfig.location_fields || [];
    const updated = {
      ...serviceAddressConfig,
      location_fields: checked
        ? [...currentFields, field]
        : currentFields.filter((f) => f !== field),
    };
    setServiceAddressConfig(updated);
    saveConfig({ serviceAddressConfig: updated }, "location-fields");
  };

  const handleAddServiceAddressField = (fieldName: string) => {
    if (fieldName && !serviceAddressConfig.form_fields?.includes(fieldName)) {
      const updated = {
        ...serviceAddressConfig,
        form_fields: [...(serviceAddressConfig.form_fields || []), fieldName],
      };
      setServiceAddressConfig(updated);
      saveConfig({ serviceAddressConfig: updated }, "form-fields");
    }
  };

  const handleRemoveServiceAddressField = (fieldName: string) => {
    const updated = {
      ...serviceAddressConfig,
      form_fields: (serviceAddressConfig.form_fields || []).filter((f) => f !== fieldName),
    };
    setServiceAddressConfig(updated);
    saveConfig({ serviceAddressConfig: updated }, "form-fields");
  };

  const handleBillingAddressEnabledChange = (checked: boolean) => {
    const updated = { ...billingAddressConfig, enabled: checked };
    setBillingAddressConfig(updated);
    saveConfig({ billingAddressConfig: updated }, "billing-enabled");
  };

  const handleEmailRecipientSourceChange = (
    value: "location_email" | "hierarchy_billing_email"
  ) => {
    const updated = { ...emailRecipientConfig, location_email_source: value };
    setEmailRecipientConfig(updated);
    saveConfig({ emailRecipientConfig: updated }, "email-source");
  };

  const handleFormFieldEmailChange = (value: string) => {
    const updated = {
      ...emailRecipientConfig,
      form_field_email: value === "__none__" ? null : value,
    };
    setEmailRecipientConfig(updated);
    saveConfig({ emailRecipientConfig: updated }, "email-form-field");
  };

  const handleIncludeOptionValueChange = (checked: boolean) => {
    const updated = { ...lineItemDisplay, include_option_value: checked };
    setLineItemDisplay(updated);
    saveConfig({ lineItemDisplay: updated }, "include-option-value");
  };

  const handleDescriptionFormatChange = (value: string) => {
    const updated = { ...lineItemDisplay, description_format: value };
    setLineItemDisplay(updated);

    // Clear error when user types
    if (validationErrors["line_item_display.description_format"]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors["line_item_display.description_format"];
        return newErrors;
      });
    }

    // Debounce save for text input
    if (descriptionFormatTimeoutRef.current) {
      clearTimeout(descriptionFormatTimeoutRef.current);
    }
    descriptionFormatTimeoutRef.current = setTimeout(() => {
      saveConfig({ lineItemDisplay: updated }, "description-format");
    }, 1000);
  };

  const handleDescriptionFormatBlur = () => {
    // Save immediately on blur
    if (descriptionFormatTimeoutRef.current) {
      clearTimeout(descriptionFormatTimeoutRef.current);
      descriptionFormatTimeoutRef.current = null;
    }
    saveConfig({ lineItemDisplay }, "description-format");
  };

  const handleShowBasePriceSeparatelyChange = (checked: boolean) => {
    const updated = { ...lineItemDisplay, show_base_price_separately: checked };
    setLineItemDisplay(updated);
    saveConfig({ lineItemDisplay: updated }, "show-base-price");
  };

  // Form fields for service address: text-like inputs only (exclude number)
  const getAvailableServiceAddressFields = () => {
    return fieldConfigs.filter(
      (field) =>
        !serviceAddressConfig.form_fields?.includes(field.name) &&
        (field.field_type === "text" ||
          field.field_type === "address" ||
          field.field_type === "email" ||
          field.field_type === "phone")
    );
  };

  // Check if address field exists in field configs
  const addressField = fieldConfigs.find((field) => field.field_type === "address");

  const emailFieldConfigs = fieldConfigs.filter((field) => field.field_type === "email");
  const showLocationEmailSource = usePredefinedLocations && hasLocations;
  // Email recipient for jobs without a location is independent of service-address display source.
  const showFormFieldEmailConfig = emailFieldConfigs.length > 0;

  // Auto-add address field to form_fields if it exists and form_fields is empty
  useEffect(() => {
    if (
      addressField &&
      (!serviceAddressConfig.form_fields || serviceAddressConfig.form_fields.length === 0) &&
      !serviceAddressConfig.form_fields?.includes(addressField.name)
    ) {
      setServiceAddressConfig((prev) => ({
        ...prev,
        form_fields: [addressField.name],
      }));
    }
  }, [addressField, serviceAddressConfig.form_fields]);

  // One-shot migrate deprecated/unimplemented location_contact_email → location_email
  const migratedContactEmailSourceRef = useRef(false);
  useEffect(() => {
    if (migratedContactEmailSourceRef.current) return;
    if (!config) return;
    const rawSource = (config.email_recipient_config as { location_email_source?: string } | null)
      ?.location_email_source;
    if (rawSource !== "location_contact_email") return;

    migratedContactEmailSourceRef.current = true;
    const updated: InvoiceEmailRecipientConfig = {
      ...emailRecipientConfig,
      location_email_source: "location_email",
    };
    setEmailRecipientConfig(updated);
    void saveConfig({ emailRecipientConfig: updated }, "email-source");
  }, [config, emailRecipientConfig, saveConfig]);

  const getFieldLabel = (fieldName: string) => {
    const field = fieldConfigs.find((f) => f.name === fieldName);
    return field?.label || fieldName;
  };

  if (configLoading || fieldConfigsLoading || locationsLoading) {
    return (
      <div>
        <p>Loading invoice template settings...</p>
        <FormSkeleton fields={6} />
      </div>
    );
  }

  if (configError) {
    return (
      <div className="text-center py-8">
        <div className="text-destructive font-semibold mb-2">
          Failed to load invoice template settings
        </div>
        <div className="text-sm text-muted-foreground mb-4">{configError}</div>
        <p className="text-xs text-muted-foreground">
          Please refresh the page or contact support if the problem persists.
        </p>
      </div>
    );
  }

  const availableServiceAddressFields = getAvailableServiceAddressFields();

  // Helper to show saving indicator for a section
  const SavingIndicator = ({ section }: { section: string }) =>
    savingSection === section ? (
      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-2 inline" />
    ) : null;

  return (
    <div className="space-y-6">
      {/* Service Address Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>
            Service Address Configuration
            <SavingIndicator section="service-source" />
            <SavingIndicator section="location-fields" />
            <SavingIndicator section="form-fields" />
          </CardTitle>
          <CardDescription>
            Configure how the service address (where work was performed) is displayed in the Service
            Address section on invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Service Address Source</Label>
            <RadioGroup
              value={serviceAddressConfig.source}
              onValueChange={(value) =>
                handleServiceAddressSourceChange(value as "auto" | "location" | "form_fields")
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="auto" id="service-source-auto" />
                <Label htmlFor="service-source-auto" className="font-normal cursor-pointer">
                  Auto (Use location if available, otherwise form fields)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="location" id="service-source-location" />
                <Label htmlFor="service-source-location" className="font-normal cursor-pointer">
                  Always use location fields
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="form_fields" id="service-source-form" />
                <Label htmlFor="service-source-form" className="font-normal cursor-pointer">
                  Always use form fields
                </Label>
              </div>
            </RadioGroup>
          </div>

          {(serviceAddressConfig.source === "auto" ||
            serviceAddressConfig.source === "location") && (
            <>
              <Separator />
              {hasLocations ? (
                <div className="space-y-3">
                  <Label>Location Fields to Display</Label>
                  <p className="text-sm text-muted-foreground">
                    Select which location fields should appear in the Service Address section
                  </p>
                  <div className="space-y-2">
                    {(["name", "address", "contact_person", "email", "phone"] as const).map(
                      (field) => (
                        <div key={field} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`location-field-${field}`}
                            checked={serviceAddressConfig.location_fields?.includes(field) ?? false}
                            onChange={(e) => handleLocationFieldToggle(field, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <Label
                            htmlFor={`location-field-${field}`}
                            className="font-normal cursor-pointer capitalize"
                          >
                            {field === "contact_person" ? "Contact Person" : field}
                          </Label>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-muted/50 border border-muted p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">No Locations Found</p>
                      <p className="text-sm text-muted-foreground">
                        You haven&apos;t set up any locations yet. Location fields will only appear
                        on invoices for jobs associated with a location.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        For jobs without locations, form field data will be used instead.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {(serviceAddressConfig.source === "auto" ||
            serviceAddressConfig.source === "form_fields") && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label>Form Fields for Service Address</Label>
                <p className="text-sm text-muted-foreground">
                  Select which form fields should appear in the Service Address section when
                  location data is not available
                </p>

                {/* Selected fields */}
                {serviceAddressConfig.form_fields &&
                  serviceAddressConfig.form_fields.length > 0 && (
                    <div className="space-y-2">
                      {serviceAddressConfig.form_fields.map((fieldName) => (
                        <div
                          key={fieldName}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                        >
                          <span className="text-sm">{getFieldLabel(fieldName)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveServiceAddressField(fieldName)}
                            className="h-6 w-6 p-0"
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                {/* Add field dropdown */}
                {availableServiceAddressFields.length > 0 && (
                  <div className="flex gap-2">
                    <Select onValueChange={handleAddServiceAddressField}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Add a field..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableServiceAddressFields.map((field) => (
                          <SelectItem key={field.name} value={field.name}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={availableServiceAddressFields.length === 0}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {availableServiceAddressFields.length === 0 &&
                  (!serviceAddressConfig.form_fields ||
                    serviceAddressConfig.form_fields.length === 0) && (
                    <p className="text-sm text-muted-foreground italic">
                      No text-based form fields available. Create text, address, email, or phone
                      fields in your form configuration to use here.
                    </p>
                  )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Billing Address Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>
            Billing Address Configuration
            <SavingIndicator section="billing-enabled" />
          </CardTitle>
          <CardDescription>
            Configure the billing address display for invoices sent to companies with hierarchy
            billing information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="billing-address-enabled">Show Billing Address</Label>
              <p className="text-sm text-muted-foreground">
                Display company billing address from hierarchy when available
              </p>
            </div>
            <Switch
              id="billing-address-enabled"
              checked={billingAddressConfig.enabled}
              onCheckedChange={handleBillingAddressEnabledChange}
            />
          </div>

          {billingAddressConfig.enabled && (
            <div className="rounded-lg bg-muted/50 border border-muted p-3">
              <p className="text-sm text-muted-foreground">
                When enabled, the billing address from the parent company in the location hierarchy
                will be shown separately from the service address.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Recipient Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>
            Email Recipient Configuration
            <SavingIndicator section="email-source" />
            <SavingIndicator section="email-form-field" />
          </CardTitle>
          <CardDescription>Configure how invoice email recipients are determined</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {showLocationEmailSource ? (
            <div className="space-y-3">
              <Label>Location Email Source</Label>
              <p className="text-sm text-muted-foreground mb-2">
                When a job is linked to a predefined location, which email should receive the
                invoice?
              </p>
              <RadioGroup
                value={emailRecipientConfig.location_email_source}
                onValueChange={(value) =>
                  handleEmailRecipientSourceChange(
                    value as "location_email" | "hierarchy_billing_email"
                  )
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="location_email" id="email-location" />
                  <Label htmlFor="email-location" className="font-normal cursor-pointer">
                    Location email (the email on the location record)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hierarchy_billing_email" id="email-hierarchy" />
                  <Label htmlFor="email-hierarchy" className="font-normal cursor-pointer">
                    Hierarchy billing email (from parent company billing address)
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground pt-2">
                Hierarchy billing email is only used when that option is selected. It comes from the
                parent company&apos;s billing address in the location hierarchy.
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/50 border border-muted p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">No predefined locations</p>
                  <p className="text-sm text-muted-foreground">
                    {usePredefinedLocations
                      ? "Add locations in Settings to choose a location-based invoice email source."
                      : "Workers enter service details on the mobile form instead of picking a location. Invoice emails come from a form field below."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {showFormFieldEmailConfig && (
            <>
              {showLocationEmailSource && <Separator />}
              <div className="space-y-2">
                <Label htmlFor="form-field-email">Form Field for Email (No Location)</Label>
                <Select
                  value={emailRecipientConfig.form_field_email || "__none__"}
                  onValueChange={handleFormFieldEmailChange}
                >
                  <SelectTrigger id="form-field-email">
                    <SelectValue placeholder="Select an email field" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (manual review required)</SelectItem>
                    {emailFieldConfigs.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.label} ({field.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used when a job has no linked location. Invoices without a valid email will not be
                  auto-sent.
                </p>
              </div>
            </>
          )}

          {!showFormFieldEmailConfig && (
            <div className="rounded-lg bg-muted/50 border border-muted p-4">
              <p className="text-sm text-muted-foreground">
                Add an <strong>email</strong> field to your entry form to configure invoice
                recipients for jobs without a predefined location.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line Item Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle>
            Line Item Display Settings
            <SavingIndicator section="include-option-value" />
            <SavingIndicator section="description-format" />
            <SavingIndicator section="show-base-price" />
          </CardTitle>
          <CardDescription>Configure how line items are displayed on invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="include-option-value">Include Option Values</Label>
              <p className="text-sm text-muted-foreground">
                When on, option selections (e.g., &quot;Full Detail&quot;) appear in line item
                descriptions. When off, only the field label is shown.
              </p>
            </div>
            <Switch
              id="include-option-value"
              checked={lineItemDisplay.include_option_value}
              onCheckedChange={handleIncludeOptionValueChange}
            />
          </div>

          {lineItemDisplay.include_option_value && (
            <div className="space-y-2">
              <Label htmlFor="description-format">Description Format</Label>
              <Input
                id="description-format"
                value={lineItemDisplay.description_format}
                onChange={(e) => handleDescriptionFormatChange(e.target.value)}
                onBlur={handleDescriptionFormatBlur}
                placeholder="{field_label}: {option_value}"
                data-error-field="line_item_display.description_format"
                className={
                  validationErrors["line_item_display.description_format"]
                    ? "border-destructive"
                    : ""
                }
              />
              {validationErrors["line_item_display.description_format"] && (
                <p id="description-format-error" className="text-xs text-destructive" role="alert">
                  {validationErrors["line_item_display.description_format"]}
                </p>
              )}
              <p id="description-format-help" className="text-xs text-muted-foreground">
                Use {"{field_label}"} for the field label and {"{option_value}"} for the option
                value. Applies only when Include Option Values is on.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-base-price">Show Base Price Separately</Label>
              <p className="text-sm text-muted-foreground">
                Show base pricing as its own row. The amount is always included in the job total
                either way.
              </p>
            </div>
            <Switch
              id="show-base-price"
              checked={lineItemDisplay.show_base_price_separately}
              onCheckedChange={handleShowBasePriceSeparatelyChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Validation Errors Summary */}
      {Object.keys(validationErrors).length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-destructive">
                Please fix the following errors:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-destructive">
                {Object.entries(validationErrors).map(([field, error]) => (
                  <li key={field}>
                    <span className="font-medium">{field}:</span> {error}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fixed Preview Invoice Header Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setShowPreview(true)}
          variant="default"
          className="shadow-lg cursor-pointer"
        >
          <Eye className="mr-2 h-4 w-4" />
          Preview Invoice Header
        </Button>
      </div>

      {/* Invoice Header Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Header Preview</DialogTitle>
            <DialogDescription>
              This is how your invoice header will appear to customers based on your current
              settings.
            </DialogDescription>
          </DialogHeader>

          {/* Preview Content */}
          <div className="border rounded-lg p-6 bg-white dark:bg-gray-950 space-y-6">
            {/* Invoice Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                {orgSettings?.logo_url && (
                  <div className="h-16 w-16 rounded border bg-muted flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={normalizeLogoUrl(orgSettings.logo_url) || ""}
                      alt="Logo"
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}
                <div>
                  <p className="font-bold text-lg">{orgSettings?.name || "Your Business Name"}</p>
                  {orgSettings?.abn && (
                    <p className="text-sm text-muted-foreground">ABN: {orgSettings.abn}</p>
                  )}
                  {orgSettings?.business_address && (
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {orgSettings.business_address}
                    </p>
                  )}
                  {orgSettings?.primary_contact_email && (
                    <p className="text-sm text-muted-foreground">
                      {orgSettings.primary_contact_email}
                    </p>
                  )}
                  {orgSettings?.primary_contact_phone && (
                    <p className="text-sm text-muted-foreground">
                      {orgSettings.primary_contact_phone}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {orgSettings?.gst_registered ? "TAX INVOICE" : "INVOICE"}
                </p>
                <p className="text-sm text-muted-foreground">Invoice #INV-00001</p>
                <p className="text-sm text-muted-foreground">
                  Date: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            <Separator />

            {/* Service Address Preview */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="font-semibold text-sm mb-2">Service Address</p>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  {serviceAddressConfig.source === "location" ||
                  serviceAddressConfig.source === "auto" ? (
                    <>
                      {serviceAddressConfig.location_fields?.includes("name") && (
                        <p>Example Location Name</p>
                      )}
                      {serviceAddressConfig.location_fields?.includes("address") && (
                        <p>123 Main Street, City 12345</p>
                      )}
                      {serviceAddressConfig.location_fields?.includes("contact_person") && (
                        <p>John Smith</p>
                      )}
                      {serviceAddressConfig.location_fields?.includes("email") && (
                        <p>contact@example.com</p>
                      )}
                      {serviceAddressConfig.location_fields?.includes("phone") && (
                        <p>0412 345 678</p>
                      )}
                    </>
                  ) : (
                    <>
                      {serviceAddressConfig.form_fields?.map((field) => (
                        <p key={field}>[{getFieldLabel(field)}]</p>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {billingAddressConfig.enabled && (
                <div>
                  <p className="font-semibold text-sm mb-2">Billing Address</p>
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    <p>Parent Company Name</p>
                    <p>456 Business Ave, Suite 100</p>
                    <p>City, State 54321</p>
                    <p>billing@parentcompany.com</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
