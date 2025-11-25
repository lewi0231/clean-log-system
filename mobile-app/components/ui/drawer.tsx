import * as React from "react";
import { Sheet, useSheet } from "./sheet";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  size?: "small" | "medium" | "large" | "full" | number[];
  initialSnapIndex?: number;
  contentClassName?: string;
  avoidKeyboard?: boolean;
  closeOnBackdropPress?: boolean;
  disableBackHandler?: boolean;
}

// Convert size array to number (use first value) or pass through
const normalizeSize = (
  size: "small" | "medium" | "large" | "full" | number[] | undefined
): "small" | "medium" | "large" | "full" | number => {
  if (!size) return "medium";
  if (Array.isArray(size)) {
    // If it's an array, use the first value as a percentage
    // For example, [0.5] means 50% of screen height
    return size[0] || 0.5;
  }
  return size;
};

const Drawer = React.forwardRef<React.ElementRef<typeof Sheet>, DrawerProps>(
  (
    {
      open,
      onClose,
      children,
      title,
      description,
      size = "medium",
      initialSnapIndex,
      contentClassName,
      avoidKeyboard = true,
      closeOnBackdropPress = true,
      disableBackHandler = false,
    },
    ref
  ) => {
    const normalizedSize = React.useMemo(() => normalizeSize(size), [size]);

    return (
      <Sheet
        ref={ref}
        open={open}
        onClose={onClose}
        title={title}
        description={description}
        size={normalizedSize}
        side="bottom"
        contentClassName={contentClassName}
        avoidKeyboard={avoidKeyboard}
        closeOnBackdropPress={closeOnBackdropPress}
        disableBackHandler={disableBackHandler}
      >
        {children}
      </Sheet>
    );
  }
);

Drawer.displayName = "Drawer";

// Export useDrawer hook that wraps useSheet
export const useDrawer = () => {
  const sheet = useSheet();
  return sheet;
};

export { Drawer };
