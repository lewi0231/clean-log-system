export interface LocationHierarchyNode {
  id: string;
  organization_id: string;
  type: string;
  metadata: Record<string, unknown> | null;
  name: string;
}

export interface Location {
  id: string;
  hierarchy_parent_id: string | null;
}

export interface InvoiceJob {
  job?:
    | {
        location_id?: string;
      }
    | {
        location_id?: string;
      }[]
    | null;
}

export interface DraftInvoice {
  id: string;
  invoice_number: string;
  organization_id: string;
  invoice_job?: InvoiceJob[] | null;
}

/** Invoice with full details from Supabase query */
export interface InvoiceWithDetails {
  id: string;
  invoice_number: string;
  total: number;
  currency: string;
  due_date: string;
  invoice_job?: Array<{
    job?: {
      id: string;
      location_id: string | null;
      submission_data: unknown;
      location?: {
        id: string;
        email: string | null;
        contact_person: string | null;
        hierarchy_parent_id: string | null;
      } | null;
    } | null;
  }> | null;
}

export interface AutoSendConfig {
  enabled: boolean;
  period: "daily" | "weekly" | "monthly";
  day_of_week?: number;
  day_of_month?: number;
  time?: string;
}
