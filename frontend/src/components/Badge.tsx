import { ReactNode } from "react";

type Variant = "success" | "warning" | "danger" | "info" | "purple" | "default";

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

const variantClasses: Record<Variant, string> = {
  success: "bg-status-added-bg text-accent",
  warning: "bg-status-modified-bg text-warning",
  danger: "bg-status-deleted-bg text-danger",
  info: "bg-status-renamed-bg text-info",
  purple: "bg-pr-merged-bg text-purple",
  default: "bg-btn-secondary text-text-secondary",
};

export function Badge({
  variant = "default",
  children,
  className = "",
  "aria-label": ariaLabel,
}: BadgeProps) {
  return (
    <span
      className={`inline-block shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-semibold ${variantClasses[variant]} ${className}`}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    >
      {children}
    </span>
  );
}
