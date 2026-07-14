/**
 * Auth lookup helpers used by worker invitation acceptance.
 *
 * Run with: deno test --allow-all _utils/__tests__/supabase-auth-lookup.test.ts
 */

import { assertEquals } from "@std/assert";
import { normalizeAuthEmail } from "../supabase.ts";

Deno.test("normalizeAuthEmail: trims and lowercases", () => {
  assertEquals(normalizeAuthEmail("  Worker@Example.COM  "), "worker@example.com");
});

Deno.test("normalizeAuthEmail: leaves already-normalized email unchanged", () => {
  assertEquals(normalizeAuthEmail("worker@example.com"), "worker@example.com");
});

function isDuplicateAuthError(message: string | undefined): boolean {
  const msg = (message ?? "").toLowerCase();
  return (
    msg.includes("already") ||
    msg.includes("registered") ||
    msg.includes("exists") ||
    msg.includes("duplicate")
  );
}

Deno.test("isDuplicateAuthError: detects registered message", () => {
  assertEquals(
    isDuplicateAuthError("A user with this email address has already been registered"),
    true
  );
});

Deno.test("isDuplicateAuthError: rejects unrelated auth errors", () => {
  assertEquals(isDuplicateAuthError("Invalid password"), false);
});
