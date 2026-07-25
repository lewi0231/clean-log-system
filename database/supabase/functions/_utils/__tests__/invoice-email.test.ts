/**
 * P0 Critical Tests: Email Recipient Resolution
 *
 * These tests ensure invoices reach the correct recipients.
 * Failure here means invoices don't reach customers = payment delays.
 *
 * Run with: deno test --allow-all _utils/__tests__/invoice-email.test.ts
 */

import { assertEquals } from "@std/assert";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getInvoiceEmailRecipients,
  type InvoiceEmailRecipientConfig,
  type JobContext,
} from "../invoice-email.ts";

// Mock supabase client for Deno tests (supports .single() and .maybeSingle())
const createMockSupabase = () => {
  let mockSingleResponse: { data: unknown; error: unknown } | null = null;

  const mockSelect = () => ({
    eq: () => {
      const result = () => Promise.resolve(mockSingleResponse || { data: null, error: null });
      return {
        single: result,
        maybeSingle: result,
      };
    },
  });

  return {
    from: () => ({
      select: mockSelect,
    }),
    _setMockSingleResponse: (response: { data: unknown; error: unknown }) => {
      mockSingleResponse = response;
    },
    _clearMock: () => {
      mockSingleResponse = null;
    },
  } as unknown as SupabaseClient & {
    _setMockSingleResponse: (response: { data: unknown; error: unknown }) => void;
    _clearMock: () => void;
  };
};

// Jobs with locations tests
Deno.test(
  "P0: should use hierarchy billing email when location_email_source is hierarchy_billing_email and hierarchy has billing email",
  async () => {
    const mockSupabase = createMockSupabase();
    const jobContexts: JobContext[] = [
      {
        location_id: "loc-1",
        location: {
          id: "loc-1",
          email: "location@example.com",
          contact_person: "John Doe",
          hierarchy_parent_id: "hier-1",
        },
        submission_data: {},
      },
    ];

    const emailConfig: InvoiceEmailRecipientConfig = {
      location_email_source: "hierarchy_billing_email",
      form_field_email: null,
      default_email: null,
    };

    // Set up mock hierarchy response
    (
      mockSupabase as unknown as {
        _setMockSingleResponse: (response: { data: unknown; error: unknown }) => void;
      }
    )._setMockSingleResponse({
      data: {
        id: "hier-1",
        type: "company",
        name: "Test Co",
        parent_id: null,
        active: true,
        metadata: {
          billing_address: {
            email: "billing@company.com",
          },
        },
      },
      error: null,
    });

    const fieldConfigMap = new Map();

    const result = await getInvoiceEmailRecipients(
      mockSupabase,
      jobContexts,
      emailConfig,
      fieldConfigMap
    );

    assertEquals(result, ["billing@company.com"]);
    (mockSupabase as unknown as { _clearMock: () => void })._clearMock();
  }
);

Deno.test(
  "P0: should fall back to location email when hierarchy has no billing email",
  async () => {
    const mockSupabase = createMockSupabase();
    const jobContexts: JobContext[] = [
      {
        location_id: "loc-1",
        location: {
          id: "loc-1",
          email: "location@example.com",
          contact_person: "John Doe",
          hierarchy_parent_id: "hier-1",
        },
        submission_data: {},
      },
    ];

    const emailConfig: InvoiceEmailRecipientConfig = {
      location_email_source: "hierarchy_billing_email",
      form_field_email: null,
      default_email: null,
    };

    // Mock hierarchy lookup - no billing email
    (
      mockSupabase as unknown as {
        _setMockSingleResponse: (response: { data: unknown; error: unknown }) => void;
      }
    )._setMockSingleResponse({
      data: {
        id: "hier-1",
        type: "company",
        name: "Test Co",
        parent_id: null,
        active: true,
        metadata: {}, // No billing email
      },
      error: null,
    });

    const fieldConfigMap = new Map();

    const result = await getInvoiceEmailRecipients(
      mockSupabase,
      jobContexts,
      emailConfig,
      fieldConfigMap
    );

    assertEquals(result, ["location@example.com"]);
    (mockSupabase as unknown as { _clearMock: () => void })._clearMock();
  }
);

Deno.test(
  "P0: hierarchy_billing_email walks region → company when region has no email",
  async () => {
    const nodes: Record<string, unknown> = {
      "region-1": {
        id: "region-1",
        type: "region",
        name: "South",
        parent_id: "company-1",
        active: true,
        metadata: {},
      },
      "company-1": {
        id: "company-1",
        type: "company",
        name: "Metro",
        parent_id: null,
        active: true,
        metadata: {
          billing_address: { email: "ap@company.com" },
        },
      },
    };

    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: (_col: string, id: string) => {
            const result = () => Promise.resolve({ data: nodes[id] ?? null, error: null });
            return { single: result, maybeSingle: result };
          },
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await getInvoiceEmailRecipients(
      mockSupabase,
      [
        {
          location_id: "loc-1",
          location: {
            id: "loc-1",
            email: "location@example.com",
            contact_person: null,
            hierarchy_parent_id: "region-1",
          },
          submission_data: {},
        },
      ],
      {
        location_email_source: "hierarchy_billing_email",
        form_field_email: null,
      },
      new Map()
    );

    assertEquals(result, ["ap@company.com"]);
  }
);

Deno.test(
  "P0: company override with no company email falls back to location (not region)",
  async () => {
    const nodes: Record<string, unknown> = {
      "region-1": {
        id: "region-1",
        type: "region",
        name: "South",
        parent_id: "company-1",
        active: true,
        metadata: {
          billing_address: { email: "region@example.com" },
        },
      },
      "company-1": {
        id: "company-1",
        type: "company",
        name: "Metro",
        parent_id: null,
        active: true,
        metadata: {
          use_company_billing_for_children: true,
          billing_address: { name: "Metro AP" },
        },
      },
    };

    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: (_col: string, id: string) => {
            const result = () => Promise.resolve({ data: nodes[id] ?? null, error: null });
            return { single: result, maybeSingle: result };
          },
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await getInvoiceEmailRecipients(
      mockSupabase,
      [
        {
          location_id: "loc-1",
          location: {
            id: "loc-1",
            email: "location@example.com",
            contact_person: null,
            hierarchy_parent_id: "region-1",
          },
          submission_data: {},
        },
      ],
      {
        location_email_source: "hierarchy_billing_email",
        form_field_email: null,
      },
      new Map()
    );

    assertEquals(result, ["location@example.com"]);
  }
);

Deno.test("P0: should fall back to location email when hierarchy parent is missing", async () => {
  const mockSupabase = createMockSupabase();
  const jobContexts: JobContext[] = [
    {
      location_id: "loc-1",
      location: {
        id: "loc-1",
        email: "location@example.com",
        contact_person: "John Doe",
        hierarchy_parent_id: null,
      },
      submission_data: {},
    },
  ];

  const emailConfig: InvoiceEmailRecipientConfig = {
    location_email_source: "hierarchy_billing_email",
    form_field_email: null,
    default_email: null,
  };

  const result = await getInvoiceEmailRecipients(mockSupabase, jobContexts, emailConfig, new Map());

  assertEquals(result, ["location@example.com"]);
});

Deno.test(
  "P0: should use location.email when location_email_source is location_email",
  async () => {
    const mockSupabase = createMockSupabase();
    const jobContexts: JobContext[] = [
      {
        location_id: "loc-1",
        location: {
          id: "loc-1",
          email: "location@example.com",
          contact_person: "John Doe",
          hierarchy_parent_id: null,
        },
        submission_data: {},
      },
    ];

    const emailConfig: InvoiceEmailRecipientConfig = {
      location_email_source: "location_email",
      form_field_email: null,
      default_email: null,
    };

    const fieldConfigMap = new Map();

    const result = await getInvoiceEmailRecipients(
      mockSupabase,
      jobContexts,
      emailConfig,
      fieldConfigMap
    );

    assertEquals(result, ["location@example.com"]);
  }
);

Deno.test(
  "P0: should return empty when location email missing (default_email deprecated)",
  async () => {
    const mockSupabase = createMockSupabase();
    const jobContexts: JobContext[] = [
      {
        location_id: "loc-1",
        location: {
          id: "loc-1",
          email: null,
          contact_person: "John Doe",
          hierarchy_parent_id: null,
        },
        submission_data: {},
      },
    ];

    const emailConfig: InvoiceEmailRecipientConfig = {
      location_email_source: "location_email",
      form_field_email: null,
      default_email: "default@example.com",
    };

    const fieldConfigMap = new Map();

    const result = await getInvoiceEmailRecipients(
      mockSupabase,
      jobContexts,
      emailConfig,
      fieldConfigMap
    );

    // default_email is deprecated and fallback was removed
    assertEquals(result, []);
  }
);

Deno.test(
  "P0: should return empty array when no email source available and no default",
  async () => {
    const mockSupabase = createMockSupabase();
    const jobContexts: JobContext[] = [
      {
        location_id: "loc-1",
        location: {
          id: "loc-1",
          email: null,
          contact_person: "John Doe",
          hierarchy_parent_id: null,
        },
        submission_data: {},
      },
    ];

    const emailConfig: InvoiceEmailRecipientConfig = {
      location_email_source: "location_email",
      form_field_email: null,
      default_email: null,
    };

    const fieldConfigMap = new Map();

    const result = await getInvoiceEmailRecipients(
      mockSupabase,
      jobContexts,
      emailConfig,
      fieldConfigMap
    );

    assertEquals(result, []);
  }
);

// Jobs without locations tests
Deno.test(
  "P0: should extract email from form field when form_field_email is configured",
  async () => {
    const mockSupabase = createMockSupabase();
    const jobContexts: JobContext[] = [
      {
        location_id: null,
        location: null,
        submission_data: {
          customer_email: "customer@example.com",
        },
      },
    ];

    const emailConfig: InvoiceEmailRecipientConfig = {
      location_email_source: "location_email",
      form_field_email: "field-config-1", // Field config ID
      default_email: null,
    };

    const fieldConfigMap = new Map([
      [
        "field-config-1",
        {
          name: "customer_email",
          label: "Customer Email",
        },
      ],
    ]);

    const result = await getInvoiceEmailRecipients(
      mockSupabase,
      jobContexts,
      emailConfig,
      fieldConfigMap
    );

    assertEquals(result, ["customer@example.com"]);
  }
);

Deno.test("P0: should use field config name to lookup submission_data value", async () => {
  const mockSupabase = createMockSupabase();
  const jobContexts: JobContext[] = [
    {
      location_id: null,
      location: null,
      submission_data: {
        contact_email_field: "contact@example.com",
      },
    },
  ];

  const emailConfig: InvoiceEmailRecipientConfig = {
    location_email_source: "location_email",
    form_field_email: "field-config-2",
    default_email: null,
  };

  const fieldConfigMap = new Map([
    [
      "field-config-2",
      {
        name: "contact_email_field",
        label: "Contact Email",
      },
    ],
  ]);

  const result = await getInvoiceEmailRecipients(
    mockSupabase,
    jobContexts,
    emailConfig,
    fieldConfigMap
  );

  assertEquals(result, ["contact@example.com"]);
});

Deno.test("P0: should validate email format (RFC compliant)", async () => {
  const mockSupabase = createMockSupabase();
  const jobContexts: JobContext[] = [
    {
      location_id: null,
      location: null,
      submission_data: {
        customer_email: "invalid-email", // Missing @ and domain
      },
    },
  ];

  const emailConfig: InvoiceEmailRecipientConfig = {
    location_email_source: "location_email",
    form_field_email: "field-config-1",
    default_email: null,
  };

  const fieldConfigMap = new Map([
    [
      "field-config-1",
      {
        name: "customer_email",
        label: "Customer Email",
      },
    ],
  ]);

  const result = await getInvoiceEmailRecipients(
    mockSupabase,
    jobContexts,
    emailConfig,
    fieldConfigMap
  );

  // Invalid email should be rejected
  assertEquals(result, []);
});

Deno.test(
  "P0: should return empty when form field email invalid (default_email deprecated)",
  async () => {
    const mockSupabase = createMockSupabase();
    const jobContexts: JobContext[] = [
      {
        location_id: null,
        location: null,
        submission_data: {
          customer_email: "invalid-email",
        },
      },
    ];

    const emailConfig: InvoiceEmailRecipientConfig = {
      location_email_source: "location_email",
      form_field_email: "field-config-1",
      default_email: "default@example.com",
    };

    const fieldConfigMap = new Map([
      [
        "field-config-1",
        {
          name: "customer_email",
          label: "Customer Email",
        },
      ],
    ]);

    const result = await getInvoiceEmailRecipients(
      mockSupabase,
      jobContexts,
      emailConfig,
      fieldConfigMap
    );

    // default_email is deprecated; invalid form email => no recipient
    assertEquals(result, []);
  }
);

Deno.test("P0: should return empty array when no email available", async () => {
  const mockSupabase = createMockSupabase();
  const jobContexts: JobContext[] = [
    {
      location_id: null,
      location: null,
      submission_data: {},
    },
  ];

  const emailConfig: InvoiceEmailRecipientConfig = {
    location_email_source: "location_email",
    form_field_email: null,
    default_email: null,
  };

  const fieldConfigMap = new Map();

  const result = await getInvoiceEmailRecipients(
    mockSupabase,
    jobContexts,
    emailConfig,
    fieldConfigMap
  );

  assertEquals(result, []);
});

// Edge cases tests
Deno.test("P0: should handle null submission_data gracefully", async () => {
  const mockSupabase = createMockSupabase();
  const jobContexts: JobContext[] = [
    {
      location_id: null,
      location: null,
      submission_data: null,
    },
  ];

  const emailConfig: InvoiceEmailRecipientConfig = {
    location_email_source: "location_email",
    form_field_email: "field-config-1",
    default_email: "default@example.com",
  };

  const fieldConfigMap = new Map([
    [
      "field-config-1",
      {
        name: "customer_email",
        label: "Customer Email",
      },
    ],
  ]);

  const result = await getInvoiceEmailRecipients(
    mockSupabase,
    jobContexts,
    emailConfig,
    fieldConfigMap
  );

  // default_email is deprecated; no submission_data => no recipient
  assertEquals(result, []);
});

Deno.test("P0: should handle missing field config in map", async () => {
  const mockSupabase = createMockSupabase();
  const jobContexts: JobContext[] = [
    {
      location_id: null,
      location: null,
      submission_data: {
        customer_email: "customer@example.com",
      },
    },
  ];

  const emailConfig: InvoiceEmailRecipientConfig = {
    location_email_source: "location_email",
    form_field_email: "missing-field-config",
    default_email: "default@example.com",
  };

  const fieldConfigMap = new Map(); // Empty map

  const result = await getInvoiceEmailRecipients(
    mockSupabase,
    jobContexts,
    emailConfig,
    fieldConfigMap
  );

  // default_email is deprecated; no field config match => no recipient
  assertEquals(result, []);
});

Deno.test("P0: should handle empty string emails", async () => {
  const mockSupabase = createMockSupabase();
  const jobContexts: JobContext[] = [
    {
      location_id: "loc-1",
      location: {
        id: "loc-1",
        email: "",
        contact_person: null,
        hierarchy_parent_id: null,
      },
      submission_data: {},
    },
  ];

  const emailConfig: InvoiceEmailRecipientConfig = {
    location_email_source: "location_email",
    form_field_email: null,
    default_email: "default@example.com",
  };

  const fieldConfigMap = new Map();

  const result = await getInvoiceEmailRecipients(
    mockSupabase,
    jobContexts,
    emailConfig,
    fieldConfigMap
  );

  // default_email is deprecated; empty location email => no recipient
  assertEquals(result, []);
});

Deno.test("P0: should trim whitespace from emails", async () => {
  const mockSupabase = createMockSupabase();
  const jobContexts: JobContext[] = [
    {
      location_id: "loc-1",
      location: {
        id: "loc-1",
        email: "  location@example.com  ",
        contact_person: null,
        hierarchy_parent_id: null,
      },
      submission_data: {},
    },
  ];

  const emailConfig: InvoiceEmailRecipientConfig = {
    location_email_source: "location_email",
    form_field_email: null,
    default_email: null,
  };

  const fieldConfigMap = new Map();

  const result = await getInvoiceEmailRecipients(
    mockSupabase,
    jobContexts,
    emailConfig,
    fieldConfigMap
  );

  assertEquals(result, ["location@example.com"]);
});

Deno.test("P0: should deduplicate email recipients for multiple jobs", async () => {
  const mockSupabase = createMockSupabase();
  const jobContexts: JobContext[] = [
    {
      location_id: "loc-1",
      location: {
        id: "loc-1",
        email: "same@example.com",
        contact_person: null,
        hierarchy_parent_id: null,
      },
      submission_data: {},
    },
    {
      location_id: "loc-2",
      location: {
        id: "loc-2",
        email: "same@example.com",
        contact_person: null,
        hierarchy_parent_id: null,
      },
      submission_data: {},
    },
  ];

  const emailConfig: InvoiceEmailRecipientConfig = {
    location_email_source: "location_email",
    form_field_email: null,
    default_email: null,
  };

  const fieldConfigMap = new Map();

  const result = await getInvoiceEmailRecipients(
    mockSupabase,
    jobContexts,
    emailConfig,
    fieldConfigMap
  );

  assertEquals(result, ["same@example.com"]);
});
