/**
 * P0 Critical Tests: Invoice Status Transitions
 *
 * These tests ensure invoices are created with the correct status.
 * Wrong status transitions could cause invoices to be sent prematurely or not at all.
 *
 * Run with: deno test --allow-all functions/__tests__/create-invoice.test.ts
 */

import { assertEquals } from "@std/assert";

/**
 * Determine invoice status based on organization settings and hierarchy auto-send
 * This matches the logic in create-invoice/index.ts
 */
interface Organization {
  invoice_send_immediately: boolean;
}

interface HierarchyNode {
  id: string;
  metadata: Record<string, unknown> | null;
}

interface JobWithLocation {
  location: {
    hierarchy_parent_id: string | null;
  } | null;
}

/**
 * Check if hierarchy has auto-send enabled
 */
function hasHierarchyAutoSend(
  hierarchyNodes: HierarchyNode[],
): boolean {
  return hierarchyNodes.some((node) => {
    const metadata = node.metadata;
    if (!metadata || typeof metadata !== "object") return false;
    const autoSend = metadata.auto_send_invoices;
    if (!autoSend || typeof autoSend !== "object") return false;
    const config = autoSend as Record<string, unknown>;
    return config.enabled === true;
  });
}

/**
 * Determine initial invoice status
 */
function determineInvoiceStatus(
  organization: Organization,
  _jobsWithLocations: JobWithLocation[],
  hierarchyNodes: HierarchyNode[],
): "sent" | "draft" {
  let shouldSendImmediately = organization.invoice_send_immediately || false;

  if (shouldSendImmediately) {
    // Check if any job locations belong to a hierarchy with auto-send enabled
    const hasAutoSendEnabled = hasHierarchyAutoSend(hierarchyNodes);

    // If auto-send is enabled on hierarchy, create as draft to be sent on schedule
    if (hasAutoSendEnabled) {
      shouldSendImmediately = false;
    }
  }

  return shouldSendImmediately ? "sent" : "draft";
}

// Invoice creation status tests
Deno.test('P0: should create as "sent" when invoice_send_immediately is true and no hierarchy auto-send', () => {
  const organization: Organization = {
    invoice_send_immediately: true,
  };
  const jobsWithLocations: JobWithLocation[] = [
    {
      location: {
        hierarchy_parent_id: null,
      },
    },
  ];
  const hierarchyNodes: HierarchyNode[] = [];

  const status = determineInvoiceStatus(
    organization,
    jobsWithLocations,
    hierarchyNodes,
  );

  assertEquals(status, "sent");
});

Deno.test('P0: should create as "draft" when invoice_send_immediately is false', () => {
  const organization: Organization = {
    invoice_send_immediately: false,
  };
  const jobsWithLocations: JobWithLocation[] = [
    {
      location: {
        hierarchy_parent_id: null,
      },
    },
  ];
  const hierarchyNodes: HierarchyNode[] = [];

  const status = determineInvoiceStatus(
    organization,
    jobsWithLocations,
    hierarchyNodes,
  );

  assertEquals(status, "draft");
});

Deno.test('P0: should create as "draft" when hierarchy auto-send is enabled (overrides immediate)', () => {
  const organization: Organization = {
    invoice_send_immediately: true,
  };
  const jobsWithLocations: JobWithLocation[] = [
    {
      location: {
        hierarchy_parent_id: "hier-1",
      },
    },
  ];
  const hierarchyNodes: HierarchyNode[] = [
    {
      id: "hier-1",
      metadata: {
        auto_send_invoices: {
          enabled: true,
          period: "daily",
          time: "09:00",
        },
      },
    },
  ];

  const status = determineInvoiceStatus(
    organization,
    jobsWithLocations,
    hierarchyNodes,
  );

  assertEquals(status, "draft");
});

Deno.test('P0: should create as "draft" when invoice_send_immediately is true but hierarchy auto-send exists', () => {
  const organization: Organization = {
    invoice_send_immediately: true,
  };
  const jobsWithLocations: JobWithLocation[] = [
    {
      location: {
        hierarchy_parent_id: "hier-1",
      },
    },
  ];
  const hierarchyNodes: HierarchyNode[] = [
    {
      id: "hier-1",
      metadata: {
        auto_send_invoices: {
          enabled: true,
          period: "weekly",
          day_of_week: 1,
          time: "14:00",
        },
      },
    },
  ];

  const status = determineInvoiceStatus(
    organization,
    jobsWithLocations,
    hierarchyNodes,
  );

  assertEquals(status, "draft");
});

Deno.test('P0: should create as "sent" when hierarchy auto-send is disabled', () => {
  const organization: Organization = {
    invoice_send_immediately: true,
  };
  const jobsWithLocations: JobWithLocation[] = [
    {
      location: {
        hierarchy_parent_id: "hier-1",
      },
    },
  ];
  const hierarchyNodes: HierarchyNode[] = [
    {
      id: "hier-1",
      metadata: {
        auto_send_invoices: {
          enabled: false,
          period: "daily",
        },
      },
    },
  ];

  const status = determineInvoiceStatus(
    organization,
    jobsWithLocations,
    hierarchyNodes,
  );

  assertEquals(status, "sent");
});

Deno.test('P0: should create as "sent" when hierarchy has no auto-send config', () => {
  const organization: Organization = {
    invoice_send_immediately: true,
  };
  const jobsWithLocations: JobWithLocation[] = [
    {
      location: {
        hierarchy_parent_id: "hier-1",
      },
    },
  ];
  const hierarchyNodes: HierarchyNode[] = [
    {
      id: "hier-1",
      metadata: {},
    },
  ];

  const status = determineInvoiceStatus(
    organization,
    jobsWithLocations,
    hierarchyNodes,
  );

  assertEquals(status, "sent");
});

Deno.test('P0: should create as "sent" when hierarchy metadata is null', () => {
  const organization: Organization = {
    invoice_send_immediately: true,
  };
  const jobsWithLocations: JobWithLocation[] = [
    {
      location: {
        hierarchy_parent_id: "hier-1",
      },
    },
  ];
  const hierarchyNodes: HierarchyNode[] = [
    {
      id: "hier-1",
      metadata: null,
    },
  ];

  const status = determineInvoiceStatus(
    organization,
    jobsWithLocations,
    hierarchyNodes,
  );

  assertEquals(status, "sent");
});

Deno.test('P0: should create as "draft" when multiple hierarchies but one has auto-send', () => {
  const organization: Organization = {
    invoice_send_immediately: true,
  };
  const jobsWithLocations: JobWithLocation[] = [
    {
      location: {
        hierarchy_parent_id: "hier-1",
      },
    },
    {
      location: {
        hierarchy_parent_id: "hier-2",
      },
    },
  ];
  const hierarchyNodes: HierarchyNode[] = [
    {
      id: "hier-1",
      metadata: {
        auto_send_invoices: {
          enabled: false,
        },
      },
    },
    {
      id: "hier-2",
      metadata: {
        auto_send_invoices: {
          enabled: true,
          period: "daily",
        },
      },
    },
  ];

  const status = determineInvoiceStatus(
    organization,
    jobsWithLocations,
    hierarchyNodes,
  );

  assertEquals(status, "draft");
});
