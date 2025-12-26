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
import useOrganization from "@/hooks/useOrganization";
import type { CalculateInvoiceResponse } from "@/lib/services/invoice.service";
import { supabase } from "@/lib/supabase";
import type {
  BillingAddressConfig,
  InvoiceWithJobs,
  ServiceAddressConfig,
} from "@/lib/types";
import { format } from "date-fns";
import Image from "next/image";
import React, { useEffect, useState } from "react";

interface InvoicePreviewProps {
  invoice: InvoiceWithJobs & {
    calculation: CalculateInvoiceResponse["calculation"];
    template_config?: {
      invoice_title?: string;
      show_logo?: boolean;
      show_abn?: boolean;
      bill_to_fields?: string[]; // Legacy field
      service_address_config?: ServiceAddressConfig;
      billing_address_config?: BillingAddressConfig;
      line_item_display?: {
        include_option_value?: boolean;
        description_format?: string;
        show_base_price_separately?: boolean;
      };
    } | null;
    hierarchy_metadata?: Record<
      string,
      {
        id: string;
        type: string;
        name: string;
        metadata?: Record<string, unknown>;
      }
    >;
    invoice_job?: Array<{
      job: {
        id: string;
        completed_at: string;
        created_at: string;
        submission_data?: Record<string, unknown> | null;
        location: {
          id: string;
          name: string;
          email: string;
          address: string | null;
          contact_person: string | null;
          phone: string | null;
          hierarchy_parent_id?: string | null;
        } | null;
      };
    }>;
  };
}

interface OrganizationInfo {
  name: string;
  abn: string | null;
  logo_url: string | null;
  primary_contact_email: string | null;
  bank_transfer_bsb: string | null;
  bank_transfer_account_number: string | null;
  bank_transfer_account_name: string | null;
  show_bank_transfer_on_invoices: boolean;
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

// Helper function to format currency based on invoice currency
const formatCurrency = (amount: number, currency: string): string => {
  // Map currency to locale for proper formatting
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
    currency: currency,
    maximumFractionDigits: 2,
  }).format(isNaN(amount) ? 0 : amount);
};

export default function InvoicePreview({ invoice }: InvoicePreviewProps) {
  const { organizationId } = useOrganization();
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  // Get currency from invoice
  const currency = invoice.currency || "AUD";

  useEffect(() => {
    if (!organizationId) return;

    async function fetchOrgInfo() {
      try {
        const { data, error } = await supabase.functions.invoke(
          "get-organization-settings",
          {
            body: { organization_id: organizationId },
          }
        );

        if (error) throw error;

        if (data?.settings) {
          const info: OrganizationInfo = {
            name: data.settings.name ?? "",
            abn: data.settings.abn ?? null,
            logo_url: data.settings.logo_url ?? null,
            primary_contact_email: data.settings.primary_contact_email ?? null,
            bank_transfer_bsb: data.settings.bank_transfer_bsb ?? null,
            bank_transfer_account_number:
              data.settings.bank_transfer_account_number ?? null,
            bank_transfer_account_name:
              data.settings.bank_transfer_account_name ?? null,
            show_bank_transfer_on_invoices:
              data.settings.show_bank_transfer_on_invoices ?? false,
          };
          setOrgInfo(info);

          // Normalize logo URL for local development
          let logoUrl = info.logo_url;
          if (logoUrl) {
            // Replace kong:8000 for local dev
            if (logoUrl.includes("kong:8000")) {
              logoUrl = logoUrl.replace(
                /http:\/\/kong:8000/,
                "http://127.0.0.1:54321"
              );
            }
            // Ensure URL is absolute
            if (logoUrl && !logoUrl.startsWith("http")) {
              // If it's a relative path, try to construct full URL
              logoUrl = null;
            }
            setLogoPreview(logoUrl);
            setLogoError(false);
          } else {
            setLogoPreview(null);
            setLogoError(false);
          }
        }
      } catch (err) {
        console.error("Failed to fetch organization info:", err);
        setLogoPreview(null);
        setLogoError(true);
      }
    }

    fetchOrgInfo();
  }, [organizationId]);

  // Group job calculations by job ID
  const jobCalculationsMap = new Map(
    invoice.calculation.job_calculations.map((calc) => [calc.job_id, calc])
  );

  // Get jobs sorted by completed date
  const sortedJobs =
    invoice.invoice_job
      ?.map((ij) => ij.job)
      .filter(Boolean)
      .sort((a, b) => {
        const dateA = new Date(a.completed_at || a.created_at).getTime();
        const dateB = new Date(b.completed_at || b.created_at).getTime();
        return dateA - dateB;
      }) || [];

  // Get template config and primary job data
  const templateConfig = invoice.template_config;
  const firstJob = sortedJobs[0];
  const submissionData = firstJob?.submission_data;
  const primaryLocation = (invoice.invoice_job?.[0]?.job?.location ||
    (invoice.invoice_job?.length > 0 &&
    invoice.invoice_job.some((ij) => ij.job?.location)
      ? invoice.invoice_job.find((ij) => ij.job?.location)?.job.location
      : null)) as LocationWithHierarchy | null | undefined;

  // Service Address Configuration
  const serviceAddressConfig = templateConfig?.service_address_config || {
    source: "auto",
    location_fields: ["name", "address", "contact_person", "email", "phone"],
  };

  // Determine service address source
  let serviceAddressSource = serviceAddressConfig.source;
  if (serviceAddressSource === "auto") {
    serviceAddressSource = primaryLocation?.id ? "location" : "form_fields";
  }

  // Build service address display
  const serviceAddressLines: string[] = [];

  if (serviceAddressSource === "location" && primaryLocation) {
    const locationFieldsToShow = serviceAddressConfig.location_fields || [
      "name",
      "address",
      "contact_person",
      "email",
      "phone",
    ];

    locationFieldsToShow.forEach((field) => {
      const value = primaryLocation[field as keyof typeof primaryLocation];
      if (value && String(value).trim() !== "") {
        serviceAddressLines.push(String(value));
      }
    });
  } else if (
    serviceAddressSource === "form_fields" &&
    submissionData &&
    serviceAddressConfig.form_fields
  ) {
    serviceAddressConfig.form_fields.forEach((fieldName: string) => {
      const fieldValue = submissionData[fieldName];
      if (
        fieldValue !== null &&
        fieldValue !== undefined &&
        String(fieldValue).trim() !== ""
      ) {
        serviceAddressLines.push(String(fieldValue));
      }
    });
  } else if (serviceAddressSource === "form_fields") {
    // Legacy fallback: use bill_to_fields if form_fields not configured
    const legacyBillToFields = templateConfig?.bill_to_fields || [];
    if (submissionData && legacyBillToFields.length > 0) {
      legacyBillToFields.forEach((fieldName: string) => {
        const fieldValue = submissionData[fieldName];
        if (
          fieldValue !== null &&
          fieldValue !== undefined &&
          String(fieldValue).trim() !== ""
        ) {
          serviceAddressLines.push(String(fieldValue));
        }
      });
    }
  }

  // Billing Address Configuration
  const billingAddressConfig = templateConfig?.billing_address_config || {
    enabled: false,
    source: "auto",
  };

  // Get billing address from hierarchy if enabled
  const billingAddressLines: string[] = [];
  const hierarchyMetadata = invoice.hierarchy_metadata || {};

  // Get hierarchy_parent_id from location (may not be in type but is fetched from backend)
  const hierarchyParentId = (
    primaryLocation as LocationWithHierarchy | null | undefined
  )?.hierarchy_parent_id;

  if (
    billingAddressConfig.enabled &&
    hierarchyParentId &&
    hierarchyMetadata[hierarchyParentId]
  ) {
    const hierarchyNode = hierarchyMetadata[hierarchyParentId];

    // Check if it's a company type
    if (hierarchyNode.type === "company") {
      const billingAddress = hierarchyNode.metadata?.billing_address as
        | Record<string, unknown>
        | undefined;

      if (billingAddress) {
        if (billingAddress.name) {
          billingAddressLines.push(String(billingAddress.name));
        }
        if (billingAddress.address) {
          billingAddressLines.push(String(billingAddress.address));
        }
        if (billingAddress.contact_person) {
          billingAddressLines.push(String(billingAddress.contact_person));
        }
        if (billingAddress.email) {
          billingAddressLines.push(String(billingAddress.email));
        }
        if (billingAddress.phone) {
          billingAddressLines.push(String(billingAddress.phone));
        }
      }
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      draft: "outline",
      sent: "default",
      paid: "secondary",
      overdue: "destructive",
      cancelled: "outline",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div
      className="max-w-4xl mx-auto p-6 space-y-6 print:p-4"
      id="invoice-preview"
    >
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          {logoPreview && !logoError && (
            <div className="mb-4">
              <Image
                src={logoPreview}
                alt="Company logo"
                width={120}
                height={60}
                className="h-auto object-contain"
                onError={() => {
                  setLogoError(true);
                  setLogoPreview(null);
                }}
                unoptimized
              />
            </div>
          )}
          <h1 className="text-2xl font-bold">
            {orgInfo?.name || "Company Name"}
          </h1>
          {invoice.template_config?.show_abn !== false && orgInfo?.abn && (
            <p className="text-sm text-muted-foreground">ABN: {orgInfo.abn}</p>
          )}
          {orgInfo?.primary_contact_email && (
            <p className="text-sm text-muted-foreground">
              {orgInfo.primary_contact_email}
            </p>
          )}
        </div>
        <div className="text-right space-y-1">
          <h2 className="text-3xl font-bold">
            {invoice.template_config?.invoice_title?.toUpperCase() ||
              "TAX INVOICE"}
          </h2>
          <p className="text-sm text-muted-foreground">
            #{invoice.invoice_number}
          </p>
        </div>
      </div>

      <Separator />

      {/* Invoice Details and Bill To */}
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Bill To
            </h3>

            {/* Service Address Section */}
            <div className="mb-4">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">
                Service Address:
              </h4>
              {serviceAddressLines.length > 0 ? (
                <div className="space-y-1 text-sm">
                  {serviceAddressLines.map((line, index) => (
                    <p key={`service-address-${index}`}>{line}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No service address information available
                </p>
              )}
            </div>

            {/* Billing Address Section (if enabled and available) */}
            {billingAddressConfig.enabled && billingAddressLines.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">
                  Billing Address:
                </h4>
                <div className="space-y-1 text-sm">
                  {billingAddressLines.map((line, index) => (
                    <p key={`billing-address-${index}`}>{line}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
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
              const calculation = jobCalculationsMap.get(job.id);
              if (!calculation) return null;

              return (
                <React.Fragment key={job.id}>
                  {/* Job Header */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={4} className="font-semibold">
                      Job -{" "}
                      {format(
                        new Date(job.completed_at || job.created_at),
                        "MMM d, yyyy"
                      )}
                      {job.location?.name && ` - ${job.location.name}`}
                    </TableCell>
                  </TableRow>

                  {/* Base Price if exists */}
                  {calculation.base_price > 0 && (
                    <TableRow>
                      <TableCell>Base Price</TableCell>
                      <TableCell className="text-right">1</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(calculation.base_price, currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(calculation.base_price, currency)}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Line Items */}
                  {calculation.line_items.map((item, itemIndex) => {
                    // Format description based on template config
                    const templateConfig = invoice.template_config;
                    let description = item.field_label;

                    if (
                      templateConfig?.line_item_display?.include_option_value &&
                      item.option_value
                    ) {
                      const format =
                        templateConfig.line_item_display.description_format ||
                        "{field_label}: {option_value}";
                      description = format
                        .replace("{field_label}", item.field_label)
                        .replace("{option_value}", item.option_value);
                    } else if (item.option_value) {
                      // Default format if option_value exists but no config
                      description = `${item.field_label}: ${item.option_value}`;
                    }

                    return (
                      <TableRow
                        key={`${job.id}-${item.field_config_id}-${itemIndex}`}
                      >
                        <TableCell>{description}</TableCell>
                        <TableCell className="text-right">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unit_price, currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.total, currency)}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* Pricing Rules Applied (only adjustments, not line items) */}
                  {calculation.applied_rules
                    .filter(
                      (rule) =>
                        // Only show adjustments: base, global, or conditional rules
                        // Exclude field and option scope rules as they're already shown as line items
                        (rule.scope === "base" ||
                          rule.scope === "global" ||
                          rule.pricing_type === "conditional") &&
                        rule.amount !== 0
                    )
                    .map((rule, ruleIndex) => (
                      <TableRow key={`${job.id}-rule-${ruleIndex}`}>
                        <TableCell
                          colSpan={3}
                          className="text-sm text-muted-foreground"
                        >
                          {rule.scope === "base"
                            ? "Base Price"
                            : rule.scope === "global"
                            ? "Adjustment"
                            : "Conditional Adjustment"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {rule.amount >= 0 ? "+" : ""}
                          {formatCurrency(Math.abs(rule.amount), currency)}
                        </TableCell>
                      </TableRow>
                    ))}

                  {/* Job Total */}
                  <TableRow className="font-medium">
                    <TableCell colSpan={3}>Job Total</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(calculation.total, currency)}
                    </TableCell>
                  </TableRow>

                  {/* Spacer between jobs */}
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
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-medium">
              {formatCurrency(invoice.calculation.total_subtotal, currency)}
            </span>
          </div>
          {invoice.calculation.total_adjustments !== 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Adjustments:</span>
              <span className="font-medium">
                {formatCurrency(
                  invoice.calculation.total_adjustments,
                  currency
                )}
              </span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span>{formatCurrency(invoice.calculation.total, currency)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Notes
            </h3>
            <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        </>
      )}

      {/* Bank Transfer Payment Details */}
      {orgInfo?.show_bank_transfer_on_invoices &&
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
                  <p className="font-medium">
                    Account Name: {orgInfo.bank_transfer_account_name}
                  </p>
                )}
                <p>
                  BSB:{" "}
                  <span className="font-mono">{orgInfo.bank_transfer_bsb}</span>
                </p>
                <p>
                  Account Number:{" "}
                  <span className="font-mono">
                    {orgInfo.bank_transfer_account_number}
                  </span>
                </p>
                <p className="font-medium mt-2">
                  Reference: {invoice.invoice_number}
                </p>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Note: Payments via bank transfer will not be automatically
                  tracked. Please include the invoice number in your transfer
                  reference.
                </p>
              </div>
            </div>
          </>
        )}

      {/* Footer */}
      <Separator />
      <div className="text-center text-xs text-muted-foreground">
        <p>Thank you for your business!</p>
      </div>
    </div>
  );
}
