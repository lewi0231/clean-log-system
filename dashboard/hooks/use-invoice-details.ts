"use client";

import { useQuery } from "@tanstack/react-query";

import { invoiceDetailsKey } from "@/app/query-provider";
import type { CalculateInvoiceResponse } from "@/lib/services/invoice.service";
import { InvoiceService } from "@/lib/services/invoice.service";
import type { InvoiceTemplateConfig, InvoiceWithJobs } from "@/lib/types";
import type { GetInvoiceDetailsResponse } from "@/lib/types/invoice-edge";
import { useCallback } from "react";

type InvoiceDetails = InvoiceWithJobs & {
  calculation: CalculateInvoiceResponse["calculation"];
  template_config?: InvoiceTemplateConfig | null;
  hierarchy_metadata?: GetInvoiceDetailsResponse["hierarchy_metadata"];
  resolved_billing?: GetInvoiceDetailsResponse["resolved_billing"];
};

interface UseInvoiceDetailsResult {
  invoice: InvoiceDetails | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

async function fetchInvoiceDetails(invoiceId: string): Promise<InvoiceDetails> {
  return InvoiceService.getInvoiceDetails(invoiceId);
}

export function useInvoiceDetails(invoiceId: string | null): UseInvoiceDetailsResult {
  const query = useQuery({
    queryKey: invoiceDetailsKey(invoiceId),
    enabled: !!invoiceId,
    queryFn: () => fetchInvoiceDetails(invoiceId as string),
    placeholderData: (previous) => previous,
  });

  return {
    invoice: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: useCallback(() => query.refetch().then(() => undefined), [query]),
  };
}
