"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useInvoiceDetails } from "@/hooks/use-invoice-details";
import { log } from "@/lib/logger";
import { InvoiceService } from "@/lib/services/invoice.service";
import { Mail, Printer } from "lucide-react";
import { useState } from "react";
import InvoicePreview from "./invoice-preview";

interface InvoicePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
}

export default function InvoicePreviewDialog({
  open,
  onOpenChange,
  invoiceId,
}: InvoicePreviewDialogProps) {
  const { invoice, loading, error, refetch } = useInvoiceDetails(
    open ? invoiceId : null
  );
  const [sending, setSending] = useState(false);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const invoiceElement = document.getElementById("invoice-preview");
    if (!invoiceElement) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice?.invoice_number || ""}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              padding: 20px;
              color: #000;
              background: #fff;
            }
            ${document.querySelector("style")?.innerHTML || ""}
          </style>
        </head>
        <body>
          ${invoiceElement.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleSend = async () => {
    if (!invoiceId || !invoice) return;

    try {
      setSending(true);
      log.info("Sending invoice", { invoiceId });

      await InvoiceService.updateStatus(invoiceId, "sent");

      // Refetch invoice to get updated status
      await refetch();

      log.info("Invoice sent successfully");
    } catch (err) {
      log.error("Failed to send invoice", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      alert("Failed to send invoice. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
        {loading && (
          <div className="p-8">
            <LoadingState message="Loading invoice details..." />
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
              <InvoicePreview invoice={invoice} />
            </div>
            <DialogFooter className="p-6 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              {invoice.status === "draft" && (
                <Button onClick={handleSend} disabled={sending}>
                  <Mail className="mr-2 h-4 w-4" />
                  {sending ? "Sending..." : "Send Invoice"}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
