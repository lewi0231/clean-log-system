"use client";

import type { InvoiceDocumentOrgInfo } from "@/components/invoicing/invoice-document";
import { InvoiceDocument } from "@/components/invoicing/invoice-document";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { log } from "@/lib/logger";
import type { InvoiceWithJobs } from "@/lib/types";
import type { CalculateInvoiceResponse } from "@/lib/services/invoice.service";
import { EdgeFunctionError, invokeEdgeFunction } from "@/lib/supabase/invoke-edge-function";
import { AlertCircle, CheckCircle2, CreditCard, Download, Loader2 } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

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
  calculation: CalculateInvoiceResponse["calculation"] & {
    gst_registered?: boolean;
    gst_inclusive?: boolean;
    gst_amount?: number;
    subtotal_ex_gst?: number;
    currency?: string;
  };
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

function InvoicePageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [orgInfo, setOrgInfo] = useState<InvoiceDocumentOrgInfo | null>(null);
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

        const data = await invokeEdgeFunction<{
          success?: boolean;
          /** Row may include JSON/extra keys (e.g. calculation) not modeled on InvoiceWithJobs */
          invoice?: InvoiceWithJobs & { calculation?: unknown };
          calculation?: CalculateInvoiceResponse["calculation"];
          template_config?: InvoiceData["template_config"];
          hierarchy_metadata?: InvoiceData["hierarchy_metadata"];
          organization?: Record<string, unknown>;
        }>("get-invoice-public", { invoice_id: invoiceId });

        if (!data?.success || !data.invoice || data.calculation == null) {
          throw new Error("Invoice not found");
        }

        const invoicePayload = data.invoice as InvoiceWithJobs & { calculation?: unknown };
        const { calculation: _unusedInvoiceCalculation, ...invoiceRow } = invoicePayload;

        const calculation: InvoiceData["calculation"] = data.calculation;

        setInvoice({
          ...invoiceRow,
          calculation,
          template_config: (data.template_config ?? null) as InvoiceData["template_config"],
          hierarchy_metadata: data.hierarchy_metadata as
            | InvoiceData["hierarchy_metadata"]
            | undefined,
        });

        const org = data.organization;
        const strField = (k: string): string | null => {
          const v = org?.[k];
          return typeof v === "string" ? v : null;
        };

        setOrgInfo({
          name: typeof org?.name === "string" ? org.name : "Company",
          abn: strField("abn"),
          logo_url: strField("logo_url"),
          business_address: strField("business_address"),
          primary_contact_email: strField("primary_contact_email"),
          primary_contact_phone: strField("primary_contact_phone"),
          default_invoice_due_days:
            typeof org?.default_invoice_due_days === "number" ? org.default_invoice_due_days : 30,
          show_bank_transfer_on_invoices:
            typeof org?.show_bank_transfer_on_invoices === "boolean"
              ? org.show_bank_transfer_on_invoices
              : true,
          bank_transfer_bsb: strField("bank_transfer_bsb"),
          bank_transfer_account_number: strField("bank_transfer_account_number"),
          bank_transfer_account_name: strField("bank_transfer_account_name"),
          stripe_account_id: strField("stripe_account_id"),
        });
      } catch (err) {
        const message =
          err instanceof EdgeFunctionError
            ? err.message
            : err instanceof Error
              ? err.message
              : typeof err === "string"
                ? err
                : "Failed to load invoice";
        log.error("PublicInvoice: Failed to fetch invoice", {
          error: message,
          hasInvoiceId: !!invoiceId,
          status: err instanceof EdgeFunctionError ? err.status : undefined,
        });
        setError(message);
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

      const data = await invokeEdgeFunction<{
        payment_link?: { url?: string };
      }>("create-payment-link", {
        invoice_id: invoice.id,
        organization_id: invoice.organization_id,
        success_url: `${window.location.origin}/invoice/${invoice.id}?payment=success`,
        cancel_url: `${window.location.origin}/invoice/${invoice.id}?payment=cancelled`,
      });

      if (data?.payment_link?.url) {
        window.location.href = data.payment_link.url;
      } else {
        throw new Error("Failed to create payment link");
      }
    } catch (err) {
      log.error("PublicInvoice: Failed to create payment link", {
        error: err instanceof Error ? err.message : "Unknown error",
        invoiceId: invoice?.id,
      });
    } finally {
      setPaymentLinkLoading(false);
    }
  }, [invoice, mounted]);

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

  if (error || !invoice || !orgInfo) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h1 className="text-xl font-semibold mb-2">Invoice Not Found</h1>
            <p className="text-muted-foreground">
              {error || "This invoice may have been removed or the link is invalid."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const calc = invoice.calculation;

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
                  Thank you for your payment. A confirmation email has been sent to you.
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
                  Your payment was not completed. Click &ldquo;Pay Now&rdquo; below to try again.
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
          <Button variant="outline" onClick={handleDownloadPDF} className="cursor-pointer">
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
        <CardContent className="p-0">
          <InvoiceDocument
            invoice={{
              invoice_number: invoice.invoice_number,
              currency: invoice.currency,
              created_at: invoice.created_at,
              due_date: invoice.due_date,
              status: isPaidOrJustPaid ? "paid" : invoice.status,
              notes: invoice.notes,
              total_paid: invoice.total_paid ?? undefined,
              template_config: invoice.template_config ?? undefined,
              hierarchy_metadata: invoice.hierarchy_metadata,
              invoice_job: invoice.invoice_job,
            }}
            calculation={{
              total_subtotal: calc.total_subtotal,
              total_adjustments: calc.total_adjustments,
              total: calc.total,
              job_calculations: calc.job_calculations,
              gst_registered: calc.gst_registered,
              gst_inclusive: calc.gst_inclusive,
              gst_amount: calc.gst_amount,
              subtotal_ex_gst: calc.subtotal_ex_gst,
              currency: calc.currency,
            }}
            orgInfo={orgInfo}
          />
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
