import { serve } from "server";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { resolveCreateJobContext } from "./handlers/resolve-create-job-context.ts";
import { runCreateJobPersistence } from "./handlers/run-create-job-persistence.ts";
import { validateCreateJobRequest } from "./handlers/validate-create-job-request.ts";

serve(async (req) => {
  const logger = createLogger(req, { functionName: "create-job" });

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const ctxOrResponse = await resolveCreateJobContext(req, logger);
    if (ctxOrResponse instanceof Response) return ctxOrResponse;

    const validatedOrResponse = await validateCreateJobRequest(req, logger, ctxOrResponse);
    if (validatedOrResponse instanceof Response) return validatedOrResponse;

    return await runCreateJobPersistence(logger, ctxOrResponse, validatedOrResponse);
  } catch (error) {
    logger.error("Create job error", error);

    return errorResponse(
      extractErrorMessage(error, "Failed to create job"),
      getErrorStatusCode(error)
    );
  }
});
