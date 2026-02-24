import { useTranslation } from "react-i18next";

interface LoadingProps {
  className?: string;
}

export function Loading({ className = "" }: LoadingProps) {
  const { t } = useTranslation();

  return (
    <div className={`flex items-center gap-2 p-2 ${className}`}>
      <Spinner />
      <span className="text-base text-text-secondary">
        {t("common.loading")}
      </span>
    </div>
  );
}

interface SpinnerProps {
  size?: "sm" | "md";
  className?: string;
}

const sizeClasses = {
  sm: "h-3 w-3 border",
  md: "h-4 w-4 border-2",
};

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-accent border-t-transparent ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="loading"
    />
  );
}
