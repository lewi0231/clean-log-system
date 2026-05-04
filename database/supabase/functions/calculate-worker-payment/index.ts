import { serve } from "server";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { validateRequiredFields } from "../_utils/validation.ts";
import { runCalculateWorkerPaymentPersistence } from "./handlers/run-calculate-worker-payment-persistence.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, {
    functionName: "calculate-worker-payment",
  });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["organization_id", "job_ids"]);

    if (!validation.valid) {
      logger.warn("Missing required fields for worker payment calculation", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Organization ID and job IDs are required", 400);
    }

    const { organization_id, job_ids } = body;

    if (!Array.isArray(job_ids) || job_ids.length === 0) {
      logger.warn("Invalid job_ids array for worker payment calculation", {
        organization_id,
        job_ids_type: typeof job_ids,
        is_array: Array.isArray(job_ids),
        length: Array.isArray(job_ids) ? job_ids.length : 0,
      });
      return errorResponse("job_ids must be a non-empty array", 400);
    }

    return await runCalculateWorkerPaymentPersistence(req, logger, organization_id, job_ids);
  } catch (error) {
    logger.error("Calculate worker payment error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to calculate worker payment"),
      getErrorStatusCode(error)
    );
  }
});
