/**
 * Pure helpers for create-job submission shaping — shared with unit tests.
 */

/** Normalize location_id: empty or whitespace-only → null */
export function normalizeLocationId(locationId: string | undefined): string | null {
  return locationId && locationId.trim() !== "" ? locationId : null;
}

export type StrippedSubmission = {
  colleagueIds: string[] | undefined;
  rawLocationId: string | undefined;
  fieldData: Record<string, unknown>;
  submissionDataJsonb: Record<string, unknown> | null;
};

/** Mirror monolith: strip colleague_ids / location_id; remainder → JSONB column */
export function stripSubmissionForInsert(
  submissionData: Record<string, unknown>
): StrippedSubmission {
  const colleagueIds = submissionData.colleague_ids as string[] | undefined;
  const rawLocationId = submissionData.location_id as string | undefined;

  const { colleague_ids: _colleague_ids, location_id: _location_id, ...fieldData } = submissionData;

  const submissionDataJsonb = Object.keys(fieldData).length > 0 ? fieldData : null;

  return {
    colleagueIds,
    rawLocationId,
    fieldData,
    submissionDataJsonb,
  };
}

/** True when org requires a predefined location but none was provided */
export function requiresLocationId(
  usePredefinedLocations: boolean,
  normalizedLocationId: string | null
): boolean {
  return usePredefinedLocations && !normalizedLocationId;
}
