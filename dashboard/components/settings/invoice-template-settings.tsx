"use client";

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
import { CheckCircle2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { InvoiceHeaderSettings } from "./invoice-template/InvoiceHeaderSettings";

export default function InvoiceTemplateSettings() {
  const {
    config,
    loading: configLoading,
    updateConfig,
    error: configError,
  } = useInvoiceTemplateConfig();
  const { fieldConfigs, loading: fieldConfigsLoading } = useFieldConfigs();
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Partial<Record<string, string>>
  >({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Local state for form
  const [invoiceTitle, setInvoiceTitle] = useState<string>(
    DEFAULT_INVOICE_TITLE
  );
  const [showLogo, setShowLogo] = useState(true);
  const [showAbn, setShowAbn] = useState(true);
  const [serviceAddressConfig, setServiceAddressConfig] =
    useState<ServiceAddressConfig>(DEFAULT_SERVICE_ADDRESS_CONFIG);
  const [billingAddressConfig, setBillingAddressConfig] =
    useState<BillingAddressConfig>(DEFAULT_BILLING_ADDRESS_CONFIG);
  const [lineItemDisplay, setLineItemDisplay] = useState<LineItemDisplayConfig>(
    DEFAULT_LINE_ITEM_DISPLAY
  );
  const [emailRecipientConfig, setEmailRecipientConfig] =
    useState<InvoiceEmailRecipientConfig>(DEFAULT_EMAIL_RECIPIENT_CONFIG);

  // Initialize form with config data
  useEffect(() => {
    if (config) {
      setInvoiceTitle(
        (config.invoice_title || DEFAULT_INVOICE_TITLE) as string
      );
      setShowLogo(config.show_logo ?? true);
      setShowAbn(config.show_abn ?? true);
      // Migrate legacy bill_to_fields to service_address_config.form_fields if needed
      const legacyBillToFields = config.bill_to_fields || [];
      const existingServiceConfig =
        config.service_address_config || DEFAULT_SERVICE_ADDRESS_CONFIG;

      setServiceAddressConfig({
        ...existingServiceConfig,
        form_fields: existingServiceConfig.form_fields || legacyBillToFields,
      });
      setBillingAddressConfig(
        config.billing_address_config || DEFAULT_BILLING_ADDRESS_CONFIG
      );
      setLineItemDisplay(config.line_item_display || DEFAULT_LINE_ITEM_DISPLAY);
      setEmailRecipientConfig(
        config.email_recipient_config || DEFAULT_EMAIL_RECIPIENT_CONFIG
      );
    }
  }, [config]);

  const handleSave = async () => {
    if (!config) return;

    // Clear previous validation errors
    setValidationErrors({});

    // Validate the config before saving
    const configToSave = {
      invoice_title: invoiceTitle,
      show_logo: showLogo,
      show_abn: showAbn,
      service_address_config: serviceAddressConfig,
      billing_address_config: billingAddressConfig,
      email_recipient_config: emailRecipientConfig,
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
        errorElement?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    try {
      setSaving(true);
      setSaveSuccess(false);
      await updateConfig(configToSave);
      // Clear errors on successful save
      setValidationErrors({});
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

  const getAvailableServiceAddressFields = () => {
    return fieldConfigs.filter(
      (field) =>
        !serviceAddressConfig.form_fields?.includes(field.name) &&
        (field.field_type === "text" || field.field_type === "number")
    );
  };

  const getFieldLabel = (fieldName: string) => {
    const field = fieldConfigs.find((f) => f.name === fieldName);
    return field?.label || fieldName;
  };

  if (configLoading || fieldConfigsLoading) {
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
      <InvoiceHeaderSettings
        invoiceTitle={invoiceTitle}
        showLogo={showLogo}
        showAbn={showAbn}
        onInvoiceTitleChange={setInvoiceTitle}
        onShowLogoChange={setShowLogo}
        onShowAbnChange={setShowAbn}
      />

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
                        {field === "contact_person" ? "Contact Person" : field}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
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
              customer email address. Leave empty to use the default email
              below.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-email">Default Email (Fallback)</Label>
            <Input
              id="default-email"
              type="email"
              value={emailRecipientConfig.default_email || ""}
              onChange={(e) => {
                const value = e.target.value.trim() || null;
                setEmailRecipientConfig((prev) => ({
                  ...prev,
                  default_email: value,
                }));
                // Clear validation error when user types
                if (validationErrors["email_recipient_config.default_email"]) {
                  setValidationErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors["email_recipient_config.default_email"];
                    return newErrors;
                  });
                }
              }}
              placeholder="default@example.com"
              pattern="[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*"
            />
            <p
              id="default-email-help"
              className="text-xs text-muted-foreground"
            >
              Fallback email address used when no other email source is
              available. Leave empty if you want invoices without valid email
              addresses to require manual review.
            </p>
            {validationErrors["email_recipient_config.default_email"] && (
              <p
                id="default-email-error"
                className="text-xs text-destructive"
                data-error-field="email_recipient_config.default_email"
                role="alert"
              >
                {validationErrors["email_recipient_config.default_email"]}
              </p>
            )}
            {emailRecipientConfig.default_email &&
              !validationErrors["email_recipient_config.default_email"] &&
              !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
                emailRecipientConfig.default_email
              ) && (
                <p className="text-xs text-destructive">
                  Please enter a valid email address
                </p>
              )}
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

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        {Object.keys(validationErrors).length > 0 && (
          <p className="text-sm text-muted-foreground self-center">
            {Object.keys(validationErrors).length} error
            {Object.keys(validationErrors).length !== 1 ? "s" : ""} to fix
          </p>
        )}
        <Button
          onClick={handleSave}
          disabled={
            saving || !config || Object.keys(validationErrors).length > 0
          }
          aria-label="Save invoice template settings"
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
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
