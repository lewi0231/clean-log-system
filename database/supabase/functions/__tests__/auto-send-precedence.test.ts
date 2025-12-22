/**
 * P0 Critical Tests: Auto-Send Precedence
 *
 * These tests ensure the correct precedence between hierarchy and organization auto-send.
 * Incorrect precedence could send invoices multiple times or not send them at all.
 *
 * Run with: deno test --allow-all functions/__tests__/auto-send-precedence.test.ts
 */

import { assertEquals } from "@std/assert";

interface DraftInvoice {
  id: string;
  invoice_number: string;
  organization_id: string;
  invoice_job?: Array<{
    job?: {
      location_id?: string;
    };
  }>;
}

interface AutoSendConfig {
  enabled: boolean;
  period: "daily" | "weekly" | "monthly";
  day_of_week?: number;
  day_of_month?: number;
  time?: string;
}

/**
 * Determine which invoices should be sent based on hierarchy and org auto-send
 * This matches the logic in auto-send-invoices/index.ts
 */
function determineInvoicesToSend(
  draftInvoices: DraftInvoice[],
  hierarchyCoveredLocationIds: Set<string>,
  hierarchyShouldRun: boolean,
  orgConfig: AutoSendConfig | null,
  orgShouldRun: boolean,
): DraftInvoice[] {
  const invoicesToSend: DraftInvoice[] = [];

  // Process hierarchy-based auto-send (takes precedence)
  if (hierarchyShouldRun) {
    for (const invoice of draftInvoices) {
      // Check if invoice has locations covered by hierarchy
      if (invoice.invoice_job && Array.isArray(invoice.invoice_job)) {
        const hasHierarchyCoveredLocation = invoice.invoice_job.some(
          (ij) =>
            ij.job?.location_id &&
            hierarchyCoveredLocationIds.has(ij.job.location_id),
        );
        if (hasHierarchyCoveredLocation) {
          invoicesToSend.push(invoice);
        }
      }
    }
  }

  // Process organization-level auto-send for invoices not covered by hierarchy
  if (orgConfig && orgShouldRun) {
    const orgLevelInvoices = draftInvoices.filter((invoice) => {
      // Skip if already in invoicesToSend (covered by hierarchy)
      if (invoicesToSend.some((inv) => inv.id === invoice.id)) {
        return false;
      }

      // Only exclude hierarchy-covered locations if hierarchy is actually running
      // If hierarchy is disabled, org-level should handle all invoices
      if (
        hierarchyShouldRun && invoice.invoice_job &&
        Array.isArray(invoice.invoice_job)
      ) {
        const hasHierarchyCoveredLocation = invoice.invoice_job.some(
          (ij) =>
            ij.job?.location_id &&
            hierarchyCoveredLocationIds.has(ij.job.location_id),
        );
        return !hasHierarchyCoveredLocation;
      }

      // Invoice with no locations, no location hierarchy coverage, or hierarchy not running
      return true;
    });

    invoicesToSend.push(...orgLevelInvoices);
  }

  return invoicesToSend;
}

// Precedence tests
Deno.test("P0: hierarchy auto-send should take precedence over organization auto-send", () => {
  const draftInvoices: DraftInvoice[] = [
    {
      id: "inv-1",
      invoice_number: "INV-001",
      organization_id: "org-1",
      invoice_job: [
        {
          job: {
            location_id: "loc-1",
          },
        },
      ],
    },
  ];

  const hierarchyCoveredLocationIds = new Set<string>(["loc-1"]);
  const hierarchyShouldRun = true;
  const orgConfig: AutoSendConfig = {
    enabled: true,
    period: "daily",
    time: "09:00",
  };
  const orgShouldRun = true;

  const result = determineInvoicesToSend(
    draftInvoices,
    hierarchyCoveredLocationIds,
    hierarchyShouldRun,
    orgConfig,
    orgShouldRun,
  );

  // Invoice should be included only once (from hierarchy)
  assertEquals(result.length, 1);
  assertEquals(result[0].id, "inv-1");
});

Deno.test("P0: should not send invoice twice if covered by both hierarchy and org auto-send", () => {
  const draftInvoices: DraftInvoice[] = [
    {
      id: "inv-1",
      invoice_number: "INV-001",
      organization_id: "org-1",
      invoice_job: [
        {
          job: {
            location_id: "loc-1",
          },
        },
      ],
    },
  ];

  const hierarchyCoveredLocationIds = new Set<string>(["loc-1"]);
  const hierarchyShouldRun = true;
  const orgConfig: AutoSendConfig = {
    enabled: true,
    period: "daily",
    time: "09:00",
  };
  const orgShouldRun = true;

  const result = determineInvoicesToSend(
    draftInvoices,
    hierarchyCoveredLocationIds,
    hierarchyShouldRun,
    orgConfig,
    orgShouldRun,
  );

  // Should only appear once
  assertEquals(result.length, 1);
  const invoiceIds = result.map((inv) => inv.id);
  assertEquals(new Set(invoiceIds).size, 1); // No duplicates
});

Deno.test("P0: should only send invoices for locations under hierarchy nodes with auto-send", () => {
  const draftInvoices: DraftInvoice[] = [
    {
      id: "inv-1",
      invoice_number: "INV-001",
      organization_id: "org-1",
      invoice_job: [
        {
          job: {
            location_id: "loc-1", // Covered by hierarchy
          },
        },
      ],
    },
    {
      id: "inv-2",
      invoice_number: "INV-002",
      organization_id: "org-1",
      invoice_job: [
        {
          job: {
            location_id: "loc-2", // NOT covered by hierarchy
          },
        },
      ],
    },
  ];

  const hierarchyCoveredLocationIds = new Set<string>(["loc-1"]);
  const hierarchyShouldRun = true;
  const orgConfig: AutoSendConfig = {
    enabled: true,
    period: "daily",
    time: "09:00",
  };
  const orgShouldRun = true;

  const result = determineInvoicesToSend(
    draftInvoices,
    hierarchyCoveredLocationIds,
    hierarchyShouldRun,
    orgConfig,
    orgShouldRun,
  );

  // inv-1 should be included (hierarchy), inv-2 should be included (org-level)
  assertEquals(result.length, 2);
  const invoiceIds = result.map((inv) => inv.id).sort();
  assertEquals(invoiceIds, ["inv-1", "inv-2"]);
});

Deno.test("P0: organization auto-send should only process invoices not covered by hierarchy", () => {
  const draftInvoices: DraftInvoice[] = [
    {
      id: "inv-1",
      invoice_number: "INV-001",
      organization_id: "org-1",
      invoice_job: [
        {
          job: {
            location_id: "loc-1", // Covered by hierarchy
          },
        },
      ],
    },
    {
      id: "inv-2",
      invoice_number: "INV-002",
      organization_id: "org-1",
      invoice_job: [
        {
          job: {
            location_id: "loc-2", // NOT covered by hierarchy
          },
        },
      ],
    },
    {
      id: "inv-3",
      invoice_number: "INV-003",
      organization_id: "org-1",
      // No location
    },
  ];

  const hierarchyCoveredLocationIds = new Set<string>(["loc-1"]);
  const hierarchyShouldRun = true;
  const orgConfig: AutoSendConfig = {
    enabled: true,
    period: "daily",
    time: "09:00",
  };
  const orgShouldRun = true;

  const result = determineInvoicesToSend(
    draftInvoices,
    hierarchyCoveredLocationIds,
    hierarchyShouldRun,
    orgConfig,
    orgShouldRun,
  );

  // inv-1 from hierarchy, inv-2 and inv-3 from org-level
  assertEquals(result.length, 3);
  const invoiceIds = result.map((inv) => inv.id).sort();
  assertEquals(invoiceIds, ["inv-1", "inv-2", "inv-3"]);
});

Deno.test("P0: should handle invoices with multiple jobs where some locations are covered", () => {
  const draftInvoices: DraftInvoice[] = [
    {
      id: "inv-1",
      invoice_number: "INV-001",
      organization_id: "org-1",
      invoice_job: [
        {
          job: {
            location_id: "loc-1", // Covered by hierarchy
          },
        },
        {
          job: {
            location_id: "loc-2", // NOT covered by hierarchy
          },
        },
      ],
    },
  ];

  const hierarchyCoveredLocationIds = new Set<string>(["loc-1"]);
  const hierarchyShouldRun = true;
  const orgConfig: AutoSendConfig = {
    enabled: true,
    period: "daily",
    time: "09:00",
  };
  const orgShouldRun = true;

  const result = determineInvoicesToSend(
    draftInvoices,
    hierarchyCoveredLocationIds,
    hierarchyShouldRun,
    orgConfig,
    orgShouldRun,
  );

  // Invoice should be included once (from hierarchy, since it has at least one covered location)
  assertEquals(result.length, 1);
  assertEquals(result[0].id, "inv-1");
});

Deno.test("P0: should not include invoice in org-level if any location is covered by hierarchy", () => {
  const draftInvoices: DraftInvoice[] = [
    {
      id: "inv-1",
      invoice_number: "INV-001",
      organization_id: "org-1",
      invoice_job: [
        {
          job: {
            location_id: "loc-1", // Covered by hierarchy
          },
        },
        {
          job: {
            location_id: "loc-2", // NOT covered by hierarchy
          },
        },
      ],
    },
  ];

  const hierarchyCoveredLocationIds = new Set<string>(["loc-1"]);
  const hierarchyShouldRun = true;
  const orgConfig: AutoSendConfig = {
    enabled: true,
    period: "daily",
    time: "09:00",
  };
  const orgShouldRun = true;

  const result = determineInvoicesToSend(
    draftInvoices,
    hierarchyCoveredLocationIds,
    hierarchyShouldRun,
    orgConfig,
    orgShouldRun,
  );

  // Should only appear once (from hierarchy, not from org-level)
  assertEquals(result.length, 1);
  assertEquals(result[0].id, "inv-1");
});

Deno.test("P0: should handle hierarchy auto-send disabled but org auto-send enabled", () => {
  const draftInvoices: DraftInvoice[] = [
    {
      id: "inv-1",
      invoice_number: "INV-001",
      organization_id: "org-1",
      invoice_job: [
        {
          job: {
            location_id: "loc-1",
          },
        },
      ],
    },
  ];

  const hierarchyCoveredLocationIds = new Set<string>(["loc-1"]);
  const hierarchyShouldRun = false; // Hierarchy auto-send disabled
  const orgConfig: AutoSendConfig = {
    enabled: true,
    period: "daily",
    time: "09:00",
  };
  const orgShouldRun = true;

  const result = determineInvoicesToSend(
    draftInvoices,
    hierarchyCoveredLocationIds,
    hierarchyShouldRun,
    orgConfig,
    orgShouldRun,
  );

  // Should be included from org-level since hierarchy is not running
  assertEquals(result.length, 1);
  assertEquals(result[0].id, "inv-1");
});

Deno.test("P0: should handle org auto-send disabled but hierarchy auto-send enabled", () => {
  const draftInvoices: DraftInvoice[] = [
    {
      id: "inv-1",
      invoice_number: "INV-001",
      organization_id: "org-1",
      invoice_job: [
        {
          job: {
            location_id: "loc-1",
          },
        },
      ],
    },
  ];

  const hierarchyCoveredLocationIds = new Set<string>(["loc-1"]);
  const hierarchyShouldRun = true;
  const orgConfig: AutoSendConfig | null = null; // Org auto-send disabled

  const result = determineInvoicesToSend(
    draftInvoices,
    hierarchyCoveredLocationIds,
    hierarchyShouldRun,
    orgConfig,
    false,
  );

  // Should be included from hierarchy
  assertEquals(result.length, 1);
  assertEquals(result[0].id, "inv-1");
});
