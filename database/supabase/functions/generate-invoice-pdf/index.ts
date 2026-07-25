import { serve } from "server";
import { loadEnvIfLocal } from "../_utils/env.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { gateOrganizationRequest } from "../_utils/gate-organization-request.ts";
import { generateInvoicePdfBase64 } from "../_utils/invoice-pdf.ts";
import { createLogger } from "../_utils/logger.ts";
import { uuidSchema, validateRequest } from "../_utils/zod-schemas.ts";

// Use fully qualified URL to avoid import map resolution issues
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Inline dependency is intentional for cross-function compatibility
import { z } from "https://esm.sh/zod@3.23.8";

/**
 * Schema for generating invoice PDF
 */
const generateInvoicePdfSchema = z.object({
  invoice_id: uuidSchema,
  organization_id: uuidSchema,
});

/**
 * Generate Invoice PDF Edge Function
 *
 * Returns the same pdf-lib binary used for email attachments so Open PDF
 * and Send Invoice share one document.
 */
serve(async (req: Request) => {
  await loadEnvIfLocal();

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "generate-invoice-pdf" });

  try {
    const rawBody = await req.json();

    const validation = validateRequest(generateInvoicePdfSchema, rawBody);
    if (!validation.success) {
      logger.warn("Invalid request body for generate invoice PDF", {
        errors: validation.issues,
      });
      return errorResponse(validation.error, 400);
    }

    const { invoice_id, organization_id } = validation.data;

    const gated = await gateOrganizationRequest(req, organization_id, logger);
    if (!gated.ok) return gated.response;
    const supabase = gated.ctx.supabase;

    logger.info("Generating invoice PDF", {
      invoice_id,
      organization_id,
    });

    const pdf = await generateInvoicePdfBase64(supabase, invoice_id, organization_id);

    logger.info("Invoice PDF generated successfully", {
      invoice_id,
      organization_id,
      filename: pdf.filename,
    });

    return jsonResponse({
      success: true,
      pdf_base64: pdf.base64,
      filename: pdf.filename,
      invoice_number: pdf.invoiceNumber,
    });
  } catch (error) {
    logger.error("Generate invoice PDF error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to generate invoice PDF"),
      getErrorStatusCode(error)
    );
  }
});
