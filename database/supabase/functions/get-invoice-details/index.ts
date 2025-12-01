import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

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
              phone
            )
          )
        )
        `
      )
      .eq("id", invoice_id)
      .single();

    if (invoiceError) throw invoiceError;

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
    const { data: calculationData, error: calcError } =
      await supabase.functions.invoke("calculate-invoice", {
        body: {
          organization_id: invoice.organization_id,
          job_ids: jobIds,
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
        line_item_display: {
          include_option_value: true,
          description_format: "{field_label}: {option_value}",
          show_base_price_separately: true,
        },
      };
    }

    return jsonResponse({
      success: true,
      invoice: invoice,
      calculation: calculationData.calculation,
      template_config: templateConfig,
    });
  } catch (error) {
    console.error("Get invoice details error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to get invoice details"
    );
  }
});
