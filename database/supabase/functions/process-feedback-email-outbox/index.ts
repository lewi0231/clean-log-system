import { serve } from "server";
import { processDueFeedbackOutbox } from "../_utils/feedback-send.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

function requireCronSecret(req: Request): boolean {
  const expected = Deno.env.get("CRON_SHARED_SECRET");
  if (!expected) {
    return false;
  }
  const provided = req.headers.get("x-cron-secret");
  return !!provided && provided === expected;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, {
    functionName: "process-feedback-email-outbox",
  });

  if (!requireCronSecret(req)) {
    logger.warn("Rejected feedback outbox poller: missing/invalid cron secret");
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
