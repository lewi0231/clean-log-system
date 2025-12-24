import { serve } from "server";
import {
  extractAuthToken,
  getAuthUser,
  getOrganizationIdFromAdmin,
  getOrganizationIdFromWorker,
  verifyOrganizationMembership,
} from "../_utils/auth.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

interface OnboardingData {
  industry_type: string;
  employee_count: "none" | "1-5" | "6-20" | "21-50" | "50+";
  abn: string;
  has_locations: boolean;
  has_workers: boolean;
  worker_payment_method: "hourly" | "per_job" | "fixed_salary" | null;
  worker_payment_frequency: "weekly" | "fortnightly" | "monthly" | null;
  invoice_frequency: "immediately" | "daily" | "weekly" | "monthly";
  invoice_weekly_day: number | null;
  invoice_monthly_day: number | null;
  review_invoices_before_sending: boolean;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "complete-onboarding" });

  try {
    const supabase = createServiceRoleClient();

    // Get auth token and user info FIRST (before parsing body)
    const token = extractAuthToken(req);
    if (!token) {
      return errorResponse("Authentication required", 401);
    }

    const authUser = await getAuthUser(token);
    if (!authUser) {
      return errorResponse("Invalid authentication token", 401);
    }

    const userId = authUser.id;
    const userEmail = authUser.email ?? null;

    // Get organization ID from authenticated user (using email from token, not body)
    let organizationId: string | null = null;
    if (userEmail) {
      organizationId = await getOrganizationIdFromAdmin(supabase, userEmail);
    }

    // Fallback: try worker lookup if admin lookup failed
    if (!organizationId) {
      organizationId = await getOrganizationIdFromWorker(supabase, userId);
    }

    if (!organizationId) {
      return errorResponse("Unable to determine organization", 401);
    }

    // Verify user is a member of the organization
    const isMember = await verifyOrganizationMembership(
      supabase,
      organizationId,
      userEmail,
      userId,
    );

    if (!isMember) {
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // NOW parse the body (after we've gotten what we need from auth)
    const body = await req.json();
    const onboardingData = body as OnboardingData;

    logger.info("Completing onboarding", {
      organizationId,
      onboardingData,
    });

    // 1. Update organization with onboarding data
    const { error: orgUpdateError } = await supabase
      .from("organization")
      .update({
        onboarding_completed_at: new Date().toISOString(),
        onboarding_data: onboardingData,
        abn: onboardingData.abn || null,
        use_predefined_locations: onboardingData.has_locations,
      })
      .eq("id", organizationId);

    if (orgUpdateError) {
      logger.error("Failed to update organization", {
        error: orgUpdateError,
      });
      throw orgUpdateError;
    }

    // 2. Configure worker payment cycle if applicable
    if (
      onboardingData.has_workers &&
      onboardingData.worker_payment_frequency
    ) {
      // Get or create organization_settings
      const { data: existingSettings } = await supabase
        .from("organization_settings")
        .select("id")
        .eq("organization_id", organizationId)
        .maybeSingle();

      const workerPaymentConfig = {
        payment_frequency: onboardingData.worker_payment_frequency,
        payment_day_of_week: 4, // Friday default
        cut_off_time: "17:00:00",
        require_approval: true,
        auto_calculate: false,
      };

      if (existingSettings) {
        const { error: settingsError } = await supabase
          .from("organization_settings")
          .update({
            worker_payment_cycle_config: workerPaymentConfig,
          })
          .eq("id", existingSettings.id);

        if (settingsError) {
          logger.error("Failed to update worker payment config", {
            error: settingsError,
          });
          // Don't throw - this is optional
        }
      } else {
        const { error: settingsError } = await supabase
          .from("organization_settings")
          .insert({
            organization_id: organizationId,
            worker_payment_cycle_config: workerPaymentConfig,
          });

        if (settingsError) {
          logger.error("Failed to create worker payment config", {
            error: settingsError,
          });
          // Don't throw - this is optional
        }
      }
    }

    // 3. Configure invoice sending
    let invoiceSendImmediately = false;
    let autoSendConfig: Record<string, unknown> | null = null;

    if (onboardingData.invoice_frequency === "immediately") {
      invoiceSendImmediately = !onboardingData
        .review_invoices_before_sending;
    } else {
      autoSendConfig = {
        enabled: true,
        period: onboardingData.invoice_frequency,
        time: "09:00",
      };

      if (onboardingData.invoice_frequency === "weekly") {
        autoSendConfig.day_of_week = onboardingData.invoice_weekly_day ?? 1; // Monday default
      } else if (onboardingData.invoice_frequency === "monthly") {
        autoSendConfig.day_of_month = onboardingData.invoice_monthly_day ?? 1;
      }
    }

    // Update organization invoice_send_immediately
    const { error: invoiceError } = await supabase
      .from("organization")
      .update({
        invoice_send_immediately: invoiceSendImmediately,
      })
      .eq("id", organizationId);

    if (invoiceError) {
      logger.error("Failed to update invoice settings", {
        error: invoiceError,
      });
      // Don't throw - continue with other settings
    }

    // Update organization_settings with auto-send config if needed
    if (autoSendConfig) {
      const { data: existingSettings } = await supabase
        .from("organization_settings")
        .select("id")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (existingSettings) {
        const { error: settingsError } = await supabase
          .from("organization_settings")
          .update({
            auto_send_invoices_config: autoSendConfig,
          })
          .eq("id", existingSettings.id);

        if (settingsError) {
          logger.error("Failed to update auto-send config", {
            error: settingsError,
          });
        }
      } else {
        const { error: settingsError } = await supabase
          .from("organization_settings")
          .insert({
            organization_id: organizationId,
            auto_send_invoices_config: autoSendConfig,
          });

        if (settingsError) {
          logger.error("Failed to create auto-send config", {
            error: settingsError,
          });
        }
      }
    }

    // 4. Determine business mode based on industry (optional enhancement)
    // For now, default to service_based
    const businessMode = "service_based";

    const { error: businessModeError } = await supabase
      .from("organization")
      .update({
        business_mode: businessMode,
      })
      .eq("id", organizationId);

    if (businessModeError) {
      logger.error("Failed to update business mode", {
        error: businessModeError,
      });
      // Don't throw - this is optional
    }

    logger.info("Onboarding completed successfully", { organizationId });

    return jsonResponse({
      success: true,
      message: "Onboarding completed successfully",
      organizationId,
    });
  } catch (error) {
    logger.error("Onboarding completion failed", {
      error: extractErrorMessage(error),
    });

    return errorResponse(
      extractErrorMessage(error),
      getErrorStatusCode(error),
    );
  }
});
