import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Glassmorphic card component with frosted glass effect
 * Uses backdrop blur and semi-transparent background for modern glass effect
 */
export default function GlassCard({
  title,
  children,
  className = "",
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "bg-white/10 backdrop-blur-md border border-white/20 rounded-lg shadow-lg hover:bg-white/15 transition-all duration-300",
        className
      )}
    >
      {title && (
        <h3 className="text-lg font-bold mb-4 px-6 pt-6">{title}</h3>
      )}
      {children}
    </div>
  );
}

