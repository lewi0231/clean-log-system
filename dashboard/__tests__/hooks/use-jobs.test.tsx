import { useJobs } from "@/hooks/use-jobs";
import { JobsService } from "@/lib/services";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockJob } from "../lib/fixtures";

vi.mock("@/lib/services", () => ({
  JobsService: {
    list: vi.fn(),
  },
}));

const mockUseOrganization = vi.hoisted(() =>
  vi.fn(() => ({
    organizationId: "org-1",
    loading: false,
    error: null,
  }))
);

vi.mock("@/hooks/useOrganization", () => ({
  default: mockUseOrganization,
}));

describe("useJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch jobs on mount", async () => {
    const mockJobs = [createMockJob()];
    vi.mocked(JobsService.list).mockResolvedValue({
      success: true,
      jobs: mockJobs,
    });

    const { result } = renderHook(() => useJobs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.jobs).toEqual(mockJobs);
    expect(result.current.error).toBeNull();
  });

  it("should handle loading state", async () => {
    vi.mocked(JobsService.list).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              jobs: [],
            });
          }, 100);
        })
    );

    const { result } = renderHook(() => useJobs());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("should handle error state", async () => {
    const mockError = new Error("Failed to fetch");
    vi.mocked(JobsService.list).mockRejectedValue(mockError);

    const { result } = renderHook(() => useJobs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch");
    expect(result.current.jobs).toEqual([]);
  });

  it("should refetch jobs", async () => {
    vi.mocked(JobsService.list).mockResolvedValue({
      success: true,
      jobs: [],
    });

    const { result } = renderHook(() => useJobs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.refetch();

    expect(JobsService.list).toHaveBeenCalledTimes(2);
  });
});
