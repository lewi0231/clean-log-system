/**
 * Tests for useWorkerRateCards hook
 *
 * Tests state management and CRUD operations for worker rate cards
 * with modifier types (per_unit, flat, multiplier).
 */

import { useWorkerRateCards } from "@/hooks/use-worker-rate-cards";
import useOrganization from "@/hooks/useOrganization";
import { WorkerRateCardService } from "@/lib/services/worker-rate-card.service";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/hooks/useOrganization", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/services/worker-rate-card.service", () => ({
  WorkerRateCardService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(), // Now takes (organizationId, request)
    deactivate: vi.fn(), // Now takes (organizationId, id)
    delete: vi.fn(), // Now takes (organizationId, id)
  },
}));

vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockRateCards = [
  {
    id: "rate-1",
    organization_id: "org-1",
    worker_id: "worker-1",
    modifier_type: "flat" as const,
    modifier_value: 25,
    currency: "AUD",
    effective_from: "2024-01-01",
    effective_to: null,
    role_title: "Supervisor",
    is_active: true,
    notes: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    field_config_ids: [],
  },
  {
    id: "rate-2",
    organization_id: "org-1",
    worker_id: "worker-2",
    modifier_type: "per_unit" as const,
    modifier_value: 0.5,
    currency: "AUD",
    effective_from: "2024-01-01",
    effective_to: null,
    role_title: null,
    is_active: true,
    notes: null,
    created_at: "2024-01-02T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    field_config_ids: ["field-1"],
  },
];

describe("useWorkerRateCards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOrganization).mockReturnValue({
      organizationId: "org-1",
      organizationUserId: "user-1",
      userRole: "admin",
      loading: false,
      error: undefined,
    });
  });

  describe("initial state and fetching", () => {
    it("should initialize with empty array and loading=true", () => {
      vi.mocked(WorkerRateCardService.list).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useWorkerRateCards());

      expect(result.current.rateCards).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should set loading=false after fetch completes", async () => {
      vi.mocked(WorkerRateCardService.list).mockResolvedValue(mockRateCards);

      const { result } = renderHook(() => useWorkerRateCards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it("should store rate cards in state after successful fetch", async () => {
      vi.mocked(WorkerRateCardService.list).mockResolvedValue(mockRateCards);

      const { result } = renderHook(() => useWorkerRateCards());

      await waitFor(() => {
        expect(result.current.rateCards).toHaveLength(2);
        expect(result.current.rateCards[0].id).toBe("rate-1");
        expect(result.current.rateCards[1].modifier_type).toBe("per_unit");
      });
    });

    it("should set error state on fetch failure", async () => {
      vi.mocked(WorkerRateCardService.list).mockRejectedValue(new Error("Failed to fetch"));

      const { result } = renderHook(() => useWorkerRateCards());

      await waitFor(() => {
        expect(result.current.error).toBe("Failed to fetch");
        expect(result.current.loading).toBe(false);
      });
    });

    it("should handle missing organizationId", async () => {
      vi.mocked(useOrganization).mockReturnValue({
        organizationId: null,
        organizationUserId: null,
        userRole: null,
        loading: false,
        error: undefined,
      });

      const { result } = renderHook(() => useWorkerRateCards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(WorkerRateCardService.list).not.toHaveBeenCalled();
    });

    it("should refetch when organizationId changes", async () => {
      const { result, rerender } = renderHook(() => useWorkerRateCards());

      vi.mocked(WorkerRateCardService.list).mockResolvedValue(mockRateCards);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(WorkerRateCardService.list).toHaveBeenCalledWith("org-1");

      // Change organizationId
      vi.mocked(useOrganization).mockReturnValue({
        organizationId: "org-2",
        organizationUserId: "user-1",
        userRole: "admin",
        loading: false,
        error: undefined,
      });

      rerender();

      await waitFor(() => {
        expect(WorkerRateCardService.list).toHaveBeenCalledWith("org-2");
      });
    });
  });

  describe("createRateCard", () => {
    it("should call service and refetch after creation", async () => {
      vi.mocked(WorkerRateCardService.list).mockResolvedValue(mockRateCards);
      vi.mocked(WorkerRateCardService.create).mockResolvedValue(mockRateCards[0]);

      const { result } = renderHook(() => useWorkerRateCards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newCard = await result.current.createRateCard({
        worker_id: "worker-1",
        modifier_type: "flat",
        modifier_value: 25,
        role_title: "Supervisor",
      });

      expect(WorkerRateCardService.create).toHaveBeenCalledWith({
        organization_id: "org-1",
        worker_id: "worker-1",
        modifier_type: "flat",
        modifier_value: 25,
        role_title: "Supervisor",
      });
      expect(newCard.id).toBe("rate-1");
    });

    it("should throw error when organizationId is missing", async () => {
      vi.mocked(useOrganization).mockReturnValue({
        organizationId: null,
        organizationUserId: null,
        userRole: null,
        loading: false,
        error: undefined,
      });

      const { result } = renderHook(() => useWorkerRateCards());

      await expect(
        result.current.createRateCard({
          worker_id: "worker-1",
          modifier_type: "flat",
          modifier_value: 25,
        })
      ).rejects.toThrow("Organization ID is required");
    });

    it("should add organizationId to request automatically", async () => {
      vi.mocked(WorkerRateCardService.list).mockResolvedValue([]);
      vi.mocked(WorkerRateCardService.create).mockResolvedValue(mockRateCards[0]);

      const { result } = renderHook(() => useWorkerRateCards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.createRateCard({
        worker_id: "worker-1",
        modifier_type: "flat",
        modifier_value: 25,
      });

      expect(WorkerRateCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: "org-1",
        })
      );
    });

    it("should handle per_unit type with field_config_ids", async () => {
      vi.mocked(WorkerRateCardService.list).mockResolvedValue([]);
      vi.mocked(WorkerRateCardService.create).mockResolvedValue(mockRateCards[1]);

      const { result } = renderHook(() => useWorkerRateCards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.createRateCard({
        worker_id: "worker-2",
        modifier_type: "per_unit",
        modifier_value: 0.5,
        field_config_ids: ["field-1"],
      });

      expect(WorkerRateCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          modifier_type: "per_unit",
          field_config_ids: ["field-1"],
        })
      );
    });
  });

  describe("updateRateCard", () => {
    it("should call service and refetch after update", async () => {
      vi.mocked(WorkerRateCardService.list).mockResolvedValue(mockRateCards);
      vi.mocked(WorkerRateCardService.update).mockResolvedValue({
        ...mockRateCards[0],
        modifier_value: 30,
      });

      const { result } = renderHook(() => useWorkerRateCards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const updatedCard = await result.current.updateRateCard({
        id: "rate-1",
        modifier_value: 30,
      });

      expect(WorkerRateCardService.update).toHaveBeenCalledWith("org-1", {
        id: "rate-1",
        modifier_value: 30,
      });
      expect(updatedCard.modifier_value).toBe(30);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(WorkerRateCardService.list).mockResolvedValue(mockRateCards);
      vi.mocked(WorkerRateCardService.update).mockRejectedValue(new Error("Update failed"));

      const { result } = renderHook(() => useWorkerRateCards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        result.current.updateRateCard({
          id: "rate-1",
          modifier_value: 30,
        })
      ).rejects.toThrow("Update failed");
    });
  });

  describe("deactivateRateCard", () => {
    it("should call service and refetch after deactivation", async () => {
      vi.mocked(WorkerRateCardService.list).mockResolvedValue(mockRateCards);
      vi.mocked(WorkerRateCardService.deactivate).mockResolvedValue(undefined);

      const { result } = renderHook(() => useWorkerRateCards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.deactivateRateCard("rate-1");

      expect(WorkerRateCardService.deactivate).toHaveBeenCalledWith("org-1", "rate-1");
      // Verify refetch was triggered
      expect(WorkerRateCardService.list).toHaveBeenCalledTimes(2);
    });
  });

  describe("deleteRateCard", () => {
    it("should call service and refetch after deletion", async () => {
      vi.mocked(WorkerRateCardService.list).mockResolvedValue(mockRateCards);
      vi.mocked(WorkerRateCardService.delete).mockResolvedValue(undefined);

      const { result } = renderHook(() => useWorkerRateCards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.deleteRateCard("rate-1");

      expect(WorkerRateCardService.delete).toHaveBeenCalledWith("org-1", "rate-1");
      // Verify refetch was triggered
      expect(WorkerRateCardService.list).toHaveBeenCalledTimes(2);
    });
  });

  describe("refetch", () => {
    it("should manually trigger refetch", async () => {
      vi.mocked(WorkerRateCardService.list).mockResolvedValue(mockRateCards);

      const { result } = renderHook(() => useWorkerRateCards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(WorkerRateCardService.list).toHaveBeenCalledTimes(1);

      await result.current.refetch();

      expect(WorkerRateCardService.list).toHaveBeenCalledTimes(2);
    });

    it("should update state with latest data", async () => {
      vi.mocked(WorkerRateCardService.list)
        .mockResolvedValueOnce(mockRateCards)
        .mockResolvedValueOnce([mockRateCards[0]]); // Second call returns fewer

      const { result } = renderHook(() => useWorkerRateCards());

      await waitFor(() => {
        expect(result.current.rateCards).toHaveLength(2);
      });

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.rateCards).toHaveLength(1);
      });
    });
  });

  describe("modifier types", () => {
    it("should handle flat modifier type correctly", async () => {
      vi.mocked(WorkerRateCardService.list).mockResolvedValue([mockRateCards[0]]);

      const { result } = renderHook(() => useWorkerRateCards());

      await waitFor(() => {
        expect(result.current.rateCards[0].modifier_type).toBe("flat");
        expect(result.current.rateCards[0].modifier_value).toBe(25);
      });
    });

    it("should handle per_unit modifier type with field mappings", async () => {
      vi.mocked(WorkerRateCardService.list).mockResolvedValue([mockRateCards[1]]);

      const { result } = renderHook(() => useWorkerRateCards());

      await waitFor(() => {
        expect(result.current.rateCards[0].modifier_type).toBe("per_unit");
        expect(result.current.rateCards[0].modifier_value).toBe(0.5);
        expect(result.current.rateCards[0].field_config_ids).toEqual(["field-1"]);
      });
    });

    it("should handle multiplier modifier type", async () => {
      const multiplierCard = {
        ...mockRateCards[0],
        id: "rate-3",
        modifier_type: "multiplier" as const,
        modifier_value: 1.2,
      };
      vi.mocked(WorkerRateCardService.list).mockResolvedValue([multiplierCard]);

      const { result } = renderHook(() => useWorkerRateCards());

      await waitFor(() => {
        expect(result.current.rateCards[0].modifier_type).toBe("multiplier");
        expect(result.current.rateCards[0].modifier_value).toBe(1.2);
      });
    });
  });
});
