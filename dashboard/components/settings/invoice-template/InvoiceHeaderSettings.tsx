"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { INVOICE_TITLE_OPTIONS } from "@/lib/constants/invoice-constants";

interface InvoiceHeaderSettingsProps {
  invoiceTitle: string;
  showLogo: boolean;
  showAbn: boolean;
  onInvoiceTitleChange: (title: string) => void;
  onShowLogoChange: (show: boolean) => void;
  onShowAbnChange: (show: boolean) => void;
}

export function InvoiceHeaderSettings({
  invoiceTitle,
  showLogo,
  showAbn,
  onInvoiceTitleChange,
  onShowLogoChange,
  onShowAbnChange,
}: InvoiceHeaderSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Header Settings</CardTitle>
        <CardDescription>
          Configure how the invoice header appears to customers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label htmlFor="invoice-title-group">Invoice Title</Label>
          <RadioGroup
            id="invoice-title-group"
            value={invoiceTitle}
            onValueChange={onInvoiceTitleChange}
            aria-label="Invoice title selection"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value={INVOICE_TITLE_OPTIONS.INVOICE}
                id="invoice-title-invoice"
              />
              <Label
                htmlFor="invoice-title-invoice"
                className="font-normal cursor-pointer"
              >
                {INVOICE_TITLE_OPTIONS.INVOICE}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value={INVOICE_TITLE_OPTIONS.TAX_INVOICE}
                id="invoice-title-tax"
              />
              <Label
                htmlFor="invoice-title-tax"
                className="font-normal cursor-pointer"
              >
                {INVOICE_TITLE_OPTIONS.TAX_INVOICE}
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
            onCheckedChange={onShowLogoChange}
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
            onCheckedChange={onShowAbnChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
