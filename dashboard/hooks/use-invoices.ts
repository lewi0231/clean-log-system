"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { invoicesKey } from "@/app/query-provider";
import type { CalculateInvoiceResponse } from "@/lib/services/invoice.service";
import { InvoiceService } from "@/lib/services/invoice.service";
import type {
  CreateInvoiceRequest,
  InvoiceWithJobs,
  PaginationInfo,
} from "@/lib/types";
import { useCallback } from "react";
import useOrganization from "./useOrganization";

interface UseInvoicesResult {
  invoices: InvoiceWithJobs[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  pagination?: PaginationInfo;
  calculateInvoice: (
    jobIds: string[]
  ) => Promise<CalculateInvoiceResponse["calculation"]>;
  createInvoice: (request: CreateInvoiceRequest) => Promise<InvoiceWithJobs>;
}

interface FetchInvoicesResult {
  invoices: InvoiceWithJobs[];
  pagination?: PaginationInfo;
}

async function fetchInvoices(
  organizationId: string,
  startDate?: string,
  endDate?: string,
  includeTests?: boolean,
  search?: string,
  status?: string,
  page?: number,
  pageSize?: number
): Promise<FetchInvoicesResult> {
  return InvoiceService.list({
    organization_id: organizationId,
    start_date: startDate,
    end_date: endDate,
    include_tests: includeTests,
    search,
    status,
    page,
    page_size: pageSize,
  });
}

export function useInvoices(
  startDate?: string,
  endDate?: string,
  includeTests?: boolean,
  search?: string,
  status?: string,
  page?: number,
  pageSize?: number
): UseInvoicesResult {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();
  const includeTestsSafe = includeTests ?? false;

  const query = useQuery({
    queryKey: [
      ...invoicesKey(organizationId, startDate, endDate, includeTestsSafe),
      search,
      status,
      page,
      pageSize,
    ],
    enabled: !!organizationId,
    queryFn: () =>
      fetchInvoices(
        organizationId as string,
        startDate,
        endDate,
        includeTestsSafe,
        search,
        status,
        page,
        pageSize
      ),
    select: (data) => data ?? { invoices: [], pagination: undefined },
    placeholderData: (previous) => previous,
  });

  const createMutation = useMutation({
    mutationFn: InvoiceService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: invoicesKey(
          organizationId,
          startDate,
          endDate,
          includeTestsSafe,
        ),
      });
    },
  });

  const calculateInvoice = useCallback(
    async (jobIds: string[]) => {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      return await InvoiceService.calculate({
        organization_id: organizationId,
        job_ids: jobIds,
      });
    },
    [organizationId],
  );

  const createInvoice = useCallback(
    async (request: CreateInvoiceRequest): Promise<InvoiceWithJobs> => {
      const invoice = await createMutation.mutateAsync(request);
      await query.refetch();
      return invoice;
    },
    [createMutation, query],
  );

  return {
    invoices: query.data?.invoices ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: useCallback(() => query.refetch().then(() => undefined), [query]),
    pagination: query.data?.pagination,
    calculateInvoice,
    createInvoice,
  };
}
