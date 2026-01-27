"use client";

import InvoicePreview from "@/components/invoicing/invoice-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvoiceDetails } from "@/hooks/use-invoice-details";
import useOrganization from "@/hooks/useOrganization";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { use } from "react";

interface InvoicePageProps {
  params: Promise<{ id: string }>;
}

export default function InvoicePage({ params }: InvoicePageProps) {
  const { id } = use(params);
  const { invoice, loading, error } = useInvoiceDetails(id);
  const { organizationId } = useOrganization();

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
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              padding: 20px;
              color: #333;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              padding: 8px 12px;
              text-align: left;
              border-bottom: 1px solid #eee;
            }
            th {
              font-weight: 600;
              color: #666;
            }
            .text-right {
              text-align: right;
            }
            .font-bold {
              font-weight: bold;
            }
            .text-muted {
              color: #666;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          ${invoiceElement.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-6">
          <Link href="/dashboard/invoicing">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Invoices
            </Button>
          </Link>
        </div>
        <ErrorState
          title="Invoice Not Found"
          message={
            error ||
            "The invoice you're looking for doesn't exist or has been deleted."
          }
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/invoicing">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Invoices
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              Invoice #{invoice.invoice_number}
            </h1>
            <p className="text-sm text-muted-foreground">
              View and print invoice details
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      {invoice.is_test && (
        <div className="mb-6">
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTitle>Test invoice</AlertTitle>
            <AlertDescription className="text-nowrap inline">
              This invoice was generated for testing and{" "}
              <b className="">cannot</b> be sent to customers.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <Separator className="mb-6" />

      {/* Invoice Preview */}
      <div className="bg-white dark:bg-card rounded-lg shadow-sm border p-6">
        <InvoicePreview invoice={invoice} organizationId={organizationId} />
      </div>
    </div>
  );
}
