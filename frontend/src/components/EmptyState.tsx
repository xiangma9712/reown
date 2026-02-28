import type { ReactNode } from "react";

interface EmptyStateProps {
  message: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
}

export function EmptyState({
  message,
  description,
  icon,
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-6 text-center">
      {icon && (
        <div className="mb-3 text-text-muted/50" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="text-sm text-text-secondary">{message}</p>
      {description && (
        <p className="mt-1 text-xs text-text-muted">{description}</p>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
