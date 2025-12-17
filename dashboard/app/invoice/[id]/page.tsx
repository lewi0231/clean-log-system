"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CalculateInvoiceResponse } from "@/lib/services/invoice.service";
import { supabase } from "@/lib/supabase";
import type { InvoiceWithJobs } from "@/lib/types";
import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Download,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

interface InvoiceLineItem {
  field_config_id: string;
  field_name: string;
  field_label: string;
  option_value?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface InvoiceJob {
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
}

interface InvoiceData extends Omit<InvoiceWithJobs, "invoice_job"> {
  calculation: CalculateInvoiceResponse["calculation"];
  template_config?: {
    invoice_title?: string;
    show_logo?: boolean;
    show_abn?: boolean;
    bill_to_fields?: string[];
    service_address_config?: {
      source: "auto" | "location" | "form_fields";
      location_fields?: string[];
      form_fields?: string[];
    };
    billing_address_config?: {
      enabled: boolean;
      source: "auto" | "hierarchy";
    };
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
  invoice_job?: InvoiceJob[];
}

interface OrganizationInfo {
  name: string;
  abn: string | null;
  logo_url: string | null;
  primary_contact_email: string | null;
}

// Helper function to format currency based on invoice currency
const formatCurrency = (amount: number, currency: string): string => {
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

// Safe date formatter to avoid hydration issues
const formatDate = (dateString: string): string => {
  try {
    return format(new Date(dateString), "MMM d, yyyy");
  } catch {
    return dateString;
  }
};

function InvoicePageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentLinkLoading, setPaymentLinkLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Check for payment success/cancelled query params
  const paymentStatus = searchParams.get("payment");

  // Track when component mounts to avoid hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine if payment was successful (either status=paid or just completed payment)
  const isPaidOrJustPaid = useMemo(() => {
    return invoice?.status === "paid" || paymentStatus === "success";
  }, [invoice?.status, paymentStatus]);

  // Fetch invoice details
  useEffect(() => {
    async function fetchInvoice() {
      if (!invoiceId) return;

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase.functions.invoke(
          "get-invoice-public",
          {
            body: { invoice_id: invoiceId },
          }
        );

        if (fetchError) throw fetchError;

        if (!data?.success || !data.invoice) {
          throw new Error("Invoice not found");
        }

        setInvoice({
          ...data.invoice,
          calculation: data.calculation,
          template_config: data.template_config,
          hierarchy_metadata: data.hierarchy_metadata,
        });

        // Set organization info
        if (data.organization) {
          const info: OrganizationInfo = {
            name: data.organization.name ?? "",
            abn: data.organization.abn ?? null,
            logo_url: data.organization.logo_url ?? null,
            primary_contact_email:
              data.organization.primary_contact_email ?? null,
          };
          setOrgInfo(info);

          // Handle logo URL
          let logoUrl = info.logo_url;
          if (logoUrl) {
            if (logoUrl.includes("kong:8000")) {
              logoUrl = logoUrl.replace(
                /http:\/\/kong:8000/,
                "http://127.0.0.1:54321"
              );
            }
            if (logoUrl && !logoUrl.startsWith("http")) {
              logoUrl = null;
            }
            setLogoPreview(logoUrl);
            setLogoError(false);
          }
        }
      } catch (err) {
        console.error("Failed to fetch invoice:", err);
        setError(err instanceof Error ? err.message : "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    }

    fetchInvoice();
  }, [invoiceId]);

  // Handle PDF download
  const handleDownloadPDF = useCallback(() => {
    if (!invoice) return;
    window.print();
  }, [invoice]);

  // Handle Pay Now click
  const handlePayNow = useCallback(async () => {
    if (!invoice || !mounted) return;

    try {
      setPaymentLinkLoading(true);

      const { data, error: linkError } = await supabase.functions.invoke(
        "create-payment-link",
        {
          body: {
            invoice_id: invoice.id,
            organization_id: invoice.organization_id,
            success_url: `${window.location.origin}/invoice/${invoice.id}?payment=success`,
            cancel_url: `${window.location.origin}/invoice/${invoice.id}?payment=cancelled`,
          },
        }
      );

      if (linkError) throw linkError;

      if (data?.payment_link?.url) {
        window.location.href = data.payment_link.url;
      } else {
        throw new Error("Failed to create payment link");
      }
    } catch (err) {
      console.error("Failed to create payment link:", err);
    } finally {
      setPaymentLinkLoading(false);
    }
  }, [invoice, mounted]);

  // Memoized calculations
  const currency = useMemo(() => invoice?.currency || "AUD", [invoice]);

  const sortedJobs = useMemo(() => {
    if (!invoice?.invoice_job) return [];
    return invoice.invoice_job
      .map((ij) => ij.job)
      .filter(Boolean)
      .sort((a, b) => {
        const dateA = new Date(a.completed_at || a.created_at).getTime();
        const dateB = new Date(b.completed_at || b.created_at).getTime();
        return dateA - dateB;
      });
  }, [invoice]);

  const jobCalculationsMap = useMemo(() => {
    if (!invoice?.calculation?.job_calculations) return new Map();
    return new Map(
      invoice.calculation.job_calculations.map((calc) => [calc.job_id, calc])
    );
  }, [invoice]);

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
        <div className="max-w-4xl mx-auto pt-4">
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="flex justify-between">
                <Skeleton className="h-16 w-32" />
                <Skeleton className="h-10 w-48" />
              </div>
              <Skeleton className="h-px w-full" />
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h1 className="text-xl font-semibold mb-2">Invoice Not Found</h1>
            <p className="text-muted-foreground">
              {error ||
                "This invoice may have been removed or the link is invalid."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryLocation = invoice.invoice_job?.[0]?.job?.location;

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8 print:p-0 print:bg-white">
      {/* Payment Status Banner */}
      {paymentStatus === "success" && (
        <div className="max-w-4xl mx-auto mb-4 pt-4 print:hidden">
          <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-200">
                  Payment Successful!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Thank you for your payment. A confirmation email has been sent
                  to you.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {paymentStatus === "cancelled" && (
        <div className="max-w-4xl mx-auto mb-4 pt-4 print:hidden">
          <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                  Payment Cancelled
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Your payment was not completed. Click &ldquo;Pay Now&rdquo;
                  below to try again.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Buttons - Only show when not loading and mounted */}
      {mounted && (
        <div
          className={`max-w-4xl mx-auto mb-4 flex gap-3 justify-end print:hidden ${
            !paymentStatus ? "pt-4" : ""
          }`}
        >
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          {/* Only show Pay Now if not paid and not just successfully paid */}
          {!isPaidOrJustPaid && (
            <Button onClick={handlePayNow} disabled={paymentLinkLoading}>
              {paymentLinkLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay Now
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Invoice Card */}
      <Card className="max-w-4xl mx-auto print:shadow-none print:border-none">
        <CardContent className="p-6 md:p-8 space-y-6">
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
                <p className="text-sm text-muted-foreground">
                  ABN: {orgInfo.abn}
                </p>
              )}
              {orgInfo?.primary_contact_email && (
                <p className="text-sm text-muted-foreground">
                  {orgInfo.primary_contact_email}
                </p>
              )}
            </div>
            <div className="text-right space-y-1">
              <h2 className="text-3xl font-bold text-primary">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  Bill To
                </h3>
                {primaryLocation ? (
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">{primaryLocation.name}</p>
                    {primaryLocation.address && (
                      <p>{primaryLocation.address}</p>
                    )}
                    {primaryLocation.contact_person && (
                      <p>{primaryLocation.contact_person}</p>
                    )}
                    {primaryLocation.email && <p>{primaryLocation.email}</p>}
                    {primaryLocation.phone && <p>{primaryLocation.phone}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No billing information available
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-4 md:text-right">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between md:justify-end md:gap-4">
                  <span className="text-muted-foreground">Invoice Date:</span>
                  <span className="font-medium">
                    {formatDate(invoice.created_at)}
                  </span>
                </div>
                <div className="flex justify-between md:justify-end md:gap-4">
                  <span className="text-muted-foreground">Due Date:</span>
                  <span className="font-medium">
                    {formatDate(invoice.due_date)}
                  </span>
                </div>
                <div className="flex justify-between md:justify-end md:gap-4 items-center">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge
                    variant={
                      isPaidOrJustPaid
                        ? "secondary"
                        : invoice.status === "sent"
                        ? "default"
                        : invoice.status === "overdue"
                        ? "destructive"
                        : "outline"
                    }
                    className={
                      isPaidOrJustPaid
                        ? "bg-green-100 text-green-800 border-green-200"
                        : ""
                    }
                  >
                    {isPaidOrJustPaid
                      ? "Paid"
                      : invoice.status.charAt(0).toUpperCase() +
                        invoice.status.slice(1)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Line Items */}
          <div className="overflow-x-auto">
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
                          Job - {formatDate(job.completed_at || job.created_at)}
                          {job.location?.name && ` - ${job.location.name}`}
                        </TableCell>
                      </TableRow>

                      {/* Base Price */}
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
                      {calculation.line_items.map(
                        (item: InvoiceLineItem, itemIndex: number) => {
                          let description = item.field_label;
                          if (item.option_value) {
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
                        }
                      )}

                      {/* Job Total */}
                      <TableRow className="font-medium">
                        <TableCell colSpan={3}>Job Total</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(calculation.total, currency)}
                        </TableCell>
                      </TableRow>

                      {/* Spacer */}
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
                <span>{isPaidOrJustPaid ? "Amount Paid:" : "Total Due:"}</span>
                <span
                  className={
                    isPaidOrJustPaid ? "text-green-600" : "text-primary"
                  }
                >
                  {formatCurrency(invoice.calculation.total, currency)}
                </span>
              </div>
              {isPaidOrJustPaid && (
                <div className="flex items-center justify-end gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Payment received - Thank you!</span>
                </div>
              )}
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
        </CardContent>
      </Card>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// Wrap in Suspense to handle useSearchParams
export default function PublicInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
          <div className="max-w-4xl mx-auto pt-4">
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="flex justify-between">
                  <Skeleton className="h-16 w-32" />
                  <Skeleton className="h-10 w-48" />
                </div>
                <Skeleton className="h-px w-full" />
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <InvoicePageContent />
    </Suspense>
  );
}
