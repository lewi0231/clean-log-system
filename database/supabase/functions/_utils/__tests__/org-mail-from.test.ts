import { assertEquals } from "@std/assert";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RESEND_DOMAIN_VERIFIED,
  resolveOrgMailFrom,
  sanitizeForFromHeader,
} from "../org-mail-from.ts";

function orgMailMock(
  ent: boolean,
  row: { domain_name: string; resend_status: string; enabled: boolean } | null,
): SupabaseClient {
  return {
    from: (table: string) => {
      if (table === "organization") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { custom_email_domain_enabled: ent },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "organization_sending_domain") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: row, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
}

Deno.test("sanitizeForFromHeader strips CR/LF", () => {
  assertEquals(
    sanitizeForFromHeader("A\r\nB"),
    "AB",
  );
});

Deno.test("org_signup always platform Clean Log", async () => {
  const r = await resolveOrgMailFrom({
    supabase: orgMailMock(true, {
      domain_name: "mail.acme.com",
      resend_status: RESEND_DOMAIN_VERIFIED,
      enabled: true,
    }),
    organizationId: "org-1",
    organizationName: "Acme",
    mailKind: "org_signup_verification",
    platformDomain: "platform.example.com",
  });
  assertEquals(r.from, "Clean Log <noreply@platform.example.com>");
  assertEquals(r.fromDomainSource, "platform");
});

Deno.test("worker_invitation uses org domain when verified and entitled", async () => {
  const r = await resolveOrgMailFrom({
    supabase: orgMailMock(true, {
      domain_name: "mail.acme.com",
      resend_status: RESEND_DOMAIN_VERIFIED,
      enabled: true,
    }),
    organizationId: "org-1",
    organizationName: "Acme",
    mailKind: "worker_invitation",
    platformDomain: "platform.example.com",
  });
  assertEquals(
    r.from,
    "Acme <onboarding@mail.acme.com>",
  );
  assertEquals(r.fromDomainSource, "org");
});

Deno.test("admin_user_invitation uses RESEND_ADMIN_INVITES when set", async () => {
  const prev = Deno.env.get("RESEND_ADMIN_INVITES_FROM_DOMAIN");
  Deno.env.set("RESEND_ADMIN_INVITES_FROM_DOMAIN", "admin.notices.example.com");
  try {
    const r = await resolveOrgMailFrom({
      supabase: orgMailMock(true, {
        domain_name: "mail.acme.com",
        resend_status: RESEND_DOMAIN_VERIFIED,
        enabled: true,
      }),
      organizationId: "org-1",
      organizationName: "Acme",
      mailKind: "admin_user_invitation",
      platformDomain: "platform.example.com",
    });
    assertEquals(
      r.from,
      "Acme <invitations@admin.notices.example.com>",
    );
    assertEquals(r.fromDomainSource, "platform");
  } finally {
    if (prev === undefined) {
      Deno.env.delete("RESEND_ADMIN_INVITES_FROM_DOMAIN");
    } else {
      Deno.env.set("RESEND_ADMIN_INVITES_FROM_DOMAIN", prev);
    }
  }
});
