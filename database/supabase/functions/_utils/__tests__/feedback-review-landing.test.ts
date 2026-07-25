/**
 * Run: deno test --allow-all supabase/functions/_utils/__tests__/feedback-review-landing.test.ts
 */

import { assertEquals } from "@std/assert";
import {
  normalizeFeedbackRequestMode,
  resolveFeedbackLandingMode,
  resolveFeedbackLandingPublicUrl,
} from "../feedback-review-landing.ts";

Deno.test("normalizeFeedbackRequestMode: accepts valid modes", () => {
  assertEquals(normalizeFeedbackRequestMode("internal"), "internal");
  assertEquals(normalizeFeedbackRequestMode("public"), "public");
  assertEquals(normalizeFeedbackRequestMode("both"), "both");
});

Deno.test("normalizeFeedbackRequestMode: invalid → internal", () => {
  assertEquals(normalizeFeedbackRequestMode("google"), "internal");
  assertEquals(normalizeFeedbackRequestMode(null), "internal");
  assertEquals(normalizeFeedbackRequestMode(undefined), "internal");
  assertEquals(normalizeFeedbackRequestMode(""), "internal");
});

Deno.test("resolveFeedbackLandingMode: prefers send-time snapshot", () => {
  assertEquals(resolveFeedbackLandingMode({ modeAtSend: "both", liveMode: "public" }), "both");
});

Deno.test("resolveFeedbackLandingMode: falls back to live org mode", () => {
  assertEquals(resolveFeedbackLandingMode({ modeAtSend: null, liveMode: "public" }), "public");
});

Deno.test("resolveFeedbackLandingPublicUrl: prefers snapshot then live", () => {
  assertEquals(
    resolveFeedbackLandingPublicUrl({
      urlAtSend: "https://g.page/r/snap",
      livePublicUrl: "https://g.page/r/live",
    }),
    "https://g.page/r/snap"
  );
  assertEquals(
    resolveFeedbackLandingPublicUrl({
      urlAtSend: null,
      livePublicUrl: "https://g.page/r/live",
    }),
    "https://g.page/r/live"
  );
  assertEquals(resolveFeedbackLandingPublicUrl({ urlAtSend: "  ", livePublicUrl: null }), null);
});
