"use client";

import { InvoiceDocument } from "@/components/invoicing/invoice-document";
import type { CalculateInvoiceResponse } from "@/lib/services/invoice.service";
import { log } from "@/lib/logger";
import { invokeEdgeFunction } from "@/lib/supabase/invoke-edge-function";
import type {
  BillingAddressConfig,
  InvoiceWithJobs,
  ServiceAddressConfig,
} from "@/lib/types";
import { useEffect, useState } from "react";

interface InvoicePreviewProps {
  invoice: InvoiceWithJobs & {
    calculation: CalculateInvoiceResponse["calculation"];
    template_config?: {
      invoice_title?: string;
      show_logo?: boolean;
      show_abn?: boolean;
      bill_to_fields?: string[];
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
  organizationId: string | null;
}

interface OrganizationInfo {
  name: string;
  abn: string | null;
  logo_url: string | null;
  business_address: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  default_invoice_due_days: number;
  show_bank_transfer_on_invoices: boolean;
  bank_transfer_bsb: string | null;
  bank_transfer_account_number: string | null;
  bank_transfer_account_name: string | null;
  stripe_account_id: string | null;
}

export default function InvoicePreview({
  invoice,
  organizationId,
}: InvoicePreviewProps): React.ReactElement {
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);

  useEffect(() => {
    if (!organizationId) return;

    async function fetchOrgInfo(): Promise<void> {
      try {
        const data = await invokeEdgeFunction<{ settings?: Partial<OrganizationInfo> }>(
          "get-organization-settings",
          { organization_id: organizationId },
        );

        if (data?.settings) {
          setOrgInfo({
            name: data.settings.name ?? "",
            abn: data.settings.abn ?? null,
            logo_url: data.settings.logo_url ?? null,
            business_address: data.settings.business_address ?? null,
            primary_contact_email: data.settings.primary_contact_email ?? null,
            primary_contact_phone: data.settings.primary_contact_phone ?? null,
            default_invoice_due_days: data.settings.default_invoice_due_days ?? 30,
            show_bank_transfer_on_invoices:
              data.settings.show_bank_transfer_on_invoices ?? true,
            bank_transfer_bsb: data.settings.bank_transfer_bsb ?? null,
            bank_transfer_account_number:
              data.settings.bank_transfer_account_number ?? null,
            bank_transfer_account_name:
              data.settings.bank_transfer_account_name ?? null,
            stripe_account_id: data.settings.stripe_account_id ?? null,
          });
        }
      } catch (err) {
        log.error("InvoicePreview: Failed to fetch organization info", {
          error: err instanceof Error ? err.message : "Unknown error",
          organizationId,
        });
      }
    }

    fetchOrgInfo();
  }, [organizationId]);

  if (!orgInfo) {
    return (
      <div className="max-w-4xl mx-auto p-6 flex items-center justify-center min-h-[200px]">
        <p className="text-sm text-muted-foreground">Loading invoice…</p>
      </div>
    );
  }

  const calc = invoice.calculation as CalculateInvoiceResponse["calculation"] & {
    gst_registered?: boolean;
    gst_inclusive?: boolean;
    gst_amount?: number;
    subtotal_ex_gst?: number;
    currency?: string;
  };

  return (
    <InvoiceDocument
      invoice={{
        invoice_number: invoice.invoice_number,
        currency: invoice.currency,
        created_at: invoice.created_at,
        due_date: invoice.due_date,
        status: invoice.status,
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
      orgInfo={{
        name: orgInfo.name,
        abn: orgInfo.abn,
        logo_url: orgInfo.logo_url,
        business_address: orgInfo.business_address,
        primary_contact_email: orgInfo.primary_contact_email,
        primary_contact_phone: orgInfo.primary_contact_phone,
        default_invoice_due_days: orgInfo.default_invoice_due_days,
        show_bank_transfer_on_invoices: orgInfo.show_bank_transfer_on_invoices,
        bank_transfer_bsb: orgInfo.bank_transfer_bsb,
        bank_transfer_account_number: orgInfo.bank_transfer_account_number,
        bank_transfer_account_name: orgInfo.bank_transfer_account_name,
        stripe_account_id: orgInfo.stripe_account_id,
      }}
    />
  );
}
