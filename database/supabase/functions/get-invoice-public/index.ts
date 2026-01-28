import { serve } from "server";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import {
  checkRateLimit,
  RATE_LIMIT_CONFIGS,
  rateLimitResponse,
} from "../_utils/rate-limit.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

/**
 * Public endpoint to get invoice details for viewing and payment
 * This endpoint doesn't require authentication - it's accessible via invoice ID
 * The invoice ID acts as a secret token for accessing the invoice
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "get-invoice-public" });

  // Rate limiting for public invoice access
  const rateLimitResult = await checkRateLimit(req, {
    ...RATE_LIMIT_CONFIGS.lenient,
    identifier: undefined, // Use IP address
  });

  if (!rateLimitResult.allowed) {
    logger.warn("Rate limit exceeded", {
      remaining: rateLimitResult.remaining,
      retry_after: rateLimitResult.retryAfter,
    });
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["invoice_id"]);

    if (!validation.valid) {
      return errorResponse("Invoice ID is required", 400);
    }

    const { invoice_id } = body;

    const supabase = createServiceRoleClient();

    // Fetch invoice with related jobs and location info
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoice")
      .select(
        `
        *,
        invoice_job:invoice_job (
          job:job_id (
            id,
            completed_at,
            created_at,
            submission_data,
            location:location_id (
              id,
              name,
              email,
              address,
              contact_person,
              phone,
              hierarchy_parent_id
            )
          )
        )
        `,
      )
      .eq("id", invoice_id)
      .single();

    if (invoiceError) {
      logger.error("Invoice fetch error", invoiceError, {
        invoice_id: invoice_id,
      });
      return errorResponse("Invoice not found", 404);
    }

    if (!invoice) {
      return errorResponse("Invoice not found", 404);
    }

    // Extract job IDs from invoice_job relationships
    const jobIds: string[] = [];
    if (invoice.invoice_job && Array.isArray(invoice.invoice_job)) {
      for (const invoiceJob of invoice.invoice_job) {
        if (invoiceJob.job?.id) {
          jobIds.push(invoiceJob.job.id);
        }
      }
    }

    if (jobIds.length === 0) {
      return errorResponse("Invoice has no associated jobs", 404);
    }

    // Call calculate-invoice function to get line items and calculations
    const { data: calculationData, error: calcError } = await supabase.functions
      .invoke("calculate-invoice", {
        body: {
          organization_id: invoice.organization_id,
          job_ids: jobIds,
        },
      });

    if (calcError) throw calcError;

    if (!calculationData || !calculationData.calculation) {
      return errorResponse("Failed to calculate invoice details", 500);
    }

    // Fetch organization info for display
    const { data: organization, error: orgError } = await supabase
      .from("organization")
      .select(
        "name, abn, logo_url, primary_contact_email, business_address, primary_contact_phone, stripe_account_id",
      )
      .eq("id", invoice.organization_id)
      .single();

    if (orgError) {
      logger.warn("Organization fetch error", {
        organization_id: invoice.organization_id,
        error: orgError,
      });
    }

    // Fetch organization_settings for payment and invoice display
    const { data: orgSettings } = await supabase
      .from("organization_settings")
      .select(
        "default_invoice_due_days, show_bank_transfer_on_invoices, bank_transfer_bsb, bank_transfer_account_number, bank_transfer_account_name",
      )
      .eq("organization_id", invoice.organization_id)
      .maybeSingle();

    // Flatten organization + org_settings for the response (orgInfo for InvoiceDocument)
    const organizationForDisplay = organization
      ? {
          ...organization,
          default_invoice_due_days: orgSettings?.default_invoice_due_days ??
            30,
          show_bank_transfer_on_invoices:
            orgSettings?.show_bank_transfer_on_invoices ?? true,
          bank_transfer_bsb: orgSettings?.bank_transfer_bsb ?? null,
          bank_transfer_account_number:
            orgSettings?.bank_transfer_account_number ?? null,
          bank_transfer_account_name:
            orgSettings?.bank_transfer_account_name ?? null,
        }
      : null;

    // Fetch invoice template config
    let templateConfig = null;
    const { data: configData, error: configError } = await supabase
      .from("invoice_template_config")
      .select("*")
      .eq("organization_id", invoice.organization_id)
      .single();

    if (configError && configError.code === "PGRST116") {
      // Config doesn't exist, use defaults
      templateConfig = {
        invoice_title: "Tax Invoice",
        show_logo: true,
        show_abn: true,
        bill_to_fields: [],
        service_address_config: {
          source: "auto",
          location_fields: [
            "name",
            "address",
            "contact_person",
            "email",
            "phone",
          ],
        },
        billing_address_config: {
          enabled: false,
          source: "auto",
        },
        line_item_display: {
          include_option_value: true,
          description_format: "{field_label}: {option_value}",
          show_base_price_separately: true,
        },
      };
    } else if (!configError && configData) {
      let billToFields: string[] = [];
      if (configData.bill_to_mappings) {
        const mappings = configData.bill_to_mappings as Record<string, string>;
        billToFields = Object.values(mappings).filter((v) => v);
      } else if (configData.bill_to_fields) {
        billToFields = configData.bill_to_fields;
      }

      templateConfig = {
        invoice_title: configData.invoice_title ?? "Tax Invoice",
        show_logo: configData.show_logo ?? true,
        show_abn: configData.show_abn ?? true,
        bill_to_fields: billToFields,
        service_address_config: configData.service_address_config ?? {
          source: "auto",
          location_fields: [
            "name",
            "address",
            "contact_person",
            "email",
            "phone",
          ],
        },
        billing_address_config: configData.billing_address_config ?? {
          enabled: false,
          source: "auto",
        },
        line_item_display: configData.line_item_display ?? {
          include_option_value: true,
          description_format: "{field_label}: {option_value}",
          show_base_price_separately: true,
        },
      };
    } else {
      templateConfig = {
        invoice_title: "Tax Invoice",
        show_logo: true,
        show_abn: true,
        bill_to_fields: [],
        service_address_config: {
          source: "auto",
          location_fields: [
            "name",
            "address",
            "contact_person",
            "email",
            "phone",
          ],
        },
        billing_address_config: {
          enabled: false,
          source: "auto",
        },
        line_item_display: {
          include_option_value: true,
          description_format: "{field_label}: {option_value}",
          show_base_price_separately: true,
        },
      };
    }

    // Fetch location hierarchy metadata for billing address detection
    const hierarchyParentIds: string[] = [];

    if (invoice.invoice_job && Array.isArray(invoice.invoice_job)) {
      for (const invoiceJob of invoice.invoice_job) {
        if (invoiceJob.job?.location?.hierarchy_parent_id) {
          hierarchyParentIds.push(invoiceJob.job.location.hierarchy_parent_id);
        }
      }
    }

    const hierarchyMetadata: Record<string, unknown> = {};
    if (hierarchyParentIds.length > 0) {
      const uniqueHierarchyIds = [...new Set(hierarchyParentIds)];
      const { data: hierarchyNodes, error: hierarchyError } = await supabase
        .from("location_hierarchy")
        .select("id, type, name, metadata")
        .in("id", uniqueHierarchyIds);

      if (!hierarchyError && hierarchyNodes) {
        for (const node of hierarchyNodes) {
          hierarchyMetadata[node.id] = {
            id: node.id,
            type: node.type,
            name: node.name,
            metadata: node.metadata,
          };
        }
      }
    }

    return jsonResponse({
      success: true,
      invoice: invoice,
      calculation: calculationData.calculation,
      template_config: templateConfig,
      hierarchy_metadata: hierarchyMetadata,
      organization: organizationForDisplay,
    });
  } catch (error) {
    logger.error("Get public invoice details error", error);
    const errorMessage = extractErrorMessage(
      error,
      "Failed to get invoice details",
    );
    const statusCode = getErrorStatusCode(error);
    return errorResponse(errorMessage, statusCode);
  }
});
