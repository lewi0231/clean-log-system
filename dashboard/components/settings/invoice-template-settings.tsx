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
import type { LineItemDisplayConfig } from "@/lib/types";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

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
  const [invoiceTitle, setInvoiceTitle] = useState("Tax Invoice");
  const [showLogo, setShowLogo] = useState(true);
  const [showAbn, setShowAbn] = useState(true);
  const [billToFields, setBillToFields] = useState<string[]>([]);
  const [lineItemDisplay, setLineItemDisplay] = useState<LineItemDisplayConfig>(
    {
      include_option_value: true,
      description_format: "{field_label}: {option_value}",
      show_base_price_separately: true,
    }
  );

  // Initialize form with config data
  useEffect(() => {
    if (config) {
      setInvoiceTitle(config.invoice_title || "Tax Invoice");
      setShowLogo(config.show_logo ?? true);
      setShowAbn(config.show_abn ?? true);
      setBillToFields(config.bill_to_fields || []);
      setLineItemDisplay(
        config.line_item_display || {
          include_option_value: true,
          description_format: "{field_label}: {option_value}",
          show_base_price_separately: true,
        }
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
        bill_to_fields: billToFields,
        line_item_display: lineItemDisplay,
      });
    } catch (err) {
      console.error("Failed to save invoice template config:", err);
    } finally {
      setSaving(false);
    }
  };

  const addBillToField = (fieldName: string) => {
    if (fieldName && !billToFields.includes(fieldName)) {
      setBillToFields([...billToFields, fieldName]);
    }
  };

  const removeBillToField = (fieldName: string) => {
    setBillToFields(billToFields.filter((f) => f !== fieldName));
  };

  const getAvailableFields = () => {
    return fieldConfigs.filter((field) => !billToFields.includes(field.name));
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
      <div className="text-center py-8 text-destructive">
        Error: {configError}
      </div>
    );
  }

  const availableFields = getAvailableFields();

  return (
    <div className="space-y-6">
      {/* Invoice Header Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Header Settings</CardTitle>
          <CardDescription>
            Configure how the invoice header appears to customers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Invoice Title</Label>
            <RadioGroup
              value={invoiceTitle}
              onValueChange={(value) => setInvoiceTitle(value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Invoice" id="invoice-title-invoice" />
                <Label
                  htmlFor="invoice-title-invoice"
                  className="font-normal cursor-pointer"
                >
                  Invoice
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Tax Invoice" id="invoice-title-tax" />
                <Label
                  htmlFor="invoice-title-tax"
                  className="font-normal cursor-pointer"
                >
                  Tax Invoice
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-logo">Show Logo</Label>
              <p className="text-sm text-muted-foreground">
                Display your organization logo on invoices
              </p>
            </div>
            <Switch
              id="show-logo"
              checked={showLogo}
              onCheckedChange={setShowLogo}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-abn">Show ABN</Label>
              <p className="text-sm text-muted-foreground">
                Display your Australian Business Number on invoices
              </p>
            </div>
            <Switch
              id="show-abn"
              checked={showAbn}
              onCheckedChange={setShowAbn}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bill To Field Mapping */}
      <Card>
        <CardHeader>
          <CardTitle>Bill To Fields</CardTitle>
          <CardDescription>
            Select which fields from your field configurations should appear in
            the Bill To section on invoices. Fields will be displayed in the
            order they are added.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Bill To Fields */}
          {billToFields.length > 0 && (
            <div className="space-y-2">
              <Label>Current Bill To Fields</Label>
              <div className="space-y-2">
                {billToFields.map((fieldName) => (
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
                      onClick={() => removeBillToField(fieldName)}
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
          {availableFields.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="add-bill-to-field">
                {billToFields.length > 0 ? "Add Another Field" : "Add Field"}
              </Label>
              <div className="flex gap-2">
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (value) {
                      addBillToField(value);
                    }
                  }}
                >
                  <SelectTrigger id="add-bill-to-field" className="flex-1">
                    <SelectValue placeholder="Select a field to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map((field) => (
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
                      "add-bill-to-field"
                    ) as HTMLSelectElement;
                    if (select?.value) {
                      addBillToField(select.value);
                    }
                  }}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {availableFields.length === 0 && billToFields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No field configurations available. Create fields in the Field
              Configuration settings first.
            </p>
          )}

          {availableFields.length === 0 && billToFields.length > 0 && (
            <p className="text-sm text-muted-foreground">
              All available fields have been added to Bill To section.
            </p>
          )}
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
