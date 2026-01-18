import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";

/**
 * Hook to manage alert dialog state and navigation
 *
 * Features:
 * - Clears dialog state when screen comes into focus (prevents persistence)
 * - Handles navigation callbacks that only execute when OK is clicked
 * - Testable separation of concerns
 */
export function useAlertDialog() {
    const router = useRouter();
    const [alertOpen, setAlertOpen] = useState(false);
    const [alertTitle, setAlertTitle] = useState("");
    const [alertMessage, setAlertMessage] = useState("");

    // Use refs for callback and OK flag to avoid stale closure issues
    // This ensures handleDialogChange always sees the latest values
    const alertOnConfirmRef = useRef<(() => void) | null>(null);
    const okButtonPressedRef = useRef(false);

    // Clear alert dialog state when screen comes into focus
    // This prevents dialog from persisting when navigating back to the screen
    useFocusEffect(
        useCallback(() => {
            setAlertOpen(false);
            setAlertTitle("");
            setAlertMessage("");
            alertOnConfirmRef.current = null;
            okButtonPressedRef.current = false;
        }, []),
    );

    /**
     * Show an alert dialog
     */
    const showAlert = useCallback(
        (title: string, message: string, onConfirm?: () => void) => {
            // CRITICAL: Reset flags when showing a new dialog
            // This prevents callbacks from previous dialogs from executing
            okButtonPressedRef.current = false;
            alertOnConfirmRef.current = onConfirm || null;

            setAlertTitle(title);
            setAlertMessage(message);
            setAlertOpen(true);
        },
        [],
    );

    /**
     * Show success alert and navigate after OK is clicked
     */
    const showSuccessAndNavigate = useCallback(
        (message: string, navigateTo: string = "./") => {
            showAlert("Success", message, () => {
                // Navigation callback - only executes when OK is clicked
                setTimeout(() => {
                    router.replace(navigateTo);
                }, 100);
            });
        },
        [router, showAlert],
    );

    /**
     * Handle dialog open/close changes
     */
    const handleDialogChange = useCallback(
        (open: boolean) => {
            setAlertOpen(open);

            // Reset flag when dialog opens
            if (open) {
                okButtonPressedRef.current = false;
                return;
            }

            // Only execute callback when dialog is closed AND OK button was pressed
            // Using refs ensures we always have the latest callback and flag values
            const callback = alertOnConfirmRef.current;
            const wasOkPressed = okButtonPressedRef.current;

            if (!open && callback && wasOkPressed) {
                // Clear immediately to prevent double execution
                alertOnConfirmRef.current = null;
                okButtonPressedRef.current = false;

                // Wait for dialog animation to complete before executing callback
                setTimeout(() => {
                    callback();
                }, 500);
            } else if (!open) {
                // Clear callback and reset flag if dialog is closed without OK press
                alertOnConfirmRef.current = null;
                okButtonPressedRef.current = false;
            }
        },
        [], // No dependencies needed - we use refs
    );

    /**
     * Handle OK button press
     */
    const handleOkPress = useCallback(() => {
        okButtonPressedRef.current = true;
        setAlertOpen(false);
    }, []);

    return {
        alertOpen,
        alertTitle,
        alertMessage,
        showAlert,
        showSuccessAndNavigate,
        handleDialogChange,
        handleOkPress,
    };
}
