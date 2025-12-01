"use client";

import type { CalculateInvoiceResponse } from "@/lib/services/invoice.service";
import { InvoiceService } from "@/lib/services/invoice.service";
import type { InvoiceWithJobs } from "@/lib/types";
import { useEffect, useState } from "react";

interface UseInvoiceDetailsResult {
  invoice:
    | (InvoiceWithJobs & {
        calculation: CalculateInvoiceResponse["calculation"];
        template_config?: any;
      })
    | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useInvoiceDetails(
  invoiceId: string | null
): UseInvoiceDetailsResult {
  const [invoice, setInvoice] = useState<
    | (InvoiceWithJobs & {
        calculation: CalculateInvoiceResponse["calculation"];
      })
    | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoiceDetails = async () => {
    if (!invoiceId) {
      setLoading(false);
      setInvoice(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const details = await InvoiceService.getInvoiceDetails(invoiceId);
      setInvoice(details);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch invoice details"
      );
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoiceDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  return {
    invoice,
    loading,
    error,
    refetch: fetchInvoiceDetails,
  };
}
