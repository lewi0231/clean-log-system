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
import type { InvoiceWithJobs } from "@/lib/types";
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
      bill_to_fields?: string[];
      line_item_display?: {
        include_option_value?: boolean;
        description_format?: string;
        show_base_price_separately?: boolean;
      };
    } | null;
  };
}

interface OrganizationInfo {
  name: string;
  abn: string | null;
  logo_url: string | null;
  primary_contact_email: string | null;
}

export default function InvoicePreview({ invoice }: InvoicePreviewProps) {
  const { organizationId } = useOrganization();
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

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

  // Extract Bill To data from job submission_data using template config fields
  const templateConfig = invoice.template_config;
  const billToFields = templateConfig?.bill_to_fields || [];

  // Get Bill To data from first job's submission_data
  const firstJob = sortedJobs[0];
  const submissionData = firstJob?.submission_data;

  // Extract values for configured Bill To fields
  const billToValues: Array<{ fieldName: string; value: string }> = [];
  if (submissionData && billToFields.length > 0) {
    billToFields.forEach((fieldName: string) => {
      const fieldValue = submissionData[fieldName];
      if (
        fieldValue !== null &&
        fieldValue !== undefined &&
        fieldValue !== ""
      ) {
        billToValues.push({
          fieldName,
          value: String(fieldValue),
        });
      }
    });
  }

  // Fallback to location if no Bill To fields are configured
  const primaryLocation =
    billToFields.length > 0
      ? null // Use mapped data instead
      : invoice.invoice_job?.[0]?.job?.location ||
        (invoice.invoice_job?.length > 0 &&
        invoice.invoice_job.some((ij) => ij.job?.location)
          ? invoice.invoice_job.find((ij) => ij.job?.location)?.job.location
          : null);

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
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              Bill To
            </h3>
            {billToFields.length > 0 ? (
              // Use mapped data from submission_data
              billToValues.length > 0 ? (
                <div className="space-y-1 text-sm">
                  {billToValues.map((item, index) => (
                    <p key={`${item.fieldName}-${index}`}>{item.value}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No Bill To information found
                </p>
              )
            ) : primaryLocation ? (
              // Fallback to location data
              <div className="space-y-1 text-sm">
                <p className="font-medium">{primaryLocation.name}</p>
                {primaryLocation.address && <p>{primaryLocation.address}</p>}
                {primaryLocation.contact_person && (
                  <p>{primaryLocation.contact_person}</p>
                )}
                {primaryLocation.email && <p>{primaryLocation.email}</p>}
                {primaryLocation.phone && <p>{primaryLocation.phone}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No location information
              </p>
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
                        ${calculation.base_price.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${calculation.base_price.toFixed(2)}
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
                          ${item.unit_price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${item.total.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* Pricing Rules Applied */}
                  {calculation.pricing_rules_applied.length > 0 &&
                    calculation.pricing_rules_applied.map((rule, ruleIndex) => (
                      <TableRow key={`${job.id}-rule-${ruleIndex}`}>
                        <TableCell
                          colSpan={3}
                          className="text-sm text-muted-foreground"
                        >
                          {rule.rule_name}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {rule.adjustment >= 0 ? "+" : ""}$
                          {rule.adjustment.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}

                  {/* Job Total */}
                  <TableRow className="font-medium">
                    <TableCell colSpan={3}>Job Total</TableCell>
                    <TableCell className="text-right">
                      ${calculation.total.toFixed(2)}
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
              ${invoice.calculation.total_subtotal.toFixed(2)}
            </span>
          </div>
          {invoice.calculation.total_adjustments !== 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Adjustments:</span>
              <span className="font-medium">
                ${invoice.calculation.total_adjustments.toFixed(2)}
              </span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span>${invoice.calculation.total.toFixed(2)}</span>
          </div>
          <div className="text-xs text-muted-foreground text-right">
            {invoice.currency}
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

      {/* Footer */}
      <Separator />
      <div className="text-center text-xs text-muted-foreground">
        <p>Thank you for your business!</p>
      </div>
    </div>
  );
}
