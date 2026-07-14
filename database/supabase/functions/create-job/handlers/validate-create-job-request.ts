import { errorResponse } from "../../_utils/http.ts";
import { createLogger } from "../../_utils/logger.ts";
import type { CreateJobContext, ValidatedCreateJobRequest } from "./types.ts";
import {
  normalizeLocationId,
  requiresLocationId,
  stripSubmissionForInsert,
} from "./submission-parsing.ts";

type EdgeLogger = ReturnType<typeof createLogger>;

/**
 * Parse JSON body and validate location / colleagues.
 * Must run only after `resolveCreateJobContext` (auth + org settings).
 */
export async function validateCreateJobRequest(
  req: Request,
  logger: EdgeLogger,
  ctx: CreateJobContext
): Promise<Response | ValidatedCreateJobRequest> {
  const { supabaseAdmin, organizationId, usePredefinedLocations } = ctx;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
    const sd = body.submissionData as Record<string, unknown> | undefined;
    logger.debug("Request body parsed for job creation", {
      hasSubmissionData: !!sd,
      submissionDataKeys: sd ? Object.keys(sd) : [],
      hasColleagueIds: !!sd?.colleague_ids,
      colleagueIdsCount: Array.isArray(sd?.colleague_ids) ? sd.colleague_ids.length : 0,
      hasLocationId: !!sd?.location_id,
    });
  } catch (parseError) {
    logger.error("Failed to parse request body", parseError);
    return errorResponse("Invalid request body", 400);
  }

  const { submissionData } = body;

  if (!submissionData || typeof submissionData !== "object") {
    logger.warn("Invalid submissionData for job creation", {
      hasSubmissionData: !!submissionData,
      type: typeof submissionData,
    });
    return errorResponse("submissionData is required", 400);
  }

  const submission = submissionData as Record<string, unknown>;
  const { colleagueIds, rawLocationId, fieldData, submissionDataJsonb } =
    stripSubmissionForInsert(submission);

  logger.debug("Extracted data from submission", {
    colleagueIdsCount: Array.isArray(colleagueIds) ? colleagueIds.length : 0,
    locationId: rawLocationId,
    fieldCount: Object.keys(fieldData).length,
  });

  logger.debug("Processed submission data", {
    submissionDataKeys: Object.keys(fieldData),
    submissionDataJsonbSize: submissionDataJsonb ? JSON.stringify(submissionDataJsonb).length : 0,
  });

  const normalizedLocationId = normalizeLocationId(rawLocationId);

  logger.debug("Location normalization", {
    originalLocationId: rawLocationId,
    normalizedLocationId,
    usePredefinedLocations,
  });

  if (requiresLocationId(usePredefinedLocations, normalizedLocationId)) {
    logger.warn("Location ID is required but not provided", {
      usePredefinedLocations,
      hasLocationId: !!normalizedLocationId,
    });
    return errorResponse("Location ID is required when predefined locations are enabled", 400);
  }

  if (normalizedLocationId) {
    logger.debug("Validating location", {
      locationId: normalizedLocationId,
      organizationId,
    });
    const { data: location, error: locationError } = await supabaseAdmin
      .from("location")
      .select("id, organization_id")
      .eq("id", normalizedLocationId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (locationError) {
      logger.error("Error validating location", locationError, {
        locationId: normalizedLocationId,
        organizationId,
      });
      throw locationError;
    }

    if (!location) {
      logger.warn("Location not found", {
        locationId: normalizedLocationId,
        organizationId,
      });
      return errorResponse("Location not found or does not belong to your organization", 400);
    }
    logger.debug("Location validated", {
      locationId: location.id,
    });
  }

  if (colleagueIds && Array.isArray(colleagueIds) && colleagueIds.length > 0) {
    logger.debug("Validating colleagues", {
      colleagueIds,
      organizationId,
    });
    const { data: colleagues, error: colleaguesError } = await supabaseAdmin
      .from("worker")
      .select("id")
      .eq("organization_id", organizationId)
      .in("id", colleagueIds);

    if (colleaguesError) {
      logger.error("Error validating colleagues", colleaguesError, {
        colleagueIds,
        organizationId,
      });
      throw colleaguesError;
    }

    if (!colleagues || colleagues.length !== colleagueIds.length) {
      logger.warn("Not all colleagues found", {
        requestedCount: colleagueIds.length,
        foundCount: colleagues?.length || 0,
        requestedIds: colleagueIds,
        foundIds: colleagues?.map((c) => c.id) || [],
      });
      return errorResponse(
        "One or more colleagues not found or do not belong to your organization",
        400
      );
    }
    logger.debug("All colleagues validated", {
      count: colleagues.length,
    });
  }

  return {
    normalizedLocationId,
    colleagueIds,
    submissionDataJsonb,
  };
}
