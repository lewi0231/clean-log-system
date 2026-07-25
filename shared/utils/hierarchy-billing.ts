/**
 * Hierarchy billing resolution and formatting.
 * Used by dashboard (@clean-log/shared) and Deno edge (re-export).
 */

export type HierarchyNodeType = "company" | "region";

export interface HierarchyBillingAddress {
  name?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  country?: string | null;
  /** @deprecated Prefer address_line1; still read for display/legacy. */
  address?: string | null;
}

export interface HierarchyBillingNode {
  id: string;
  type: string;
  name: string;
  parent_id?: string | null;
  metadata: Record<string, unknown> | null;
  active?: boolean | null;
}

export interface ResolvedHierarchyBilling {
  hierarchy_node_id: string;
  hierarchy_node_type: HierarchyNodeType;
  hierarchy_node_name: string;
  billing_address: HierarchyBillingAddress;
}

export type HierarchyBillingUsability = "email" | "display";

function trimStr(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t === "" ? null : t;
}

/** Basic email check shared with invoice-email (kept local to avoid circular deps). */
export function isBillingEmailFormat(email: string): boolean {
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email.trim());
}

/**
 * Normalize raw metadata.billing_address into a typed object.
 * Folds legacy `address` into `address_line1` when line1 is empty.
 */
export function normalizeBillingAddress(raw: unknown): HierarchyBillingAddress | null {
  // Reject null, arrays, and non-plain objects (typeof [] === "object").
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const address_line1 = trimStr(o.address_line1) ?? trimStr(o.address) ?? null;
  const normalized: HierarchyBillingAddress = {
    name: trimStr(o.name),
    contact_person: trimStr(o.contact_person),
    email: trimStr(o.email),
    phone: trimStr(o.phone),
    address_line1,
    address_line2: trimStr(o.address_line2),
    city: trimStr(o.city),
    state: trimStr(o.state),
    postcode: trimStr(o.postcode),
    country: trimStr(o.country),
  };
  // Keep legacy field for any consumer still reading it
  if (address_line1 && !trimStr(o.address_line1) && trimStr(o.address)) {
    normalized.address = address_line1;
  }
  return normalized;
}

export function extractBillingAddressFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): HierarchyBillingAddress | null {
  if (!metadata) return null;
  return normalizeBillingAddress(metadata.billing_address);
}

export function companyForcesChildrenBilling(
  metadata: Record<string, unknown> | null | undefined
): boolean {
  if (!metadata) return false;
  return metadata.use_company_billing_for_children === true;
}

export function isEmailUsableBilling(billing: HierarchyBillingAddress | null | undefined): boolean {
  if (!billing?.email) return false;
  return isBillingEmailFormat(billing.email);
}

export function isDisplayUsableBilling(
  billing: HierarchyBillingAddress | null | undefined
): boolean {
  if (!billing) return false;
  return Boolean(
    billing.name ||
    billing.address_line1 ||
    billing.address_line2 ||
    billing.city ||
    billing.state ||
    billing.postcode ||
    billing.country ||
    billing.contact_person ||
    billing.email ||
    billing.phone ||
    billing.address
  );
}

function isUsable(
  billing: HierarchyBillingAddress | null,
  predicate: HierarchyBillingUsability
): boolean {
  return predicate === "email" ? isEmailUsableBilling(billing) : isDisplayUsableBilling(billing);
}

/**
 * Pure resolution given already-loaded parent + optional company.
 * Used by async loader and unit tests.
 */
export function resolveHierarchyBillingFromNodes(
  parent: HierarchyBillingNode | null | undefined,
  company: HierarchyBillingNode | null | undefined,
  predicate: HierarchyBillingUsability
): ResolvedHierarchyBilling | null {
  if (!parent || parent.active === false) return null;

  const parentBilling = extractBillingAddressFromMetadata(parent.metadata);
  const companyBilling = company ? extractBillingAddressFromMetadata(company.metadata) : null;

  const toResolved = (
    node: HierarchyBillingNode,
    billing: HierarchyBillingAddress
  ): ResolvedHierarchyBilling | null => {
    if (node.type !== "company" && node.type !== "region") return null;
    return {
      hierarchy_node_id: node.id,
      hierarchy_node_type: node.type,
      hierarchy_node_name: node.name,
      billing_address: billing,
    };
  };

  if (parent.type === "region") {
    const companyActive = company && company.active !== false ? company : null;
    if (companyActive && companyForcesChildrenBilling(companyActive.metadata)) {
      if (isUsable(companyBilling, predicate) && companyBilling) {
        return toResolved(companyActive, companyBilling);
      }
      return null;
    }
    if (isUsable(parentBilling, predicate) && parentBilling) {
      return toResolved(parent, parentBilling);
    }
    if (companyActive && isUsable(companyBilling, predicate) && companyBilling) {
      return toResolved(companyActive, companyBilling);
    }
    return null;
  }

  if (parent.type === "company") {
    if (isUsable(parentBilling, predicate) && parentBilling) {
      return toResolved(parent, parentBilling);
    }
    return null;
  }

  return null;
}

/**
 * Format Bill To lines for invoice display / PDF.
 */
export function formatBillingAddressLines(
  billing: HierarchyBillingAddress | null | undefined
): string[] {
  if (!billing) return [];
  const lines: string[] = [];
  if (billing.name) lines.push(billing.name);
  if (billing.contact_person) lines.push(billing.contact_person);
  if (billing.address_line1) lines.push(billing.address_line1);
  else if (billing.address) lines.push(billing.address);
  if (billing.address_line2) lines.push(billing.address_line2);
  const cityLine = [billing.city, billing.state, billing.postcode].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);
  if (billing.country) lines.push(billing.country);
  if (billing.email) lines.push(billing.email);
  if (billing.phone) lines.push(billing.phone);
  return lines;
}

export function formatServiceAddressLines(
  location:
    | {
        name?: string | null;
        address?: string | null;
        contact_person?: string | null;
        email?: string | null;
        phone?: string | null;
      }
    | null
    | undefined,
  fields: string[] = ["name", "address", "contact_person", "email", "phone"]
): string[] {
  if (!location) return [];
  const lines: string[] = [];
  for (const f of fields) {
    const v = location[f as keyof typeof location];
    if (v != null && String(v).trim() !== "") lines.push(String(v).trim());
  }
  return lines;
}

/**
 * PostgREST sometimes returns a relation as an object and sometimes as a
 * single-element array. Normalize to one object or null.
 */
export function unwrapRelation<T extends object>(raw: unknown): T | null {
  if (raw == null) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as T;
}

export interface InvoiceJobLike {
  job?: unknown;
}

export interface PrimaryInvoiceLocation {
  id?: string;
  name?: string | null;
  email?: string | null;
  address?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  hierarchy_parent_id?: string | null;
}

export interface PrimaryInvoiceJobSelection {
  location: PrimaryInvoiceLocation | null;
  submission_data: Record<string, unknown> | null;
  hierarchy_parent_id: string | null;
}

/**
 * Select the primary job/location for Bill To + service address (DAP D9).
 * Uses the first invoice_job entry (array order) that has a location object —
 * same rule for React InvoiceDocument, get-invoice-*, and PDF content.
 */
export function selectPrimaryInvoiceJob(
  invoiceJobs: InvoiceJobLike[] | null | undefined
): PrimaryInvoiceJobSelection {
  const empty: PrimaryInvoiceJobSelection = {
    location: null,
    submission_data: null,
    hierarchy_parent_id: null,
  };
  if (!invoiceJobs || invoiceJobs.length === 0) return empty;

  for (const ij of invoiceJobs) {
    const job = unwrapRelation<{
      submission_data?: Record<string, unknown> | null;
      location?: unknown;
    }>(ij?.job);
    if (!job) continue;
    const location = unwrapRelation<PrimaryInvoiceLocation>(job.location);
    if (!location) continue;
    const hierarchy_parent_id =
      typeof location.hierarchy_parent_id === "string" && location.hierarchy_parent_id.trim() !== ""
        ? location.hierarchy_parent_id
        : null;
    return {
      location,
      submission_data:
        job.submission_data && typeof job.submission_data === "object" ? job.submission_data : null,
      hierarchy_parent_id,
    };
  }
  return empty;
}
