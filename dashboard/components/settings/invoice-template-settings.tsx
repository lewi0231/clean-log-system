"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useFieldConfigs } from "@/hooks/use-field-configs";
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
import { validateInvoiceTemplateConfig } from "@/lib/validations/invoice-template";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface InvoiceTemplateSettingsProps {
  /** Optional for backward compatibility; org is resolved via useOrganization in child hooks. */
  organizationId?: string | null;
}

export default function InvoiceTemplateSettings(
  _props?: InvoiceTemplateSettingsProps,
) {
  const {
    config,
    loading: configLoading,
    updateConfig,
    error: configError,
  } = useInvoiceTemplateConfig();
  const { fieldConfigs, loading: fieldConfigsLoading } = useFieldConfigs();
  const { locations, loading: locationsLoading } = useLocations();
  const { settings: orgSettings } = useOrganizationSettings();
  const hasLocations = locations && locations.length > 0;
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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
  const [validationErrors, setValidationErrors] = useState<
    Partial<Record<string, string>>
  >({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Local state for form (invoice_title, show_logo, show_abn are no longer user-editable:
  // title is derived from GST; logo/ABN always shown when present)
  const [serviceAddressConfig, setServiceAddressConfig] =
    useState<ServiceAddressConfig>(DEFAULT_SERVICE_ADDRESS_CONFIG);
  const [billingAddressConfig, setBillingAddressConfig] =
    useState<BillingAddressConfig>(DEFAULT_BILLING_ADDRESS_CONFIG);
  const [lineItemDisplay, setLineItemDisplay] = useState<LineItemDisplayConfig>(
    DEFAULT_LINE_ITEM_DISPLAY
  );
  const [emailRecipientConfig, setEmailRecipientConfig] =
    useState<InvoiceEmailRecipientConfig>(DEFAULT_EMAIL_RECIPIENT_CONFIG);

  // Snapshot of last loaded/saved template form state (used for "save when dirty")
  type TemplateFormSnapshot = {
    serviceAddressConfig: ServiceAddressConfig;
    billingAddressConfig: BillingAddressConfig;
    lineItemDisplay: LineItemDisplayConfig;
    emailRecipientConfig: InvoiceEmailRecipientConfig;
  };
  const [initialTemplateSnapshot, setInitialTemplateSnapshot] =
    useState<TemplateFormSnapshot | null>(null);

  // Initialize form and "initial" snapshot from config
  useEffect(() => {
    if (config) {
      const legacyBillToFields = config.bill_to_fields || [];
      const existingServiceConfig =
        config.service_address_config || DEFAULT_SERVICE_ADDRESS_CONFIG;
      const service = {
        ...existingServiceConfig,
        form_fields: existingServiceConfig.form_fields || legacyBillToFields,
      };
      const billing =
        config.billing_address_config || DEFAULT_BILLING_ADDRESS_CONFIG;
      const lineItem = config.line_item_display || DEFAULT_LINE_ITEM_DISPLAY;
      const email =
        config.email_recipient_config || DEFAULT_EMAIL_RECIPIENT_CONFIG;

      setServiceAddressConfig(service);
      setBillingAddressConfig(billing);
      setLineItemDisplay(lineItem);
      setEmailRecipientConfig(email);
      setInitialTemplateSnapshot({
        serviceAddressConfig: service,
        billingAddressConfig: billing,
        lineItemDisplay: lineItem,
        emailRecipientConfig: { ...email, default_email: null },
      });
    }
  }, [config]);

  // Normalized current form state for dirty check (email uses default_email: null like save payload)
  const currentFormSnapshot = useMemo(
    (): TemplateFormSnapshot => ({
      serviceAddressConfig,
      billingAddressConfig,
      lineItemDisplay,
      emailRecipientConfig: { ...emailRecipientConfig, default_email: null },
    }),
    [
      serviceAddressConfig,
      billingAddressConfig,
      lineItemDisplay,
      emailRecipientConfig,
    ],
  );
  const hasTemplateUnsaved =
    initialTemplateSnapshot !== null &&
    JSON.stringify(currentFormSnapshot) !==
      JSON.stringify(initialTemplateSnapshot);

  const handleSave = async () => {
    if (!config) return;

    // Clear previous validation errors
    setValidationErrors({});

    // Validate the config before saving (invoice_title, show_logo, show_abn use defaults:
    // title from GST; logo/ABN always shown when org has them)
    const configToSave = {
      invoice_title: DEFAULT_INVOICE_TITLE,
      show_logo: true,
      show_abn: true,
      service_address_config: serviceAddressConfig,
      billing_address_config: billingAddressConfig,
      email_recipient_config: { ...emailRecipientConfig, default_email: null },
      line_item_display: lineItemDisplay,
    };

    const validation = validateInvoiceTemplateConfig(configToSave);

    if (!validation.success) {
      setValidationErrors(validation.errors || {});
      // Scroll to first error
      const firstErrorKey = Object.keys(validation.errors || {})[0];
      if (firstErrorKey) {
        const errorElement = document.querySelector(
          `[data-error-field="${firstErrorKey}"]`
        );
        if (
          errorElement &&
          typeof errorElement.scrollIntoView === "function"
        ) {
          errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
      return;
    }

    try {
      setSaving(true);
      setSaveSuccess(false);
      await updateConfig(configToSave);
      // Clear errors on successful save
      setValidationErrors({});
      // Align "initial" with saved state so form is no longer dirty
      setInitialTemplateSnapshot({
        serviceAddressConfig: configToSave.service_address_config,
        billingAddressConfig: configToSave.billing_address_config,
        lineItemDisplay: configToSave.line_item_display,
        emailRecipientConfig: configToSave.email_recipient_config,
      });
      // Show success message
      setSaveSuccess(true);
      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to save invoice template configuration";
      console.error("Failed to save invoice template config:", err);
      alert(
        `Failed to save settings: ${errorMessage}. Please try again or contact support if the problem persists.`
      );
    } finally {
      setSaving(false);
    }
  };

  const addServiceAddressField = (fieldName: string) => {
    if (fieldName && !serviceAddressConfig.form_fields?.includes(fieldName)) {
      setServiceAddressConfig((prev) => ({
        ...prev,
        form_fields: [...(prev.form_fields || []), fieldName],
      }));
    }
  };

  const removeServiceAddressField = (fieldName: string) => {
    setServiceAddressConfig((prev) => ({
      ...prev,
      form_fields: (prev.form_fields || []).filter((f) => f !== fieldName),
    }));
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
  const addressField = fieldConfigs.find(
    (field) => field.field_type === "address"
  );

  // Check if email field exists in field configs
  const emailField = fieldConfigs.find((field) => field.field_type === "email");

  // Auto-add address field to form_fields if it exists and form_fields is empty
  useEffect(() => {
    if (
      addressField &&
      (!serviceAddressConfig.form_fields ||
        serviceAddressConfig.form_fields.length === 0) &&
      !serviceAddressConfig.form_fields?.includes(addressField.name)
    ) {
      setServiceAddressConfig((prev) => ({
        ...prev,
        form_fields: [addressField.name],
      }));
    }
  }, [addressField, serviceAddressConfig.form_fields]);

  // Auto-set email field for email recipient if it exists and not already set
  useEffect(() => {
    if (
      emailField &&
      !emailRecipientConfig.form_field_email &&
      config?.email_recipient_config?.form_field_email === null
    ) {
      setEmailRecipientConfig((prev) => ({
        ...prev,
        form_field_email: emailField.id,
      }));
    }
  }, [
    emailField,
    emailRecipientConfig.form_field_email,
    config?.email_recipient_config?.form_field_email,
  ]);

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

  return (
    <div className="space-y-6">
      {/* Service Address Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Service Address Configuration</CardTitle>
          <CardDescription>
            Configure how the service address (where work was performed) is
            displayed in the Service Address section on invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Service Address Source</Label>
            <RadioGroup
              value={serviceAddressConfig.source}
              onValueChange={(value) =>
                setServiceAddressConfig((prev) => ({
                  ...prev,
                  source: value as "auto" | "location" | "form_fields",
                }))
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="auto" id="service-source-auto" />
                <Label
                  htmlFor="service-source-auto"
                  className="font-normal cursor-pointer"
                >
                  Auto (Use location if available, otherwise form fields)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="location" id="service-source-location" />
                <Label
                  htmlFor="service-source-location"
                  className="font-normal cursor-pointer"
                >
                  Always use location fields
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="form_fields" id="service-source-form" />
                <Label
                  htmlFor="service-source-form"
                  className="font-normal cursor-pointer"
                >
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
                    Select which location fields should appear in the Service
                    Address section
                  </p>
                  <div className="space-y-2">
                    {(
                      [
                        "name",
                        "address",
                        "contact_person",
                        "email",
                        "phone",
                      ] as const
                    ).map((field) => (
                      <div key={field} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`location-field-${field}`}
                          checked={
                            serviceAddressConfig.location_fields?.includes(
                              field
                            ) ?? false
                          }
                          onChange={(e) => {
                            const currentFields =
                              serviceAddressConfig.location_fields || [];
                            if (e.target.checked) {
                              setServiceAddressConfig((prev) => ({
                                ...prev,
                                location_fields: [...currentFields, field],
                              }));
                            } else {
                              setServiceAddressConfig((prev) => ({
                                ...prev,
                                location_fields: currentFields.filter(
                                  (f) => f !== field
                                ),
                              }));
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label
                          htmlFor={`location-field-${field}`}
                          className="font-normal cursor-pointer capitalize"
                        >
                          {field === "contact_person"
                            ? "Contact Person"
                            : field}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-800">
                      No locations configured
                    </p>
                    <p className="text-sm text-amber-700">
                      Service address will use form fields since no locations
                      have been set up. Configure locations in the{" "}
                      <a
                        href="/dashboard/locations"
                        className="underline hover:no-underline font-medium"
                      >
                        Locations settings
                      </a>{" "}
                      to enable location-based addressing.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {(serviceAddressConfig.source === "auto" ||
            serviceAddressConfig.source === "form_fields") && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Form Fields for Service Address</Label>
                  <p className="text-sm text-muted-foreground">
                    Select which fields from your field configurations should
                    appear in the Service Address section. Fields will be
                    displayed in the order they are added.
                  </p>
                </div>

                {/* Current Form Fields */}
                {serviceAddressConfig.form_fields &&
                  serviceAddressConfig.form_fields.length > 0 && (
                    <div className="space-y-2">
                      <Label>Current Form Fields</Label>
                      <div className="space-y-2">
                        {serviceAddressConfig.form_fields.map((fieldName) => (
                          <div
                            key={fieldName}
                            className="flex items-center justify-between p-3 border rounded-md bg-muted/50"
                          >
                            <span className="text-sm font-medium">
                              {getFieldLabel(fieldName)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                removeServiceAddressField(fieldName)
                              }
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Add Field */}
                {availableServiceAddressFields.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="add-service-address-field">
                      {serviceAddressConfig.form_fields &&
                      serviceAddressConfig.form_fields.length > 0
                        ? "Add Another Field"
                        : "Add Field"}
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        value=""
                        onValueChange={(value) => {
                          if (value) {
                            addServiceAddressField(value);
                          }
                        }}
                      >
                        <SelectTrigger
                          id="add-service-address-field"
                          className="flex-1"
                        >
                          <SelectValue placeholder="Select a field to add" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableServiceAddressFields.map((field) => (
                            <SelectItem key={field.id} value={field.name}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const select = document.getElementById(
                            "add-service-address-field"
                          ) as HTMLSelectElement;
                          if (select?.value) {
                            addServiceAddressField(select.value);
                          }
                        }}
                        className="shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {availableServiceAddressFields.length === 0 &&
                  (!serviceAddressConfig.form_fields ||
                    serviceAddressConfig.form_fields.length === 0) && (
                    <p className="text-sm text-muted-foreground">
                      No field configurations available. Create fields in the
                      Field Configuration settings first.
                    </p>
                  )}

                {availableServiceAddressFields.length === 0 &&
                  serviceAddressConfig.form_fields &&
                  serviceAddressConfig.form_fields.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      All available fields have been added to Service Address
                      section.
                    </p>
                  )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Bill To Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Bill To Configuration</CardTitle>
          <CardDescription>
            Configure a separate billing address when it differs from the
            service address (e.g., for corporate accounts). By default, Bill To
            uses the same address as Service Address.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-billing-address">Show Billing Address</Label>
              <p className="text-sm text-muted-foreground">
                Enable separate billing address section. The system will
                auto-detect company billing addresses from location hierarchy.
              </p>
            </div>
            <Switch
              id="show-billing-address"
              checked={billingAddressConfig.enabled}
              onCheckedChange={(checked) =>
                setBillingAddressConfig((prev) => ({
                  ...prev,
                  enabled: checked,
                }))
              }
            />
          </div>

          {billingAddressConfig.enabled && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label>Billing Address Source</Label>
                <RadioGroup
                  value={billingAddressConfig.source}
                  onValueChange={(value) =>
                    setBillingAddressConfig((prev) => ({
                      ...prev,
                      source: value as
                        | "auto"
                        | "organization"
                        | "hierarchy"
                        | "form_fields",
                    }))
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="auto" id="billing-source-auto" />
                    <Label
                      htmlFor="billing-source-auto"
                      className="font-normal cursor-pointer"
                    >
                      Auto-detect from company hierarchy
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="hierarchy"
                      id="billing-source-hierarchy"
                    />
                    <Label
                      htmlFor="billing-source-hierarchy"
                      className="font-normal cursor-pointer"
                    >
                      Use hierarchy metadata
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="organization"
                      id="billing-source-org"
                    />
                    <Label
                      htmlFor="billing-source-org"
                      className="font-normal cursor-pointer"
                    >
                      Use organization settings (coming soon)
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  Auto-detect will check if a location belongs to a company in
                  the hierarchy and use billing information from the company
                  metadata if available.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Email Recipient Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Email Recipient Configuration</CardTitle>
          <CardDescription>
            Configure where invoice emails should be sent. This determines the
            recipient email address when invoices are automatically sent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Location Email Source</Label>
            <RadioGroup
              value={emailRecipientConfig.location_email_source}
              onValueChange={(value) =>
                setEmailRecipientConfig((prev) => ({
                  ...prev,
                  location_email_source: value as
                    | "location_email"
                    | "hierarchy_billing_email"
                    | "location_contact_email",
                }))
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="location_email"
                  id="email-source-location"
                />
                <Label
                  htmlFor="email-source-location"
                  className="font-normal cursor-pointer"
                >
                  Use location email address (default)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="hierarchy_billing_email"
                  id="email-source-hierarchy"
                />
                <Label
                  htmlFor="email-source-hierarchy"
                  className="font-normal cursor-pointer"
                >
                  Use company billing email from hierarchy
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="location_contact_email"
                  id="email-source-contact"
                />
                <Label
                  htmlFor="email-source-contact"
                  className="font-normal cursor-pointer"
                >
                  Use location contact email (coming soon)
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              For jobs with locations, determines which email address to use.
              Hierarchy billing email takes precedence if the location belongs
              to a company with billing information.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="form-field-email">
              Form Field for Email (No Location)
            </Label>
            <Select
              value={emailRecipientConfig.form_field_email || "__none__"}
              onValueChange={(value) =>
                setEmailRecipientConfig((prev) => ({
                  ...prev,
                  form_field_email: value === "__none__" ? null : value,
                }))
              }
            >
              <SelectTrigger id="form-field-email">
                <SelectValue placeholder="Select a field that contains email" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  None (use default email)
                </SelectItem>
                {fieldConfigs
                  .filter(
                    (field) =>
                      field.field_type === "text" ||
                      field.field_type === "email"
                  )
                  .map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.label} ({field.name})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              For jobs without a location, select which form field contains the
              customer email address. Leave empty when there is no form-field
              email; those invoices will not be auto-sent and may require manual
              review.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Line Item Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Line Item Display Settings</CardTitle>
          <CardDescription>
            Configure how line items are displayed on invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="include-option-value">
                Include Option Values
              </Label>
              <p className="text-sm text-muted-foreground">
                Show selected option values (e.g., &quot;Full Detail&quot;) in
                line item descriptions
              </p>
            </div>
            <Switch
              id="include-option-value"
              checked={lineItemDisplay.include_option_value}
              onCheckedChange={(checked) =>
                setLineItemDisplay((prev) => ({
                  ...prev,
                  include_option_value: checked,
                }))
              }
            />
          </div>

          {lineItemDisplay.include_option_value && (
            <div className="space-y-2">
              <Label htmlFor="description-format">Description Format</Label>
              <Input
                id="description-format"
                value={lineItemDisplay.description_format}
                onChange={(e) => {
                  setLineItemDisplay((prev) => ({
                    ...prev,
                    description_format: e.target.value,
                  }));
                  // Clear error when user types
                  if (
                    validationErrors["line_item_display.description_format"]
                  ) {
                    setValidationErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors["line_item_display.description_format"];
                      return newErrors;
                    });
                  }
                }}
                placeholder="{field_label}: {option_value}"
                data-error-field="line_item_display.description_format"
                className={
                  validationErrors["line_item_display.description_format"]
                    ? "border-destructive"
                    : ""
                }
              />
              {validationErrors["line_item_display.description_format"] && (
                <p
                  id="description-format-error"
                  className="text-xs text-destructive"
                  role="alert"
                >
                  {validationErrors["line_item_display.description_format"]}
                </p>
              )}
              <p
                id="description-format-help"
                className="text-xs text-muted-foreground"
              >
                Use {"{field_label}"} for the field label and {"{option_value}"}{" "}
                for the option value
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-base-price">
                Show Base Price Separately
              </Label>
              <p className="text-sm text-muted-foreground">
                Display base price as a separate line item
              </p>
            </div>
            <Switch
              id="show-base-price"
              checked={lineItemDisplay.show_base_price_separately}
              onCheckedChange={(checked) =>
                setLineItemDisplay((prev) => ({
                  ...prev,
                  show_base_price_separately: checked,
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Success Message */}
      {saveSuccess && (
        <Card className="border-success/20 bg-success/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <p className="text-sm font-semibold text-success">
                Invoice template settings saved successfully!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Errors Summary */}
      {Object.keys(validationErrors).length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-destructive">
                Please fix the following errors before saving:
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

      {/* Save row: only when dirty, matching GST/Bank layout */}
      {hasTemplateUnsaved && (
        <div className="flex items-center justify-between pt-4 border-t">
          {Object.keys(validationErrors).length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {Object.keys(validationErrors).length} error
              {Object.keys(validationErrors).length !== 1 ? "s" : ""} to fix
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              You have unsaved changes
            </p>
          )}
          <Button
            onClick={handleSave}
            disabled={
              saving || !config || Object.keys(validationErrors).length > 0
            }
            aria-label="Save invoice template settings"
            className="cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                Save Invoice Template Settings
              </>
            )}
          </Button>
        </div>
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
              This is how your invoice header will appear to customers based on
              your current settings.
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
                  <p className="font-bold text-lg">
                    {orgSettings?.name || "Your Business Name"}
                  </p>
                  {orgSettings?.abn && (
                    <p className="text-sm text-muted-foreground">
                      ABN: {orgSettings.abn}
                    </p>
                  )}
                  {orgSettings?.business_address && (
                    <p className="text-sm text-muted-foreground">
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
                <h1 className="text-2xl font-bold text-primary">
                  Tax Invoice
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Invoice #: INV-00001
                </p>
                <p className="text-sm text-muted-foreground">
                  Date: {new Date().toLocaleDateString("en-AU")}
                </p>
                <p className="text-sm text-muted-foreground">
                  Due:{" "}
                  {new Date(
                    Date.now() + 30 * 24 * 60 * 60 * 1000
                  ).toLocaleDateString("en-AU")}
                </p>
              </div>
            </div>

            <Separator />

            {/* Service Address Preview */}
            <div className="grid grid-cols-2 gap-6">
              <div className="p-3 rounded-lg bg-muted/30">
                <h3 className="font-semibold text-sm mb-2 text-foreground">
                  Service Address
                </h3>
                <div className="text-sm space-y-0.5">
                  {serviceAddressConfig.source === "form_fields" ||
                  (serviceAddressConfig.source === "auto" && !hasLocations) ? (
                    <>
                      {serviceAddressConfig.form_fields &&
                      serviceAddressConfig.form_fields.length > 0 ? (
                        <div className="space-y-1">
                          {serviceAddressConfig.form_fields.map((fieldName) => {
                            const field = fieldConfigs.find(
                              (f) => f.name === fieldName
                            );
                            // Show example data based on field type
                            const exampleData: Record<string, string> = {
                              address: "42 Smith Street, Sydney NSW 2000",
                              email: "customer@example.com",
                              phone: "0412 345 678",
                              name: "John Smith",
                            };
                            const example =
                              field?.field_type && exampleData[field.field_type]
                                ? exampleData[field.field_type]
                                : `Example ${getFieldLabel(fieldName)}`;
                            return (
                              <p key={fieldName} className="text-foreground">
                                {example}
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({getFieldLabel(fieldName)})
                                </span>
                              </p>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="italic text-muted-foreground">
                          No fields configured
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="space-y-0.5 text-foreground">
                      {serviceAddressConfig.location_fields?.includes(
                        "name"
                      ) && <p className="font-medium">ABC Company</p>}
                      {serviceAddressConfig.location_fields?.includes(
                        "address"
                      ) && <p>123 Business Street, Melbourne VIC 3000</p>}
                      {serviceAddressConfig.location_fields?.includes(
                        "contact_person"
                      ) && <p>Contact: Jane Doe</p>}
                      {serviceAddressConfig.location_fields?.includes(
                        "email"
                      ) && <p>contact@abccompany.com.au</p>}
                      {serviceAddressConfig.location_fields?.includes(
                        "phone"
                      ) && <p>03 9000 0000</p>}
                    </div>
                  )}
                </div>
              </div>

              {billingAddressConfig.enabled && (
                <div className="p-3 rounded-lg bg-muted/30">
                  <h3 className="font-semibold text-sm mb-2 text-foreground">
                    Bill To
                  </h3>
                  <div className="text-sm space-y-0.5 text-foreground">
                    <p className="font-medium">XYZ Corporation Pty Ltd</p>
                    <p>Level 10, 100 Collins Street</p>
                    <p>Melbourne VIC 3000</p>
                    <p>accounts@xyzcorp.com.au</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sample Line Items Preview */}
            <div className="mt-4">
              <h3 className="font-semibold text-sm mb-2">Line Items</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Description</th>
                      <th className="text-right p-2 font-medium">Qty</th>
                      <th className="text-right p-2 font-medium">Price</th>
                      <th className="text-right p-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="p-2">Service - Full Detail</td>
                      <td className="text-right p-2">1</td>
                      <td className="text-right p-2">$150.00</td>
                      <td className="text-right p-2">$150.00</td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-2">Windows (exterior)</td>
                      <td className="text-right p-2">10</td>
                      <td className="text-right p-2">$5.00</td>
                      <td className="text-right p-2">$50.00</td>
                    </tr>
                    <tr className="border-t bg-muted/30">
                      <td colSpan={3} className="p-2 text-right font-medium">
                        Subtotal
                      </td>
                      <td className="text-right p-2">$200.00</td>
                    </tr>
                    <tr className="border-t bg-muted/30">
                      <td colSpan={3} className="p-2 text-right font-medium">
                        GST (10%)
                      </td>
                      <td className="text-right p-2">$20.00</td>
                    </tr>
                    <tr className="border-t bg-primary/10">
                      <td colSpan={3} className="p-2 text-right font-bold">
                        Total (inc. GST)
                      </td>
                      <td className="text-right p-2 font-bold">$220.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ATO Requirements Notice */}
            <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Australian Tax Invoice Requirements (ATO):</strong> For
                sales under $1,000, invoices must show: (1) &quot;Tax
                Invoice&quot; heading, (2) Seller&apos;s identity, (3) ABN, (4)
                Date issued, (5) Description of items with quantity and price,
                (6) GST amount, (7) Which items are taxable. For sales $1,000+,
                buyer&apos;s identity or ABN is also required.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
