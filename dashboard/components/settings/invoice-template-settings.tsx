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
import { LoadingState } from "@/components/ui/loading-state";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
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

    try {
      setSaving(true);
      await updateConfig({
        invoice_title: invoiceTitle,
        show_logo: showLogo,
        show_abn: showAbn,
        service_address_config: serviceAddressConfig,
        billing_address_config: billingAddressConfig,
        email_recipient_config: emailRecipientConfig,
        line_item_display: lineItemDisplay,
      });
    } catch (err) {
      console.error("Failed to save invoice template config:", err);
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
    return <LoadingState message="Loading invoice template settings..." />;
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
              value={emailRecipientConfig.form_field_email || ""}
              onValueChange={(value) =>
                setEmailRecipientConfig((prev) => ({
                  ...prev,
                  form_field_email: value || null,
                }))
              }
            >
              <SelectTrigger id="form-field-email">
                <SelectValue placeholder="Select a field that contains email" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None (use default email)</SelectItem>
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
              }}
              placeholder="default@example.com"
              pattern="[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*"
            />
            <p className="text-xs text-muted-foreground">
              Fallback email address used when no other email source is
              available. Leave empty if you want invoices without valid email
              addresses to require manual review.
            </p>
            {emailRecipientConfig.default_email &&
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
                onChange={(e) =>
                  setLineItemDisplay((prev) => ({
                    ...prev,
                    description_format: e.target.value,
                  }))
                }
                placeholder="{field_label}: {option_value}"
              />
              <p className="text-xs text-muted-foreground">
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

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !config}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
