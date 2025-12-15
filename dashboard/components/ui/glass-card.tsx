import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface GlassCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Card component with clean light theme styling
 * Uses solid white background with subtle shadows for depth
 */
export default function GlassCard({
  title,
  children,
  className = "",
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg card-shadow hover:card-shadow-hover transition-all duration-300",
        className
      )}
    >
      {title && <h3 className="text-lg font-bold mb-4 px-6 pt-6">{title}</h3>}
      {children}
    </div>
  );
}
