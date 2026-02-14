/**
 * Auto-Invoice Generation Utility
 *
 * Provides shared logic for automatically generating invoices when jobs are created or completed.
 * Used by both create-job and update-job edge functions.
 */

// Using generic type to avoid version mismatch issues between different Supabase client versions
// deno-lint-ignore no-explicit-any
type SupabaseClientType = any;

export interface AutoInvoiceResult {
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}

export interface InvoiceCalculation {
  total_subtotal: number;
  total: number;
  total_worker_payment: number;
  total_margin: number;
}

export interface AutoInvoiceOptions {
  jobId: string;
  organizationId: string;
  locationId: string | null;
  supabaseAdmin: SupabaseClientType;
  logger: {
    info: (message: string, context?: Record<string, unknown>) => void;
    debug: (message: string, context?: Record<string, unknown>) => void;
    warn: (message: string, context?: Record<string, unknown>) => void;
    error: (
      message: string,
      error?: unknown,
      context?: Record<string, unknown>,
    ) => void;
  };
  /**
   * Optional: Provide a mock calculation for testing when calculate-invoice
   * edge function is not available. When provided, bypasses the functions.invoke call.
   */
  mockCalculation?: InvoiceCalculation;
}

/**
 * Check if the organization has auto-generate invoices enabled
 */
export async function isAutoGenerateEnabled(
  supabaseAdmin: SupabaseClientType,
  organizationId: string,
  logger?: AutoInvoiceOptions["logger"],
): Promise<boolean> {
  const { data: orgSettings, error } = await supabaseAdmin
    .from("organization_settings")
    .select("auto_generate_invoices_immediately")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    // Log error but return false to be safe
    logger?.warn("Error checking auto_generate_invoices_immediately", {
      organizationId,
      error: error.message,
    });
    return false;
  }

  if (!orgSettings) {
    // No settings record exists, auto-generate is disabled
    return false;
  }

  // Explicitly check for true (handles null, undefined, false)
  return orgSettings.auto_generate_invoices_immediately === true;
}

/**
 * Check if a location has hierarchy-based auto-generate enabled
 * (which takes precedence over organization-level setting)
 */
export async function hasHierarchyAutoGenerate(
  supabaseAdmin: SupabaseClientType,
  locationId: string | null,
): Promise<boolean> {
  if (!locationId) {
    return false;
  }

  const { data: location } = await supabaseAdmin
    .from("location")
    .select("hierarchy_parent_id")
    .eq("id", locationId)
    .single();

  if (!location?.hierarchy_parent_id) {
    return false;
  }

  const { data: hierarchyNode } = await supabaseAdmin
    .from("location_hierarchy")
    .select("metadata")
    .eq("id", location.hierarchy_parent_id)
    .eq("active", true)
    .single();

  if (!hierarchyNode?.metadata) {
    return false;
  }

  const metadata = hierarchyNode.metadata as Record<string, unknown>;
  const autoGenerate = metadata.auto_generate_invoices;

  return (
    autoGenerate !== null &&
    typeof autoGenerate === "object" &&
    (autoGenerate as Record<string, unknown>).enabled === true
  );
}

/**
 * Check if an invoice already exists for a job
 */
export async function invoiceExistsForJob(
  supabaseAdmin: SupabaseClientType,
  jobId: string,
): Promise<boolean> {
  const { data: existingInvoice } = await supabaseAdmin
    .from("invoice_job")
    .select("invoice_id")
    .eq("job_id", jobId)
    .maybeSingle();

  return existingInvoice !== null;
}

/**
 * Generate an invoice number for the organization
 */
export async function generateInvoiceNumber(
  supabaseAdmin: SupabaseClientType,
  organizationId: string,
): Promise<string> {
  // Get organization code
  const { data: org } = await supabaseAdmin
    .from("organization")
    .select("org_code")
    .eq("id", organizationId)
    .single();

  if (!org) {
    throw new Error("Organization not found");
  }

  const orgCode = org.org_code;
  const year = new Date().getFullYear();

  // Get the last invoice number for this year
  const { data: existingInvoices } = await supabaseAdmin
    .from("invoice")
    .select("invoice_number")
    .eq("organization_id", organizationId)
    .like("invoice_number", `${orgCode}-${year}-%`)
    .order("invoice_number", { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (existingInvoices && existingInvoices.length > 0) {
    const lastInvoice = existingInvoices[0].invoice_number;
    const match = lastInvoice.match(/-(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${orgCode}-${year}-${nextNumber.toString().padStart(4, "0")}`;
}

/**
 * Get the organization's currency setting
 */
export async function getOrganizationCurrency(
  supabaseAdmin: SupabaseClientType,
  organizationId: string,
): Promise<string> {
  const { data: org } = await supabaseAdmin
    .from("organization")
    .select("currency")
    .eq("id", organizationId)
    .maybeSingle();

  return org?.currency || "AUD";
}

/**
 * Get the organization's default invoice due days from settings
 */
export async function getDefaultInvoiceDueDays(
  supabaseAdmin: SupabaseClientType,
  organizationId: string,
): Promise<number> {
  const { data: orgSettings } = await supabaseAdmin
    .from("organization_settings")
    .select("default_invoice_due_days")
    .eq("organization_id", organizationId)
    .maybeSingle();

  return orgSettings?.default_invoice_due_days ?? 30;
}

/**
 * Calculate the due date for an invoice
 */
export function calculateDueDate(dueDays: number = 30): string {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);
  return dueDate.toISOString();
}

/**
 * Auto-generate an invoice for a completed job
 *
 * This function handles all the logic for automatically creating an invoice
 * when a job is created or completed, if the organization has this feature enabled.
 *
 * @param options - Configuration options including job details and Supabase client
 * @returns Result object indicating success/failure and any relevant details
 */
export async function autoGenerateInvoiceForJob(
  options: AutoInvoiceOptions,
): Promise<AutoInvoiceResult> {
  const { jobId, organizationId, locationId, supabaseAdmin, logger } = options;

  try {
    // Check if organization has auto-generate enabled
    const autoGenerateEnabled = await isAutoGenerateEnabled(
      supabaseAdmin,
      organizationId,
      logger,
    );

    logger.debug("Checking auto-generate invoices setting", {
      jobId,
      organizationId,
      autoGenerateEnabled,
    });

    if (!autoGenerateEnabled) {
      logger.debug("Auto-generate invoices disabled or not configured", {
        jobId,
        organizationId,
      });
      return {
        success: true,
        skipped: true,
        skipReason: "Auto-generate invoices not enabled for organization",
      };
    }

    // Check if location has hierarchy auto-generate (takes precedence)
    const hierarchyAutoGenerate = await hasHierarchyAutoGenerate(
      supabaseAdmin,
      locationId,
    );

    if (hierarchyAutoGenerate) {
      return {
        success: true,
        skipped: true,
        skipReason:
          "Location has hierarchy auto-generate enabled (takes precedence)",
      };
    }

    // Check if invoice already exists
    const invoiceExists = await invoiceExistsForJob(supabaseAdmin, jobId);

    if (invoiceExists) {
      logger.debug("Invoice already exists for job", { jobId });
      return {
        success: true,
        skipped: true,
        skipReason: "Invoice already exists for this job",
      };
    }

    logger.info("Auto-generating invoice for job", { jobId, organizationId });

    // Get calculation - either from mock (for testing) or from calculate-invoice function
    let calculation: InvoiceCalculation;

    if (options.mockCalculation) {
      // Use mock calculation for testing when edge function server is not running
      logger.debug("Using mock calculation for testing", {
        jobId,
        mockCalculation: options.mockCalculation,
      });
      calculation = options.mockCalculation;
    } else {
      // Get an admin email for auth context when invoking calculate-invoice
      // This is needed because calculate-invoice requires organization membership verification
      const { data: adminUser } = await supabaseAdmin
        .from("organization_user")
        .select("email")
        .eq("organization_id", organizationId)
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();

      // Calculate invoice totals via edge function
      const { data: calculationData, error: calcError } = await supabaseAdmin
        .functions.invoke("calculate-invoice", {
          body: {
            organization_id: organizationId,
            job_ids: [jobId],
            email: adminUser?.email, // Pass email for auth verification
          },
        });

      if (calcError) {
        // Log detailed error information for debugging
        // For FunctionsHttpError, try to get the response body for more context
        let responseBody: unknown = null;
        if (
          calcError.name === "FunctionsHttpError" &&
          "context" in calcError &&
          typeof (calcError as { context?: { json?: () => Promise<unknown> } })
              .context?.json === "function"
        ) {
          try {
            responseBody = await (
              calcError as { context: { json: () => Promise<unknown> } }
            ).context.json();
          } catch {
            // Could not parse response body
          }
        }
        logger.error("calculate-invoice function error", calcError, {
          jobId,
          organizationId,
          hasAdminEmail: !!adminUser?.email,
          adminEmail: adminUser?.email,
          errorName: calcError.name,
          errorMessage: calcError.message,
          responseBody,
        });
        throw calcError;
      }

      if (!calculationData?.calculation) {
        logger.error("calculate-invoice returned invalid data", null, {
          jobId,
          organizationId,
          calculationData,
          hasSuccess: calculationData?.success,
          errorMessage: calculationData?.error,
        });
        throw new Error(
          calculationData?.error ||
            "Failed to calculate invoice totals - no calculation data returned",
        );
      }

      calculation = calculationData.calculation;
    }

    // Get currency, due days, and generate invoice number
    const currency = await getOrganizationCurrency(
      supabaseAdmin,
      organizationId,
    );
    const invoiceNumber = await generateInvoiceNumber(
      supabaseAdmin,
      organizationId,
    );

    // Calculate due date using organization's configured due days
    const dueDays = await getDefaultInvoiceDueDays(
      supabaseAdmin,
      organizationId,
    );
    const dueDate = calculateDueDate(dueDays);

    // Create invoice with pending_review status
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoice")
      .insert({
        organization_id: organizationId,
        invoice_number: invoiceNumber,
        status: "pending_review",
        subtotal: calculation.total_subtotal,
        total: calculation.total,
        currency: currency,
        due_date: dueDate,
      })
      .select()
      .single();

    if (invoiceError) {
      throw invoiceError;
    }

    // Link invoice to job
    const { error: linkError } = await supabaseAdmin
      .from("invoice_job")
      .insert({
        invoice_id: invoice.id,
        job_id: jobId,
      });

    if (linkError) {
      // Try to clean up the invoice if linking fails
      await supabaseAdmin.from("invoice").delete().eq("id", invoice.id);
      throw linkError;
    }

    logger.info("Auto-generated invoice successfully", {
      jobId,
      invoiceId: invoice.id,
      invoiceNumber,
    });

    return {
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoiceNumber,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to auto-generate invoice", error, {
      jobId,
      organizationId,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}
