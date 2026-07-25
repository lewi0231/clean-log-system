/**
 * Resolve feedback destination for public /review landing pages.
 * Prefer send-time snapshots so later Settings edits do not rewrite offered CTAs.
 */

export type FeedbackRequestMode = "internal" | "public" | "both";

const VALID_MODES = new Set<FeedbackRequestMode>(["internal", "public", "both"]);

export function normalizeFeedbackRequestMode(value: unknown): FeedbackRequestMode {
  if (typeof value === "string" && VALID_MODES.has(value as FeedbackRequestMode)) {
    return value as FeedbackRequestMode;
  }
  return "internal";
}

export function resolveFeedbackLandingMode(params: {
  modeAtSend: unknown;
  liveMode: unknown;
}): FeedbackRequestMode {
  if (typeof params.modeAtSend === "string" && params.modeAtSend.trim()) {
    return normalizeFeedbackRequestMode(params.modeAtSend);
  }
  return normalizeFeedbackRequestMode(params.liveMode);
}

export function resolveFeedbackLandingPublicUrl(params: {
  urlAtSend: unknown;
  livePublicUrl: unknown;
}): string | null {
  if (typeof params.urlAtSend === "string" && params.urlAtSend.trim()) {
    return params.urlAtSend.trim();
  }
  if (typeof params.livePublicUrl === "string" && params.livePublicUrl.trim()) {
    return params.livePublicUrl.trim();
  }
  return null;
}
