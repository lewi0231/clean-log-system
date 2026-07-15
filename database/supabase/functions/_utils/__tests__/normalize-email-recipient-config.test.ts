import { assertEquals } from "@std/assert";
import { normalizeEmailRecipientConfig } from "../normalize-email-recipient-config.ts";

Deno.test("normalizeEmailRecipientConfig: remaps location_contact_email", () => {
  const result = normalizeEmailRecipientConfig({
    location_email_source: "location_contact_email",
    form_field_email: null,
  });
  assertEquals(result.location_email_source, "location_email");
});

Deno.test("normalizeEmailRecipientConfig: leaves valid sources unchanged", () => {
  const result = normalizeEmailRecipientConfig({
    location_email_source: "hierarchy_billing_email",
    form_field_email: "field-1",
  });
  assertEquals(result.location_email_source, "hierarchy_billing_email");
  assertEquals(result.form_field_email, "field-1");
});
