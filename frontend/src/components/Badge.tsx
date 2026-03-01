import { ReactNode } from "react";

type Variant = "success" | "warning" | "danger" | "info" | "accent" | "default";

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

const variantClasses: Record<Variant, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-status-modified-bg text-warning",
  danger: "bg-status-deleted-bg text-danger",
  info: "bg-status-renamed-bg text-info",
  accent: "bg-pr-merged-bg text-purple",
  default: "bg-btn-secondary text-text-primary ring-1 ring-border",
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
