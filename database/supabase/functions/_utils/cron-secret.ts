/**
 * Shared cron authentication for privileged_batch Edge functions.
 */

/** Constant-time compare to avoid leaking secret length via early return. */
export function timingSafeEqualString(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let mismatch = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    mismatch |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return mismatch === 0;
}

export function requireCronSecret(req: Request): {
  ok: boolean;
  reason?: "missing_config" | "missing_header" | "mismatch";
} {
  const expected = Deno.env.get("CRON_SHARED_SECRET");
  if (!expected) {
    return { ok: false, reason: "missing_config" };
  }
  const provided = req.headers.get("x-cron-secret");
  if (!provided) {
    return { ok: false, reason: "missing_header" };
  }
  if (!timingSafeEqualString(provided, expected)) {
    return { ok: false, reason: "mismatch" };
  }
  return { ok: true };
}
