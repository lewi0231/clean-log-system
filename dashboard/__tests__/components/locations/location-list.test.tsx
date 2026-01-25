import LocationList from "@/components/locations/location-list";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockLocation,
  createMockLocationHierarchyNode,
} from "../../lib/fixtures";

// Mock useLocationHierarchy since LocationForm uses it
vi.mock("@/hooks/use-location-hierarchy", () => ({
  useLocationHierarchy: () => ({
    nodes: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
    createNode: vi.fn(),
    updateNode: vi.fn(),
    deleteNode: vi.fn(),
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  Wrapper.displayName = "QueryClientWrapper";

  return Wrapper;
}

describe("LocationList", () => {
  const mockOnDeleteLocation = vi.fn();
  const mockOnUpdateLocation = vi.fn();

  const defaultProps = {
    locations: [],
    loading: false,
    error: null,
    onDeleteLocation: mockOnDeleteLocation,
    onUpdateLocation: mockOnUpdateLocation,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render location list with locations", () => {
      const locations = [
        createMockLocation({ name: "Location 1" }),
        createMockLocation({ name: "Location 2", id: "location-2" }),
      ];

      render(<LocationList {...defaultProps} locations={locations} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Location 1")).toBeInTheDocument();
      expect(screen.getByText("Location 2")).toBeInTheDocument();
    });

    it("should render empty state when no locations", () => {
      render(<LocationList {...defaultProps} />, { wrapper: createWrapper() });

      expect(
        screen.getByText(
          "No locations found. Add your first location to get started."
        )
      ).toBeInTheDocument();
    });

    it("should render loading state", () => {
      render(<LocationList {...defaultProps} loading={true} />, {
        wrapper: createWrapper(),
      });

      // TableSkeleton should be rendered
      expect(screen.queryByText("No locations found")).not.toBeInTheDocument();
    });

    it("should render error state", () => {
      render(
        <LocationList {...defaultProps} error="Failed to load locations" />,
        { wrapper: createWrapper() }
      );

      expect(
        screen.getByText("Error: Failed to load locations")
      ).toBeInTheDocument();
    });

    it("should display location details", () => {
      const location = createMockLocation({
        name: "Main Office",
        email: "office@example.com",
        address: "123 Main St",
        contact_person: "John Doe",
        phone: "1234567890",
      });

      render(<LocationList {...defaultProps} locations={[location]} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Main Office")).toBeInTheDocument();
      expect(screen.getByText("office@example.com")).toBeInTheDocument();
      expect(screen.getByText("123 Main St")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("1234567890")).toBeInTheDocument();
    });

    it("should display hierarchy parent badge", () => {
      const hierarchyParent = createMockLocationHierarchyNode({
        name: "Test Region",
        type: "region",
      });
      const location = createMockLocation({
        hierarchy_parent: hierarchyParent,
      });

      render(<LocationList {...defaultProps} locations={[location]} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Test Region")).toBeInTheDocument();
      expect(screen.getByText("region")).toBeInTheDocument();
    });

    it("should display 'Org default' when no hierarchy parent", () => {
      const location = createMockLocation({
        hierarchy_parent: null,
        hierarchy_parent_id: null,
      });

      render(<LocationList {...defaultProps} locations={[location]} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Org default")).toBeInTheDocument();
    });

    it("should display active status badge", () => {
      const location = createMockLocation({ active: true });

      render(<LocationList {...defaultProps} locations={[location]} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("should display inactive status badge", () => {
      const location = createMockLocation({ active: false });

      render(<LocationList {...defaultProps} locations={[location]} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Inactive")).toBeInTheDocument();
    });

    it("should handle missing optional fields", () => {
      const location = createMockLocation({
        address: null,
        contact_person: null,
        phone: null,
      });

      render(<LocationList {...defaultProps} locations={[location]} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getAllByText("-")).toHaveLength(3);
    });
  });

  describe("User Interactions", () => {
    it("should handle edit button click", async () => {
      const location = createMockLocation();

      render(<LocationList {...defaultProps} locations={[location]} />, {
        wrapper: createWrapper(),
      });

      // Edit button is an icon button - find it by the pencil icon
      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) =>
        btn.querySelector('svg[class*="pencil"]')
      );

      expect(editButton).toBeDefined();
      if (editButton) {
        fireEvent.click(editButton);

        // Location form should open
        await waitFor(() => {
          expect(screen.getByRole("heading", { name: /edit location/i })).toBeInTheDocument();
        });
      }
    });

    it("should handle delete button click", async () => {
      const location = createMockLocation({ name: "Test Location" });

      render(<LocationList {...defaultProps} locations={[location]} />, {
        wrapper: createWrapper(),
      });

      // Delete button is an icon button - find it by the trash icon
      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find((btn) =>
        btn.querySelector('svg[class*="trash"]')
      );

      expect(deleteButton).toBeDefined();
      if (deleteButton) {
        fireEvent.click(deleteButton);

        // Delete confirmation dialog should appear
        await waitFor(() => {
          expect(
            screen.getByText(/Are you sure/i)
          ).toBeInTheDocument();
        });
        expect(
          screen.getByText(/This action cannot be undone/i)
        ).toBeInTheDocument();
        // Location name appears in both table and dialog, so use queryAllByText
        const locationTexts = screen.queryAllByText(/Test Location/i);
        expect(locationTexts.length).toBeGreaterThan(0);
      }
    });

    it("should handle delete confirmation", async () => {
      const location = createMockLocation({ id: "location-1" });
      mockOnDeleteLocation.mockResolvedValue(undefined);

      render(<LocationList {...defaultProps} locations={[location]} />, {
        wrapper: createWrapper(),
      });

      // Delete button is an icon button - find it by the trash icon
      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find((btn) =>
        btn.querySelector('svg[class*="trash"]')
      );

      expect(deleteButton).toBeDefined();
      if (deleteButton) {
        fireEvent.click(deleteButton);

        await waitFor(() => {
          expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();
        });

        const confirmButton = screen.getByRole("button", { name: /^delete$/i });
        fireEvent.click(confirmButton);

        await waitFor(() => {
          expect(mockOnDeleteLocation).toHaveBeenCalledWith("location-1");
        });
      }
    });

    it("should handle delete cancellation", async () => {
      const location = createMockLocation();

      render(<LocationList {...defaultProps} locations={[location]} />, {
        wrapper: createWrapper(),
      });

      // Delete button is an icon button - find it by the trash icon
      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find((btn) =>
        btn.querySelector('svg[class*="trash"]')
      );

      expect(deleteButton).toBeDefined();
      if (deleteButton) {
        fireEvent.click(deleteButton);

        await waitFor(() => {
          expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();
        });

        const cancelButton = screen.getByRole("button", { name: /cancel/i });
        fireEvent.click(cancelButton);

        await waitFor(() => {
          expect(screen.queryByText(/Are you sure/i)).not.toBeInTheDocument();
        });

        expect(mockOnDeleteLocation).not.toHaveBeenCalled();
      }
    });

    it("should display table with correct columns", () => {
      render(<LocationList {...defaultProps} locations={[]} />);

      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Region / Company")).toBeInTheDocument();
      expect(screen.getByText("Email")).toBeInTheDocument();
      expect(screen.getByText("Address")).toBeInTheDocument();
      expect(screen.getByText("Contact Person")).toBeInTheDocument();
      expect(screen.getByText("Phone")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });
  });

  describe("Location Form Integration", () => {
    it("should open form when editing location", async () => {
      const location = createMockLocation({
        name: "Test Location",
        email: "test@example.com",
      });

      render(<LocationList {...defaultProps} locations={[location]} />, {
        wrapper: createWrapper(),
      });

      // Edit button is an icon button - find it by the pencil icon
      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) =>
        btn.querySelector('svg[class*="pencil"]')
      );

      expect(editButton).toBeDefined();
      if (editButton) {
        fireEvent.click(editButton);

        await waitFor(() => {
          expect(screen.getByDisplayValue("Test Location")).toBeInTheDocument();
          expect(screen.getByDisplayValue("test@example.com")).toBeInTheDocument();
        });
      }
    });

    it("should call onUpdateLocation when form is submitted", async () => {
      const location = createMockLocation({ id: "location-1" });
      mockOnUpdateLocation.mockResolvedValue(undefined);

      render(<LocationList {...defaultProps} locations={[location]} />, {
        wrapper: createWrapper(),
      });

      // Edit button is an icon button - find it by the pencil icon
      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) =>
        btn.querySelector('svg[class*="pencil"]')
      );

      expect(editButton).toBeDefined();
      if (editButton) {
        fireEvent.click(editButton);

        await waitFor(() => {
          expect(screen.getByRole("heading", { name: /edit location/i })).toBeInTheDocument();
        });

        const nameInput = screen.getByLabelText("Name");
        fireEvent.change(nameInput, { target: { value: "Updated Location" } });

        const submitButton = screen.getByRole("button", { name: /update/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
          expect(mockOnUpdateLocation).toHaveBeenCalledWith(
            "location-1",
            expect.objectContaining({
              name: "Updated Location",
            })
          );
        });
      }
    });

    it("should close form when cancel is clicked", async () => {
      const location = createMockLocation();

      render(<LocationList {...defaultProps} locations={[location]} />, {
        wrapper: createWrapper(),
      });

      // Edit button is an icon button - find it by the pencil icon
      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) =>
        btn.querySelector('svg[class*="pencil"]')
      );

      expect(editButton).toBeDefined();
      if (editButton) {
        fireEvent.click(editButton);

        await waitFor(() => {
          expect(screen.getByRole("heading", { name: /edit location/i })).toBeInTheDocument();
        });

        const cancelButton = screen.getByRole("button", { name: /cancel/i });
        fireEvent.click(cancelButton);

        await waitFor(() => {
          expect(screen.queryByRole("heading", { name: /edit location/i })).not.toBeInTheDocument();
        });
      }
    });
  });
});
