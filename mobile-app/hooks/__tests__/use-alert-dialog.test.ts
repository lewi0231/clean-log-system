import { useFocusEffect } from "@react-navigation/native";
import { act, renderHook } from "@testing-library/react";
import { useRouter } from "expo-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAlertDialog } from "../use-alert-dialog";

// Mock dependencies
vi.mock("expo-router", () => ({
  useRouter: vi.fn(),
}));

// Track focus effect callbacks for manual execution in tests
let focusEffectCallbacks: (() => void | (() => void))[] = [];
let focusEffectCleanups: (() => void)[] = [];

vi.mock("@react-navigation/native", () => ({
  useFocusEffect: vi.fn((callback) => {
    // useFocusEffect runs the callback when screen comes into focus
    // In real usage, it executes on mount and when screen gains focus
    // For testing, we store it but don't auto-execute to prevent infinite loops
    // Tests can manually trigger it when simulating focus events
    focusEffectCallbacks.push(callback);
    // Don't execute automatically - let tests control when focus happens
    // This prevents the focus effect from clearing state during tests
    return () => {
      // Cleanup function (runs when screen loses focus)
      const cleanup = callback();
      if (typeof cleanup === "function") {
        focusEffectCleanups.push(cleanup);
      }
    };
  }),
}));

describe("useAlertDialog", () => {
  const mockReplace = vi.fn();
  const mockRouter = {
    replace: mockReplace,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    focusEffectCallbacks = [];
    focusEffectCleanups = [];
    mockReplace.mockClear();
    (useRouter as any).mockReturnValue(mockRouter);
  });

  describe("Initial state", () => {
    it("should initialize with dialog closed", () => {
      const { result } = renderHook(() => useAlertDialog());

      expect(result.current.alertOpen).toBe(false);
      expect(result.current.alertTitle).toBe("");
      expect(result.current.alertMessage).toBe("");
    });
  });

  describe("showAlert", () => {
    it("should show alert with title and message", () => {
      const { result } = renderHook(() => useAlertDialog());

      act(() => {
        result.current.showAlert("Test Title", "Test Message");
      });

      expect(result.current.alertOpen).toBe(true);
      expect(result.current.alertTitle).toBe("Test Title");
      expect(result.current.alertMessage).toBe("Test Message");
    });

    it("should accept optional callback", () => {
      const { result } = renderHook(() => useAlertDialog());
      const callback = vi.fn();

      act(() => {
        result.current.showAlert("Title", "Message", callback);
      });

      expect(result.current.alertOpen).toBe(true);
    });
  });

  describe("showSuccessAndNavigate", () => {
    it("should show success alert and set up navigation callback", () => {
      const { result } = renderHook(() => useAlertDialog());

      act(() => {
        result.current.showSuccessAndNavigate("Entry submitted successfully!");
      });

      expect(result.current.alertOpen).toBe(true);
      expect(result.current.alertTitle).toBe("Success");
      expect(result.current.alertMessage).toBe("Entry submitted successfully!");
    });

    it("should navigate when OK is clicked", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useAlertDialog());

      act(() => {
        result.current.showSuccessAndNavigate("Success message", "./home");
      });

      // Simulate OK button press - this sets the flag and closes the dialog
      act(() => {
        result.current.handleOkPress();
      });

      // In the real app, AlertDialogAction calls handleClose() which eventually
      // calls handleDialogChange(false). We simulate this here.
      // Note: handleOkPress already set alertOpen to false, so this is the
      // callback that actually triggers the navigation logic.
      act(() => {
        result.current.handleDialogChange(false);
      });

      // Fast-forward past the 500ms animation delay
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Fast-forward past the 100ms navigation delay
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(mockReplace).toHaveBeenCalledWith("./home");
      vi.useRealTimers();
    });

    it("should not navigate if dialog is closed without OK press", () => {
      vi.useFakeTimers();
      mockReplace.mockClear();

      const { result } = renderHook(() => useAlertDialog());

      // Set up success alert with navigation
      act(() => {
        result.current.showSuccessAndNavigate("Success message", "./test");
      });

      expect(result.current.alertOpen).toBe(true);
      expect(mockReplace).not.toHaveBeenCalled();

      // IMPORTANT: We are NOT calling handleOkPress() here
      // This means okButtonPressedRef.current should be false
      // When we close the dialog, handleDialogChange should detect this
      // and clear alertOnConfirm without executing it

      // Close dialog directly (simulating user dismissing without OK)
      act(() => {
        result.current.handleDialogChange(false);
      });

      expect(result.current.alertOpen).toBe(false);

      // Advance timers - the callback should NOT execute because:
      // 1. okButtonPressedRef.current was false (we never called handleOkPress)
      // 2. handleDialogChange went to the else branch (line 85-88)
      // 3. alertOnConfirm was cleared to null
      // 4. No setTimeout was scheduled
      act(() => {
        vi.runAllTimers(); // Run all pending timers
      });

      // Navigation should NOT have been called
      expect(mockReplace).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("Focus effect", () => {
    it("should clear dialog state when screen comes into focus", () => {
      const { result } = renderHook(() => useAlertDialog());

      // Show alert first
      act(() => {
        result.current.showAlert("Title", "Message");
      });

      expect(result.current.alertOpen).toBe(true);
      expect(result.current.alertTitle).toBe("Title");
      expect(result.current.alertMessage).toBe("Message");

      // Simulate screen coming into focus by manually executing the focus effect
      // This simulates navigating back to the screen
      act(() => {
        // Execute the most recent focus effect callback
        const latestCallback =
          focusEffectCallbacks[focusEffectCallbacks.length - 1];
        if (latestCallback) {
          latestCallback();
        }
      });

      // The focus effect should have cleared the state
      expect(result.current.alertOpen).toBe(false);
      expect(result.current.alertTitle).toBe("");
      expect(result.current.alertMessage).toBe("");
      expect(useFocusEffect).toHaveBeenCalled();
    });
  });

  describe("handleDialogChange", () => {
    it("should reset OK flag when dialog opens", () => {
      const { result } = renderHook(() => useAlertDialog());

      act(() => {
        result.current.showAlert("Title", "Message", () => {});
        result.current.handleOkPress(); // Set flag
        result.current.handleDialogChange(true); // Open again
      });

      // Flag should be reset (we can't directly test ref, but behavior should work)
      expect(result.current.alertOpen).toBe(true);
    });
  });

  describe("Consecutive dialog interactions", () => {
    it("should NOT execute previous callback when showing a new dialog", () => {
      vi.useFakeTimers();
      mockReplace.mockClear();

      const { result } = renderHook(() => useAlertDialog());

      // First dialog: show success and set up navigation
      act(() => {
        result.current.showSuccessAndNavigate("First success", "./first");
      });

      expect(result.current.alertOpen).toBe(true);

      // Simulate clicking OK on first dialog
      act(() => {
        result.current.handleOkPress();
      });

      // Before the dialog fully closes, show a NEW dialog
      // (This simulates the scenario where okButtonPressedRef might be stale)
      act(() => {
        result.current.showSuccessAndNavigate("Second success", "./second");
      });

      // The new dialog should be shown
      expect(result.current.alertOpen).toBe(true);
      expect(result.current.alertMessage).toBe("Second success");

      // Now close the second dialog WITHOUT clicking OK
      // (simulating the user dismissing it)
      act(() => {
        result.current.handleDialogChange(false);
      });

      // Advance all timers
      act(() => {
        vi.runAllTimers();
      });

      // Navigation should NOT have happened because:
      // 1. showAlert resets okButtonPressedRef.current to false
      // 2. The user didn't click OK on the second dialog
      expect(mockReplace).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("should wait for OK click before navigating on success dialog", () => {
      vi.useFakeTimers();
      mockReplace.mockClear();

      const { result } = renderHook(() => useAlertDialog());

      // Show success dialog
      act(() => {
        result.current.showSuccessAndNavigate("Entry submitted!", "./home");
      });

      expect(result.current.alertOpen).toBe(true);
      expect(result.current.alertTitle).toBe("Success");
      expect(mockReplace).not.toHaveBeenCalled();

      // Advance time - should NOT navigate yet (no OK click)
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockReplace).not.toHaveBeenCalled();

      // Now click OK
      act(() => {
        result.current.handleOkPress();
      });

      // Dialog should close
      expect(result.current.alertOpen).toBe(false);

      // Simulate the AlertDialog component calling handleDialogChange(false)
      // (This happens after the animation in the real component)
      act(() => {
        result.current.handleDialogChange(false);
      });

      // Advance past the 500ms delay in handleDialogChange
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Advance past the 100ms delay in the navigation callback
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // NOW navigation should have happened
      expect(mockReplace).toHaveBeenCalledWith("./home");

      vi.useRealTimers();
    });
  });
});
