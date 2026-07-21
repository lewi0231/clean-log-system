import { serve } from "server";
import { requireCronSecret } from "../_utils/cron-secret.ts";
import { processDueFeedbackOutbox } from "../_utils/feedback-send.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, {
    functionName: "process-feedback-email-outbox",
  });

  const auth = requireCronSecret(req);
  if (!auth.ok) {
    if (auth.reason === "missing_config") {
      logger.error("CRON_SHARED_SECRET is not configured — refusing poller requests");
    } else {
      logger.warn("Rejected feedback outbox poller", { reason: auth.reason });
    }
    return errorResponse("Unauthorized", 401);
  }

  try {
    const supabase = createServiceRoleClient();
    const summary = await processDueFeedbackOutbox(supabase);
    logger.info("Feedback outbox poller completed", summary);
    return jsonResponse({ success: true, ...summary }, 200);
  } catch (error) {
    logger.error("process-feedback-email-outbox error", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to process feedback outbox",
      500
    );
  }
});
