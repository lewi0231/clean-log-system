import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import {
  getInvoiceDetailsSchema,
  validateRequest,
} from "../_utils/zod-schemas.ts";

serve(async (req) => {
  const logger = createLogger(req, { functionName: "get-invoice-details" });
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const rawBody = await req.json();
    const validation = validateRequest(getInvoiceDetailsSchema, rawBody);
    if (!validation.success) {
      return errorResponse(validation.error, 400);
    }

    const { invoice_id } = validation.data as { invoice_id: string };

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
      .maybeSingle();

    if (invoiceError) throw invoiceError;

    if (!invoice) {
      return errorResponse("Invoice not found", 404);
    }

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      invoice.organization_id,
      supabase,
      rawBody as Record<string, unknown>,
    );
    if (!membershipCheck) {
      return errorResponse(
        "You do not have permission to access this invoice",
        403,
      );
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
    // Pass email for nested function auth (service role key doesn't carry user context)
    const { data: calculationData, error: calcError } = await supabase.functions
      .invoke("calculate-invoice", {
        body: {
          organization_id: invoice.organization_id,
          job_ids: jobIds,
          email: membershipCheck.userEmail, // Pass verified email for nested auth
        },
      });

    if (calcError) throw calcError;

    if (!calculationData || !calculationData.calculation) {
      return errorResponse("Failed to calculate invoice details", 500);
    }

    // Fetch invoice template config (or create default if doesn't exist)
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
      // Handle migration: if bill_to_mappings exists, convert to bill_to_fields
      let billToFields: string[] = [];
      if (configData.bill_to_mappings) {
        // Convert old format to new format
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
      // Use defaults on error
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
    const locationIds: string[] = [];
    const hierarchyParentIds: string[] = [];

    if (invoice.invoice_job && Array.isArray(invoice.invoice_job)) {
      for (const invoiceJob of invoice.invoice_job) {
        if (invoiceJob.job?.location?.id) {
          locationIds.push(invoiceJob.job.location.id);
        }
        if (invoiceJob.job?.location?.hierarchy_parent_id) {
          hierarchyParentIds.push(invoiceJob.job.location.hierarchy_parent_id);
        }
      }
    }

    // Fetch hierarchy nodes for billing address detection
    const hierarchyMetadata: Record<string, unknown> = {};
    if (hierarchyParentIds.length > 0) {
      const uniqueHierarchyIds = [...new Set(hierarchyParentIds)];
      const { data: hierarchyNodes, error: hierarchyError } = await supabase
        .from("location_hierarchy")
        .select("id, type, name, metadata")
        .in("id", uniqueHierarchyIds);

      if (!hierarchyError && hierarchyNodes) {
        // Build metadata map keyed by hierarchy ID
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
    });
  } catch (error) {
    logger.error("Get invoice details error", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to get invoice details",
    );
  }
});
