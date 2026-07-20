import { buildWorkerSignupSchema } from "@/lib/worker-signup-schema";
import { describe, expect, it } from "vitest";

describe("buildWorkerSignupSchema (accept-invite gating)", () => {
  const password = "Secret1";

  it("requires ABN and address for contractors", () => {
    const result = buildWorkerSignupSchema(true).safeParse({
      password,
      address: "",
      abn: "",
    });
    expect(result.success).toBe(false);
  });

  it("allows empty ABN/address for employees", () => {
    const result = buildWorkerSignupSchema(false).safeParse({
      password,
      address: "",
      abn: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.address).toBe("");
      expect(result.data.abn).toBe("");
    }
  });

  it("rejects weak passwords even when tax details are optional", () => {
    const result = buildWorkerSignupSchema(false).safeParse({
      password: "weak",
      address: "",
      abn: "",
    });
    expect(result.success).toBe(false);
  });
});
