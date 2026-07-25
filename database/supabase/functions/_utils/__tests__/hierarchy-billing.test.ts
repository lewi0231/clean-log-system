import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  formatBillingAddressLines,
  isDisplayUsableBilling,
  isEmailUsableBilling,
  normalizeBillingAddress,
  resolveHierarchyBillingFromNodes,
  selectPrimaryInvoiceJob,
  unwrapRelation,
  type HierarchyBillingNode,
} from "../hierarchy-billing.ts";

function node(
  partial: Partial<HierarchyBillingNode> & {
    id: string;
    type: string;
    name: string;
  }
): HierarchyBillingNode {
  return {
    parent_id: null,
    metadata: null,
    active: true,
    ...partial,
  };
}

Deno.test("normalizeBillingAddress folds legacy address into address_line1", () => {
  const n = normalizeBillingAddress({
    name: "AP",
    address: "1 Old St",
    email: "ap@example.com",
  });
  assertEquals(n?.address_line1, "1 Old St");
  assertEquals(n?.name, "AP");
});

Deno.test("normalizeBillingAddress rejects arrays and null", () => {
  assertEquals(normalizeBillingAddress(null), null);
  assertEquals(normalizeBillingAddress([]), null);
  assertEquals(normalizeBillingAddress("string"), null);
});

Deno.test("unwrapRelation handles object and single-element array", () => {
  assertEquals(unwrapRelation<{ id: string }>({ id: "a" }), { id: "a" });
  assertEquals(unwrapRelation<{ id: string }>([{ id: "a" }]), { id: "a" });
  assertEquals(unwrapRelation<{ id: string }>([]), null);
  assertEquals(unwrapRelation<{ id: string }>(null), null);
});

Deno.test("selectPrimaryInvoiceJob uses first job with a location (array order)", () => {
  const primary = selectPrimaryInvoiceJob([
    { job: { submission_data: { a: 1 }, location: null } },
    {
      job: {
        submission_data: { b: 2 },
        location: { id: "loc-2", name: "Site B", hierarchy_parent_id: "r1" },
      },
    },
    {
      job: {
        submission_data: { c: 3 },
        location: { id: "loc-3", name: "Site C", hierarchy_parent_id: "r2" },
      },
    },
  ]);
  assertEquals(primary.location?.id, "loc-2");
  assertEquals(primary.hierarchy_parent_id, "r1");
  assertEquals(primary.submission_data, { b: 2 });
});

Deno.test("selectPrimaryInvoiceJob unwraps PostgREST array relations", () => {
  const primary = selectPrimaryInvoiceJob([
    {
      job: [
        {
          submission_data: null,
          location: [{ id: "loc-1", hierarchy_parent_id: "c1" }],
        },
      ],
    },
  ]);
  assertEquals(primary.location?.id, "loc-1");
  assertEquals(primary.hierarchy_parent_id, "c1");
});

Deno.test("selectPrimaryInvoiceJob returns empty for no locations", () => {
  const primary = selectPrimaryInvoiceJob([{ job: { location: null } }, {}]);
  assertEquals(primary.location, null);
  assertEquals(primary.hierarchy_parent_id, null);
});

Deno.test("isEmailUsableBilling requires valid email only", () => {
  assertEquals(isEmailUsableBilling({ email: "ap@example.com" }), true);
  assertEquals(isEmailUsableBilling({ name: "AP" }), false);
  assertEquals(isEmailUsableBilling({ email: "not-an-email" }), false);
});

Deno.test("isDisplayUsableBilling accepts any contact/address field", () => {
  assertEquals(isDisplayUsableBilling({ name: "AP" }), true);
  assertEquals(isDisplayUsableBilling({ city: "Adelaide" }), true);
  assertEquals(isDisplayUsableBilling({}), false);
});

Deno.test("region wins when override off and region has billing", () => {
  const region = node({
    id: "r1",
    type: "region",
    name: "South",
    parent_id: "c1",
    metadata: {
      billing_address: { email: "region@example.com", name: "South AP" },
    },
  });
  const company = node({
    id: "c1",
    type: "company",
    name: "Metro",
    metadata: {
      billing_address: { email: "company@example.com", name: "Metro AP" },
      use_company_billing_for_children: false,
    },
  });
  const resolved = resolveHierarchyBillingFromNodes(region, company, "email");
  assertEquals(resolved?.hierarchy_node_id, "r1");
  assertEquals(resolved?.billing_address.email, "region@example.com");
});

Deno.test("company override forces company and does not fall back to region", () => {
  const region = node({
    id: "r1",
    type: "region",
    name: "South",
    parent_id: "c1",
    metadata: {
      billing_address: { email: "region@example.com", name: "South AP" },
    },
  });
  const company = node({
    id: "c1",
    type: "company",
    name: "Metro",
    metadata: {
      billing_address: { email: "company@example.com", name: "Metro AP" },
      use_company_billing_for_children: true,
    },
  });
  const resolved = resolveHierarchyBillingFromNodes(region, company, "email");
  assertEquals(resolved?.hierarchy_node_id, "c1");
});

Deno.test("company override with unusable company returns null (no region fallback)", () => {
  const region = node({
    id: "r1",
    type: "region",
    name: "South",
    parent_id: "c1",
    metadata: {
      billing_address: { email: "region@example.com", name: "South AP" },
    },
  });
  const company = node({
    id: "c1",
    type: "company",
    name: "Metro",
    metadata: {
      billing_address: { name: "Metro AP" },
      use_company_billing_for_children: true,
    },
  });
  const resolved = resolveHierarchyBillingFromNodes(region, company, "email");
  assertEquals(resolved, null);
});

Deno.test("region empty falls through to company when override off", () => {
  const region = node({
    id: "r1",
    type: "region",
    name: "South",
    parent_id: "c1",
    metadata: {},
  });
  const company = node({
    id: "c1",
    type: "company",
    name: "Metro",
    metadata: {
      billing_address: { email: "company@example.com", name: "Metro AP" },
    },
  });
  const resolved = resolveHierarchyBillingFromNodes(region, company, "email");
  assertEquals(resolved?.hierarchy_node_id, "c1");
});

Deno.test("orphan region with billing resolves to region", () => {
  const region = node({
    id: "r1",
    type: "region",
    name: "South",
    parent_id: null,
    metadata: {
      billing_address: { email: "region@example.com", name: "South AP" },
    },
  });
  const resolved = resolveHierarchyBillingFromNodes(region, null, "email");
  assertEquals(resolved?.hierarchy_node_id, "r1");
});

Deno.test("inactive parent returns null", () => {
  const region = node({
    id: "r1",
    type: "region",
    name: "South",
    active: false,
    metadata: {
      billing_address: { email: "region@example.com" },
    },
  });
  assertEquals(resolveHierarchyBillingFromNodes(region, null, "email"), null);
});

Deno.test("company-only location parent resolves company", () => {
  const company = node({
    id: "c1",
    type: "company",
    name: "Metro",
    metadata: {
      billing_address: { email: "company@example.com", name: "Metro AP" },
    },
  });
  const resolved = resolveHierarchyBillingFromNodes(company, null, "display");
  assertEquals(resolved?.hierarchy_node_id, "c1");
  assertEquals(formatBillingAddressLines(resolved!.billing_address)[0], "Metro AP");
});
