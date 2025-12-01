import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

interface LineItem {
  field_config_id: string;
  field_name: string;
  field_label: string;
  option_value?: string; // The selected option value (for select/grouped_breakdown fields)
  quantity: number;
  unit_price: number;
  total: number;
}

interface InvoiceCalculation {
  job_id: string;
  base_price: number;
  line_items: LineItem[];
  pricing_rules_applied: Array<{
    rule_id: string;
    rule_name: string;
    adjustment: number;
  }>;
  subtotal: number;
  total_adjustments: number;
  total: number;
  worker_payment_total: number;
  margin: number;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_id",
      "job_ids",
    ]);

    if (!validation.valid) {
      return errorResponse("Organization ID and job IDs are required", 400);
    }

    const { organization_id, job_ids } = body;

    if (!Array.isArray(job_ids) || job_ids.length === 0) {
      return errorResponse("job_ids must be a non-empty array", 400);
    }

    const supabase = createServiceRoleClient();

    // Fetch jobs with location info
    const { data: jobs, error: jobsError } = await supabase
      .from("job")
      .select(
        `
        id,
        organization_id,
        location_id,
        submission_data,
        completed_at
        `
      )
      .eq("organization_id", organization_id)
      .in("id", job_ids);

    if (jobsError) throw jobsError;

    if (!jobs || jobs.length === 0) {
      return errorResponse("No jobs found", 404);
    }

    // Fetch field configs for the organization
    const { data: fieldConfigs, error: configsError } = await supabase
      .from("organization_field_configs")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("active", true)
      .order("order_position", { ascending: true });

    if (configsError) throw configsError;

    // Get unique location IDs from jobs
    const locationIds = [
      ...new Set(jobs.map((j) => j.location_id).filter(Boolean)),
    ];

    // Fetch all pricing data
    // Field pricing
    const { data: fieldPricing, error: fieldPricingError } = await supabase
      .from("field_pricing")
      .select("*")
      .eq("organization_id", organization_id)
      .or(
        locationIds.length > 0
          ? `location_id.is.null,location_id.in.(${locationIds.join(",")})`
          : "location_id.is.null"
      );

    if (fieldPricingError) throw fieldPricingError;

    // Option pricing
    const { data: optionPricing, error: optionPricingError } = await supabase
      .from("option_pricing")
      .select("*")
      .eq("organization_id", organization_id)
      .or(
        locationIds.length > 0
          ? `location_id.is.null,location_id.in.(${locationIds.join(",")})`
          : "location_id.is.null"
      );

    if (optionPricingError) throw optionPricingError;

    // Base pricing
    const { data: basePricing, error: basePricingError } = await supabase
      .from("base_pricing")
      .select("*")
      .eq("organization_id", organization_id)
      .or(
        locationIds.length > 0
          ? `location_id.is.null,location_id.in.(${locationIds.join(",")})`
          : "location_id.is.null"
      );

    if (basePricingError) throw basePricingError;

    // Calculate invoice for each job
    const calculations: InvoiceCalculation[] = [];

    for (const job of jobs) {
      const submissionData = job.submission_data || {};
      const lineItems: LineItem[] = [];
      let subtotal = 0;

      // Process field pricing (number and boolean fields)
      for (const fieldConfig of fieldConfigs || []) {
        if (
          fieldConfig.field_type !== "number" &&
          fieldConfig.field_type !== "boolean"
        ) {
          continue;
        }

        const fieldValue = submissionData[fieldConfig.name];
        if (fieldValue === null || fieldValue === undefined) {
          continue;
        }

        // Prefer location-specific, fallback to default
        const selectedPricing =
          (fieldPricing || []).find(
            (fp) =>
              fp.field_config_id === fieldConfig.id &&
              fp.location_id === job.location_id
          ) ||
          (fieldPricing || []).find(
            (fp) =>
              fp.field_config_id === fieldConfig.id && fp.location_id === null
          );

        if (!selectedPricing) {
          continue;
        }

        let quantity = 0;
        if (fieldConfig.field_type === "number") {
          quantity = typeof fieldValue === "number" ? fieldValue : 0;
        } else if (fieldConfig.field_type === "boolean") {
          quantity = fieldValue === true ? 1 : 0;
        }

        if (quantity > 0) {
          const unitPrice = selectedPricing.customer_price || 0;
          const total = quantity * unitPrice;
          subtotal += total;

          lineItems.push({
            field_config_id: fieldConfig.id,
            field_name: fieldConfig.name,
            field_label: fieldConfig.label,
            quantity,
            unit_price: unitPrice,
            total,
          });
        }
      }

      // Process option pricing (select and grouped_breakdown fields)
      for (const fieldConfig of fieldConfigs || []) {
        if (
          fieldConfig.field_type !== "select" &&
          fieldConfig.field_type !== "grouped_breakdown"
        ) {
          continue;
        }

        const fieldValue = submissionData[fieldConfig.name];
        if (fieldValue === null || fieldValue === undefined) {
          continue;
        }

        // Find pricing for this field (location-specific or default)
        const _relevantPricing = (optionPricing || []).filter(
          (op) =>
            op.field_config_id === fieldConfig.id &&
            (op.location_id === job.location_id ||
              (op.location_id === null && job.location_id === null) ||
              (op.location_id === null && job.location_id !== null))
        );

        // Prefer location-specific, fallback to default
        const locationSpecificPricing = (optionPricing || []).filter(
          (op) =>
            op.field_config_id === fieldConfig.id &&
            op.location_id === job.location_id
        );
        const defaultPricing = (optionPricing || []).filter(
          (op) =>
            op.field_config_id === fieldConfig.id && op.location_id === null
        );
        const pricingToUse =
          locationSpecificPricing.length > 0
            ? locationSpecificPricing
            : defaultPricing;

        if (fieldConfig.field_type === "select") {
          // Single value selection
          const selectedOption = Array.isArray(fieldValue)
            ? fieldValue[0]
            : fieldValue;
          const optionPricingItem = pricingToUse.find(
            (op) => op.option_value === selectedOption
          );

          if (optionPricingItem) {
            const price = optionPricingItem.customer_price || 0;
            subtotal += price;

            lineItems.push({
              field_config_id: fieldConfig.id,
              field_name: fieldConfig.name,
              field_label: fieldConfig.label,
              option_value: String(selectedOption),
              quantity: 1,
              unit_price: price,
              total: price,
            });
          }
        } else if (fieldConfig.field_type === "grouped_breakdown") {
          // Grouped breakdown: array of { brand: string, quantity: number }
          // or object with { "group_name": quantity }
          if (Array.isArray(fieldValue)) {
            // Handle array format: [{ brand: "Brand A", quantity: 10 }, ...]
            for (const item of fieldValue) {
              if (
                typeof item === "object" &&
                item !== null &&
                "brand" in item &&
                "quantity" in item
              ) {
                const groupName = String(item.brand);
                const qty =
                  typeof item.quantity === "number" ? item.quantity : 0;
                if (qty > 0) {
                  const optionPricingItem = pricingToUse.find(
                    (op) => op.option_value === groupName
                  );

                  if (optionPricingItem) {
                    const unitPrice = optionPricingItem.customer_price || 0;
                    const total = qty * unitPrice;
                    subtotal += total;

                    lineItems.push({
                      field_config_id: fieldConfig.id,
                      field_name: fieldConfig.name,
                      field_label: fieldConfig.label,
                      option_value: groupName,
                      quantity: qty,
                      unit_price: unitPrice,
                      total,
                    });
                  }
                }
              }
            }
          } else if (typeof fieldValue === "object" && fieldValue !== null) {
            // Handle object format: { "group_name": quantity }
            for (const [groupName, quantity] of Object.entries(fieldValue)) {
              const qty = typeof quantity === "number" ? quantity : 0;
              if (qty > 0) {
                const optionPricingItem = pricingToUse.find(
                  (op) => op.option_value === groupName
                );

                if (optionPricingItem) {
                  const unitPrice = optionPricingItem.customer_price || 0;
                  const total = qty * unitPrice;
                  subtotal += total;

                  lineItems.push({
                    field_config_id: fieldConfig.id,
                    field_name: fieldConfig.name,
                    field_label: fieldConfig.label,
                    option_value: groupName,
                    quantity: qty,
                    unit_price: unitPrice,
                    total,
                  });
                }
              }
            }
          }
        }
      }

      // Calculate base pricing
      let basePrice = 0;
      let baseAdjustmentType: "add" | "multiply" = "add";

      // Find base pricing (location-specific or default)
      const _basePricingForJob = (basePricing || []).find((bp) => {
        // Check if location matches
        const locationMatch =
          bp.location_id === job.location_id ||
          (bp.location_id === null && job.location_id === null) ||
          (bp.location_id === null && job.location_id !== null);

        if (!locationMatch) return false;

        // Check if it's standalone or field-based
        if (!bp.job_type_field_config_id) {
          // Standalone base pricing
          return true;
        } else {
          // Field-based: check if job has matching field value
          const fieldValue =
            submissionData[
              fieldConfigs?.find((fc) => fc.id === bp.job_type_field_config_id)
                ?.name || ""
            ];
          return fieldValue === bp.job_type_value;
        }
      });

      // Prefer location-specific, fallback to default
      const locationSpecificBase = (basePricing || []).find((bp) => {
        if (bp.location_id !== job.location_id) return false;
        if (!bp.job_type_field_config_id) return true;
        const fieldValue =
          submissionData[
            fieldConfigs?.find((fc) => fc.id === bp.job_type_field_config_id)
              ?.name || ""
          ];
        return fieldValue === bp.job_type_value;
      });

      const defaultBase = (basePricing || []).find((bp) => {
        if (bp.location_id !== null) return false;
        if (!bp.job_type_field_config_id) return true;
        const fieldValue =
          submissionData[
            fieldConfigs?.find((fc) => fc.id === bp.job_type_field_config_id)
              ?.name || ""
          ];
        return fieldValue === bp.job_type_value;
      });

      const selectedBasePricing = locationSpecificBase || defaultBase;

      if (selectedBasePricing) {
        basePrice = selectedBasePricing.customer_base_price || 0;
        baseAdjustmentType =
          (selectedBasePricing.adjustment_type as "add" | "multiply") || "add";
      }

      // Apply base pricing adjustment
      let total = subtotal;
      let totalAdjustments = 0;

      if (baseAdjustmentType === "add") {
        total = subtotal + basePrice;
        totalAdjustments = basePrice;
      } else if (baseAdjustmentType === "multiply") {
        total = subtotal * basePrice;
        totalAdjustments = total - subtotal;
      }

      // Calculate worker payment (simplified - sum worker payments from pricing)
      let workerPaymentTotal = 0;
      // Note: Worker payment calculation would need to be implemented based on pricing rules
      // For now, we'll set it to 0 as it requires more complex logic

      // Calculate margin
      const margin = total - workerPaymentTotal;

      calculations.push({
        job_id: job.id,
        base_price: basePrice,
        line_items: lineItems,
        pricing_rules_applied: [], // Pricing rules not implemented yet
        subtotal,
        total_adjustments: totalAdjustments,
        total,
        worker_payment_total: workerPaymentTotal,
        margin,
      });
    }

    // Aggregate totals across all jobs
    const aggregated = {
      total_subtotal: calculations.reduce(
        (sum, calc) => sum + calc.subtotal,
        0
      ),
      total_adjustments: calculations.reduce(
        (sum, calc) => sum + calc.total_adjustments,
        0
      ),
      total: calculations.reduce((sum, calc) => sum + calc.total, 0),
      total_worker_payment: calculations.reduce(
        (sum, calc) => sum + calc.worker_payment_total,
        0
      ),
      total_margin: calculations.reduce((sum, calc) => sum + calc.margin, 0),
      job_calculations: calculations,
    };

    return jsonResponse({
      success: true,
      calculation: aggregated,
    });
  } catch (error) {
    console.error("Calculate invoice error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to calculate invoice"
    );
  }
});
