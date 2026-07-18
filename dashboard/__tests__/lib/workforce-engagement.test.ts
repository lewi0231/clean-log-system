import {
  canAdminSeeTaxInvoiceQueue,
  canSubmitTaxInvoice,
  defaultWorkerEngagementForOrg,
  normalizeWorkforceEngagement,
} from "@clean-log/shared/utils/workforce-engagement";
import { describe, expect, it } from "vitest";

describe("canSubmitTaxInvoice", () => {
  const cases: [string, string, boolean][] = [
    ["employees", "employee", false],
    ["employees", "contractor", false],
    ["contractors", "employee", true],
    ["contractors", "contractor", true],
    ["both", "employee", false],
    ["both", "contractor", true],
  ];

  it.each(cases)("org=%s worker=%s → %s", (org, worker, expected) => {
    expect(canSubmitTaxInvoice(org, worker)).toBe(expected);
  });
});

describe("canAdminSeeTaxInvoiceQueue", () => {
  it("shows for contractors and both", () => {
    expect(canAdminSeeTaxInvoiceQueue("contractors")).toBe(true);
    expect(canAdminSeeTaxInvoiceQueue("both")).toBe(true);
  });

  it("hides for employees unless history exists", () => {
    expect(canAdminSeeTaxInvoiceQueue("employees")).toBe(false);
    expect(canAdminSeeTaxInvoiceQueue("employees", true)).toBe(true);
  });
});

describe("defaultWorkerEngagementForOrg", () => {
  it("returns defaults or null for both", () => {
    expect(defaultWorkerEngagementForOrg("employees")).toBe("employee");
    expect(defaultWorkerEngagementForOrg("contractors")).toBe("contractor");
    expect(defaultWorkerEngagementForOrg("both")).toBeNull();
  });
});

describe("normalizeWorkforceEngagement", () => {
  it("falls back to employees", () => {
    expect(normalizeWorkforceEngagement(null)).toBe("employees");
    expect(normalizeWorkforceEngagement("nope")).toBe("employees");
  });
});
