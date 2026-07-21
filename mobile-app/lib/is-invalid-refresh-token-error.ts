/** True only for dead/missing refresh tokens — not every AuthApiError/400. */
export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const code = "code" in error && typeof error.code === "string" ? error.code : "";

  const lower = message.toLowerCase();
  return (
    code === "refresh_token_not_found" ||
    lower.includes("invalid refresh token") ||
    lower.includes("refresh token not found") ||
    lower.includes("refresh_token_not_found")
  );
}
