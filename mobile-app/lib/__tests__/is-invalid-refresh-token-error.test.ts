import { describe, expect, it } from "vitest";
import { isInvalidRefreshTokenError } from "@/lib/is-invalid-refresh-token-error";

describe("isInvalidRefreshTokenError", () => {
  it("matches refresh-token-not-found messages", () => {
    expect(
      isInvalidRefreshTokenError({
        name: "AuthApiError",
        message: "Invalid Refresh Token: Refresh Token Not Found",
      })
    ).toBe(true);
    expect(
      isInvalidRefreshTokenError({
        code: "refresh_token_not_found",
        message: "anything",
      })
    ).toBe(true);
  });

  it("does not treat unrelated AuthApiError or HTTP 400 as invalid refresh", () => {
    expect(
      isInvalidRefreshTokenError({
        name: "AuthApiError",
        message: "Email not confirmed",
        status: 400,
      })
    ).toBe(false);
    expect(
      isInvalidRefreshTokenError({
        name: "AuthApiError",
        message: "Invalid login credentials",
        status: 400,
      })
    ).toBe(false);
  });

  it("returns false for nullish and non-objects", () => {
    expect(isInvalidRefreshTokenError(null)).toBe(false);
    expect(isInvalidRefreshTokenError(undefined)).toBe(false);
    expect(isInvalidRefreshTokenError("refresh token not found")).toBe(false);
  });
});
