"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { useAuth } from "@/hooks/useAuth";
import { useInvoiceDetails } from "@/hooks/use-invoice-details";
import { log } from "@/lib/logger";
import { senderDisplayNameFromUser } from "@/lib/sender-display-name";
import { InvoiceService } from "@/lib/services/invoice.service";
import { getInvokeErrorMessage } from "@/lib/supabase/invoke-edge-function";
import { ExternalLink, Mail, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import InvoicePreview from "./invoice-preview";
import ManualPaymentDialog from "./manual-payment-dialog";
import PaymentHistory from "./payment-history";
import PaymentLinkButton from "./payment-link-button";
import { formatCurrency } from "./payment-utils";

interface InvoicePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
  organizationId: string | null;
}

export default function InvoicePreviewDialog({
  open,
  onOpenChange,
  invoiceId,
  organizationId,
}: InvoicePreviewDialogProps) {
  const { user } = useAuth();
  const { invoice, loading, error, refetch } = useInvoiceDetails(open ? invoiceId : null);
  const [sending, setSending] = useState(false);
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleOpenPdf = async () => {
    if (!invoiceId || !organizationId || !invoice) return;

    try {
      setGeneratingPdf(true);
      log.info("Opening invoice PDF view", { invoiceId });

      const { html, invoiceNumber } = await InvoiceService.generatePdfHtml(
        invoiceId,
        organizationId
      );

      const pdfWindow = window.open("", "_blank");
      if (!pdfWindow) {
        toast.error("Please allow pop-ups to open the invoice PDF");
        return;
      }

      pdfWindow.document.write(html);
      pdfWindow.document.close();
      pdfWindow.document.title = `Invoice-${invoiceNumber}`;

      toast.success("Invoice opened", {
        description: "Use Print → Save as PDF in the new tab if you need a file.",
      });
    } catch (err) {
      const msg = getInvokeErrorMessage(err);
      log.error("Failed to open invoice PDF", { message: msg });
      toast.error("Failed to open invoice PDF", {
        description: msg,
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSend = async () => {
    if (!invoiceId || !invoice || !organizationId) return;

    try {
      setSending(true);
      log.info("Sending invoice", { invoiceId });

      await InvoiceService.updateStatus(invoiceId, organizationId, "sent", {
        senderDisplayName: senderDisplayNameFromUser(user),
      });

      // Refetch invoice to get updated status
      await refetch();

      log.info("Invoice sent successfully");
    } catch (err) {
      const msg = getInvokeErrorMessage(err);
      log.error("Failed to send invoice", { message: msg });
      alert(`Failed to send invoice: ${msg}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
        <VisuallyHidden>
          <DialogTitle>
            {invoice ? `Invoice ${invoice.invoice_number || invoice.id}` : "Invoice Preview"}
          </DialogTitle>
        </VisuallyHidden>
        {loading && (
          <div className="p-8 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {error && (
          <div className="p-8">
            <ErrorState message={error} />
          </div>
        )}

        {!loading && !error && invoice && (
          <>
            <div className="p-6 pb-0">
              {invoice.is_test && (
                <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900">
                  <AlertTitle>Test invoice</AlertTitle>
                  <AlertDescription>
                    This invoice was generated for testing and <b>cannot</b> be sent to customers.
                  </AlertDescription>
                </Alert>
              )}
              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview">Invoice Preview</TabsTrigger>
                  <TabsTrigger value="payments">Payments</TabsTrigger>
                </TabsList>
                <TabsContent value="preview" className="mt-4">
                  <InvoicePreview invoice={invoice} organizationId={organizationId} />
                </TabsContent>
                <TabsContent value="payments" className="mt-4 space-y-6">
                  {/* Payment Summary */}
                  <div className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Payment Summary</h3>
                      {invoice.status !== "draft" && (
                        <div className="flex gap-2">
                          <PaymentLinkButton
                            invoiceId={invoice.id}
                            onLinkCreated={() => {
                              // Refetch invoice to get updated payment link
                              refetch();
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setManualPaymentOpen(true)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Record Payment
                          </Button>
                        </div>
                      )}
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Invoice Total</p>
                        <p className="text-lg font-semibold">
                          {formatCurrency(invoice.total, invoice.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Amount Paid</p>
                        <p className="text-lg font-semibold text-green-600">
                          {formatCurrency(invoice.total_paid || 0, invoice.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Remaining</p>
                        <p className="text-lg font-semibold">
                          {formatCurrency(
                            invoice.total - (invoice.total_paid || 0),
                            invoice.currency
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Payment Count</p>
                        <p className="text-lg font-semibold">{invoice.payment_count || 0}</p>
                      </div>
                    </div>
                    {invoice.payment_method_used && (
                      <div className="text-sm">
                        <p className="text-muted-foreground">
                          Payment Method:{" "}
                          <span className="font-medium">
                            {invoice.payment_method_used
                              .replace("_", " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Payment History */}
                  <div className="space-y-4 rounded-lg border p-4">
                    <h3 className="text-lg font-semibold">Payment History</h3>
                    <Separator />
                    <PaymentHistory invoiceId={invoice.id} currency={invoice.currency} />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            <DialogFooter className="p-6 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button variant="outline" onClick={handleOpenPdf} disabled={generatingPdf}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {generatingPdf ? "Opening..." : "Open PDF"}
              </Button>
              {invoice.status === "draft" && (
                <Button
                  onClick={handleSend}
                  disabled={sending || invoice.is_test === true}
                  title={invoice.is_test ? "Test invoices cannot be sent" : undefined}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {sending ? "Sending..." : "Send Invoice"}
                </Button>
              )}
            </DialogFooter>

            {/* Manual Payment Dialog */}
            {organizationId && (
              <ManualPaymentDialog
                open={manualPaymentOpen}
                onOpenChange={setManualPaymentOpen}
                invoiceId={invoice.id}
                invoiceTotal={invoice.total}
                totalPaid={invoice.total_paid || 0}
                currency={invoice.currency}
                organizationId={organizationId}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
