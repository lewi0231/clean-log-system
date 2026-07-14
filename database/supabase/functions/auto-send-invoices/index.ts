import { serve } from "server";
import { errorResponse, handleCors } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { runAutoSendInvoicesPersistence } from "./handlers/run-auto-send-invoices-persistence.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "auto-send-invoices" });

  try {
    const supabase = createServiceRoleClient();
    const now = new Date();
    return await runAutoSendInvoicesPersistence(supabase, now, logger);
  } catch (error) {
    logger.error("Auto-send invoices error", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to auto-send invoices",
      500
    );
  }
});
