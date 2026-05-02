"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TAX_INVOICE_THRESHOLD_AUD } from "@/lib/constants/invoice-constants";
import { formatAbn } from "@/lib/utils/format-abn";
import { format } from "date-fns";
import Image from "next/image";
import React, { useState } from "react";

export interface InvoiceDocumentOrgInfo {
  name: string;
  abn: string | null;
  logo_url: string | null;
  business_address: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  default_invoice_due_days: number;
  show_bank_transfer_on_invoices: boolean;
  bank_transfer_bsb: string | null;
  bank_transfer_account_number: string | null;
  bank_transfer_account_name: string | null;
  stripe_account_id?: string | null;
}

export interface InvoiceDocumentCalculation {
  total_subtotal: number;
  total_adjustments: number;
  total: number;
  job_calculations: Array<{
    job_id: string;
    base_price: number;
    line_items: Array<{
      field_config_id: string;
      field_name: string;
      field_label: string;
      option_value?: string;
      quantity: number;
      unit_price: number;
      total: number;
    }>;
    applied_rules: Array<{
      scope: string;
      pricing_type: string;
      amount: number;
    }>;
    total: number;
    subtotal?: number;
    total_adjustments?: number;
    worker_payment_total?: number;
    margin?: number;
  }>;
  gst_registered?: boolean;
  gst_inclusive?: boolean;
  gst_amount?: number;
  subtotal_ex_gst?: number;
  currency?: string;
}

export interface InvoiceDocumentTemplateConfig {
  invoice_title?: string;
  show_logo?: boolean;
  show_abn?: boolean;
  bill_to_fields?: string[];
  service_address_config?: {
    source: string;
    location_fields?: string[];
    form_fields?: string[];
  };
  billing_address_config?: { enabled: boolean; source: string };
  line_item_display?: {
    include_option_value?: boolean;
    description_format?: string;
    show_base_price_separately?: boolean;
  };
}

interface LocationWithHierarchy {
  id: string;
  name: string;
  email: string;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
  hierarchy_parent_id?: string | null;
}

export interface InvoiceDocumentProps {
  invoice: {
    invoice_number: string;
    currency?: string;
    created_at: string;
    due_date: string;
    status: string;
    notes?: string | null;
    total_paid?: number | null;
    template_config?: InvoiceDocumentTemplateConfig | null;
    hierarchy_metadata?: Record<
      string,
      { id: string; type: string; name: string; metadata?: Record<string, unknown> }
    >;
    invoice_job?: Array<{
      job: {
        id: string;
        completed_at: string;
        created_at: string;
        submission_data?: Record<string, unknown> | null;
        location: LocationWithHierarchy | null;
      };
    }>;
  };
  calculation: InvoiceDocumentCalculation;
  orgInfo: InvoiceDocumentOrgInfo;
}

function formatCurrency(amount: number, currency: string): string {
  const currencyLocaleMap: Record<string, string> = {
    AUD: "en-AU",
    USD: "en-US",
    GBP: "en-GB",
    EUR: "de-DE",
    CAD: "en-CA",
    NZD: "en-NZ",
  };
  const locale = currencyLocaleMap[currency] || "en-AU";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(isNaN(amount) ? 0 : amount);
}

export function InvoiceDocument({
  invoice,
  calculation,
  orgInfo,
}: InvoiceDocumentProps): React.ReactElement {
  const [logoError, setLogoError] = useState(false);

  const currency = calculation.currency ?? invoice.currency ?? "AUD";
  const templateConfig = invoice.template_config;
  const gstRegistered = calculation.gst_registered ?? false;
  const gstAmount = calculation.gst_amount ?? 0;
  const total = calculation.total;
  const totalPaid = invoice.total_paid ?? 0;

  // Resolve logo URL (kong dev replacement)
  let logoUrl: string | null = orgInfo.logo_url;
  if (logoUrl?.includes("kong:8000")) {
    logoUrl = logoUrl.replace(/http:\/\/kong:8000/, "http://127.0.0.1:54321");
  }
  if (logoUrl && !logoUrl.startsWith("http")) logoUrl = null;

  // Title: "Invoice" vs "Tax Invoice" (ATO: guided by GST only – use "Invoice" when not GST-registered or when AUD total < $82.50)
  const invoiceTitle =
    gstRegistered && (currency !== "AUD" || total >= TAX_INVOICE_THRESHOLD_AUD)
      ? "TAX INVOICE"
      : "INVOICE";

  // Sorted jobs and primary location
  const invoiceJobs = invoice.invoice_job ?? [];
  const sortedJobs =
    invoiceJobs
      .map((ij) => ij.job)
      .filter(Boolean)
      .sort((a, b) => {
        const dateA = new Date(a.completed_at || a.created_at).getTime();
        const dateB = new Date(b.completed_at || b.created_at).getTime();
        return dateA - dateB;
      }) || [];
  const firstJob = sortedJobs[0];
  const submissionData = firstJob?.submission_data;
  const primaryLocation = (invoiceJobs[0]?.job?.location ??
    (invoiceJobs.length > 0 && invoiceJobs.some((ij) => ij.job?.location)
      ? invoiceJobs.find((ij) => ij.job?.location)?.job.location
      : null)) as LocationWithHierarchy | null | undefined;

  const serviceAddressConfig = templateConfig?.service_address_config ?? {
    source: "auto",
    location_fields: ["name", "address", "contact_person", "email", "phone"],
  };
  let serviceAddressSource = serviceAddressConfig.source;
  if (serviceAddressSource === "auto") {
    serviceAddressSource = primaryLocation?.id ? "location" : "form_fields";
  }

  const serviceAddressLines: string[] = [];
  if (serviceAddressSource === "location" && primaryLocation) {
    const fields = serviceAddressConfig.location_fields ?? [
      "name",
      "address",
      "contact_person",
      "email",
      "phone",
    ];
    fields.forEach((f) => {
      const v = primaryLocation[f as keyof LocationWithHierarchy];
      if (v && String(v).trim() !== "") serviceAddressLines.push(String(v));
    });
  } else if (
    serviceAddressSource === "form_fields" &&
    submissionData &&
    serviceAddressConfig.form_fields
  ) {
    serviceAddressConfig.form_fields.forEach((fn) => {
      const v = submissionData[fn];
      if (v != null && String(v).trim() !== "") serviceAddressLines.push(String(v));
    });
  } else if (
    serviceAddressSource === "form_fields" &&
    submissionData &&
    (templateConfig?.bill_to_fields?.length ?? 0) > 0
  ) {
    (templateConfig!.bill_to_fields ?? []).forEach((fn) => {
      const v = submissionData[fn];
      if (v != null && String(v).trim() !== "") serviceAddressLines.push(String(v));
    });
  }

  const billingAddressConfig = templateConfig?.billing_address_config ?? {
    enabled: false,
    source: "auto",
  };
  const billingAddressLines: string[] = [];
  const hierarchyMetadata = invoice.hierarchy_metadata ?? {};
  const hierarchyParentId = primaryLocation?.hierarchy_parent_id;
  if (billingAddressConfig.enabled && hierarchyParentId && hierarchyMetadata[hierarchyParentId]) {
    const node = hierarchyMetadata[hierarchyParentId];
    if (node.type === "company") {
      const billing = node.metadata?.billing_address as Record<string, unknown> | undefined;
      if (billing) {
        if (billing.name) billingAddressLines.push(String(billing.name));
        if (billing.address) billingAddressLines.push(String(billing.address));
        if (billing.contact_person) billingAddressLines.push(String(billing.contact_person));
        if (billing.email) billingAddressLines.push(String(billing.email));
        if (billing.phone) billingAddressLines.push(String(billing.phone));
      }
    }
  }

  const jobCalculationsMap = new Map(calculation.job_calculations.map((c) => [c.job_id, c]));

  const getStatusBadge = (status: string) => {
    const v: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      sent: "default",
      paid: "secondary",
      overdue: "destructive",
      cancelled: "outline",
    };
    return (
      <Badge variant={v[status] || "default"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const paymentMethodParts: string[] = [];
  if (
    orgInfo.show_bank_transfer_on_invoices &&
    orgInfo.bank_transfer_bsb &&
    orgInfo.bank_transfer_account_number
  ) {
    paymentMethodParts.push("Bank transfer");
  }
  if (orgInfo.stripe_account_id) paymentMethodParts.push("Credit/Debit card");
  const paymentMethodsText =
    paymentMethodParts.length > 0 ? `Payment methods: ${paymentMethodParts.join(", ")}.` : null;

  const showAmountDue = totalPaid > 0 && totalPaid < total;
  const amountDue = total - totalPaid;
  const isPaidInFull = totalPaid >= total;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 print:p-4" id="invoice-preview">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          {logoUrl && !logoError && (
            <div className="mb-4">
              <Image
                src={logoUrl}
                alt="Company logo"
                width={120}
                height={60}
                className="h-auto object-contain"
                onError={() => setLogoError(true)}
                unoptimized
              />
            </div>
          )}
          <h1 className="text-2xl font-bold">{orgInfo.name || "Company Name"}</h1>
          {orgInfo.business_address && (
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {orgInfo.business_address}
            </p>
          )}
          {orgInfo.abn && (
            <p className="text-sm text-muted-foreground">ABN: {formatAbn(orgInfo.abn)}</p>
          )}
          {orgInfo.primary_contact_email && (
            <p className="text-sm text-muted-foreground">{orgInfo.primary_contact_email}</p>
          )}
          {orgInfo.primary_contact_phone && (
            <p className="text-sm text-muted-foreground">{orgInfo.primary_contact_phone}</p>
          )}
        </div>
        <div className="text-right space-y-1">
          <h2 className="text-3xl font-bold">{invoiceTitle}</h2>
          <p className="text-sm text-muted-foreground">#{invoice.invoice_number}</p>
        </div>
      </div>

      <Separator />

      {/* Bill To and Dates */}
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Bill To</h3>
          <div className="mb-4">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Service Address:</h4>
            {serviceAddressLines.length > 0 ? (
              <div className="space-y-1 text-sm">
                {serviceAddressLines.map((line, i) => (
                  <p key={`sa-${i}`}>{line}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No service address information available
              </p>
            )}
          </div>
          {billingAddressConfig.enabled && billingAddressLines.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Billing Address:</h4>
              <div className="space-y-1 text-sm">
                {billingAddressLines.map((line, i) => (
                  <p key={`ba-${i}`}>{line}</p>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-4 text-right">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice Date:</span>
              <span className="font-medium">
                {format(new Date(invoice.created_at), "MMM d, yyyy")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due Date:</span>
              <span className="font-medium">
                {format(new Date(invoice.due_date), "MMM d, yyyy")}
              </span>
            </div>
            {orgInfo.default_invoice_due_days != null && orgInfo.default_invoice_due_days > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment terms:</span>
                <span className="font-medium">
                  Payment due within {orgInfo.default_invoice_due_days} days of issue
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status:</span>
              {getStatusBadge(invoice.status)}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Line Items */}
      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedJobs.map((job, jobIndex) => {
              const calc = jobCalculationsMap.get(job.id);
              if (!calc) return null;
              return (
                <React.Fragment key={job.id}>
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={4} className="font-semibold">
                      Job - {format(new Date(job.completed_at || job.created_at), "MMM d, yyyy")}
                      {job.location?.name && ` - ${job.location.name}`}
                    </TableCell>
                  </TableRow>
                  {calc.base_price > 0 && (
                    <TableRow>
                      <TableCell>Base Price</TableCell>
                      <TableCell className="text-right">1</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(calc.base_price, currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(calc.base_price, currency)}
                      </TableCell>
                    </TableRow>
                  )}
                  {calc.line_items.map((item, i) => {
                    let desc = item.field_label;
                    if (
                      templateConfig?.line_item_display?.include_option_value &&
                      item.option_value
                    ) {
                      const fmt =
                        templateConfig.line_item_display.description_format ??
                        "{field_label}: {option_value}";
                      desc = fmt
                        .replace("{field_label}", item.field_label)
                        .replace("{option_value}", item.option_value!);
                    } else if (item.option_value)
                      desc = `${item.field_label}: ${item.option_value}`;
                    return (
                      <TableRow key={`${job.id}-${item.field_config_id}-${i}`}>
                        <TableCell>{desc}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unit_price, currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.total, currency)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {calc.applied_rules
                    .filter(
                      (r) =>
                        (r.scope === "global" || r.pricing_type === "conditional") && r.amount !== 0
                    )
                    .map((r, i) => (
                      <TableRow key={`${job.id}-rule-${i}`}>
                        <TableCell colSpan={3} className="text-sm text-muted-foreground">
                          {r.scope === "global" ? "Adjustment" : "Conditional Adjustment"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {r.amount >= 0 ? "+" : ""}
                          {formatCurrency(Math.abs(r.amount), currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  <TableRow className="font-medium">
                    <TableCell colSpan={3}>Job Total</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(calc.total, currency)}
                    </TableCell>
                  </TableRow>
                  {jobIndex < sortedJobs.length - 1 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-4 border-none" />
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2">
          {gstRegistered && gstAmount > 0 ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal (ex. GST):</span>
                <span className="font-medium">
                  {formatCurrency(calculation.subtotal_ex_gst ?? total - gstAmount, currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">GST:</span>
                <span className="font-medium">{formatCurrency(gstAmount, currency)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">
                  {formatCurrency(calculation.total_subtotal, currency)}
                </span>
              </div>
              {calculation.total_adjustments !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Adjustments:</span>
                  <span className="font-medium">
                    {formatCurrency(calculation.total_adjustments, currency)}
                  </span>
                </div>
              )}
            </>
          )}
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span>{formatCurrency(total, currency)}</span>
          </div>
          {showAmountDue && (
            <div className="flex justify-between text-sm font-medium">
              <span>Amount due:</span>
              <span>{formatCurrency(amountDue, currency)}</span>
            </div>
          )}
          {isPaidInFull && totalPaid > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Paid in full</span>
            </div>
          )}
        </div>
      </div>

      {invoice.notes && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Notes</h3>
            <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        </>
      )}

      {paymentMethodsText && (
        <>
          <Separator />
          <p className="text-sm text-muted-foreground">{paymentMethodsText}</p>
        </>
      )}

      {orgInfo.show_bank_transfer_on_invoices &&
        orgInfo.bank_transfer_bsb &&
        orgInfo.bank_transfer_account_number && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Payment via Bank Transfer
              </h3>
              <div className="text-sm space-y-1">
                {orgInfo.bank_transfer_account_name && (
                  <p className="font-medium">Account Name: {orgInfo.bank_transfer_account_name}</p>
                )}
                <p>
                  BSB: <span className="font-mono">{orgInfo.bank_transfer_bsb}</span>
                </p>
                <p>
                  Account Number:{" "}
                  <span className="font-mono">{orgInfo.bank_transfer_account_number}</span>
                </p>
                <p className="font-medium mt-2">Reference: {invoice.invoice_number}</p>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Note: Payments via bank transfer will not be automatically tracked. Please include
                  the invoice number in your transfer reference.
                </p>
              </div>
            </div>
          </>
        )}

      <Separator />
      <div className="text-center text-xs text-muted-foreground">
        <p>Thank you for your business!</p>
      </div>
    </div>
  );
}
