import { describe, expect, it } from "vitest";
import { buildSubmissionSummaryEntries } from "@/lib/submission-summary-entries";
import { getSubmitterNameForJob } from "@/lib/fetch-my-jobs";

describe("buildSubmissionSummaryEntries", () => {
  it("returns empty list for null or non-object input", () => {
    expect(buildSubmissionSummaryEntries(null)).toEqual([]);
    expect(buildSubmissionSummaryEntries(undefined)).toEqual([]);
  });

  it("renders primitive fields and humanizes keys", () => {
    const entries = buildSubmissionSummaryEntries({
      cars_washed: 12,
      notes: "All good",
    });

    expect(entries).toEqual([
      { kind: "field", label: "Cars washed", value: "12" },
      { kind: "field", label: "Notes", value: "All good" },
    ]);
  });

  it("renders grouped breakdown arrays as table entries", () => {
    const entries = buildSubmissionSummaryEntries({
      brand_breakdown: [
        { brand: "Toyota", quantity: 3 },
        { brand: "Ford", quantity: 1 },
      ],
    });

    expect(entries).toEqual([
      {
        kind: "grouped_breakdown",
        label: "Brand breakdown",
        items: [
          { brand: "Toyota", quantity: 3 },
          { brand: "Ford", quantity: 1 },
        ],
      },
    ]);
  });

  it("walks nested objects with breadcrumb labels", () => {
    const entries = buildSubmissionSummaryEntries({
      section_a: {
        item_count: 2,
      },
    });

    expect(entries).toEqual([{ kind: "field", label: "Section a › Item count", value: "2" }]);
  });
});

describe("getSubmitterNameForJob", () => {
  it("returns null when viewer submitted the job", () => {
    expect(
      getSubmitterNameForJob(
        {
          submitted_by_worker_id: "worker-1",
          workers: [{ id: "worker-1", name: "Abe" }],
        },
        "worker-1"
      )
    ).toBeNull();
  });

  it("returns submitter name for colleague viewers", () => {
    expect(
      getSubmitterNameForJob(
        {
          submitted_by_worker_id: "worker-1",
          workers: [
            { id: "worker-1", name: "Abe" },
            { id: "worker-2", name: "Charlie" },
          ],
        },
        "worker-2"
      )
    ).toBe("Abe");
  });
});
