import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant =
  | "primary"
  | "secondary"
  | "destructive"
  | "ghost"
  | "filter"
  | "tab";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  active?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-white font-semibold border-none hover:bg-accent-hover",
  secondary:
    "bg-btn-secondary text-text-primary border-none hover:bg-btn-secondary-hover",
  destructive:
    "bg-transparent text-danger border border-danger font-semibold hover:bg-danger hover:text-white",
  ghost:
    "bg-transparent text-text-primary border border-transparent hover:bg-bg-hover hover:border-border-hover",
  filter:
    "bg-bg-hover text-text-secondary font-medium border-none hover:text-text-primary",
  tab: "rounded-none rounded-t border-b-2 border-b-transparent bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary",
};

const filterActiveClasses =
  "bg-accent text-white font-bold shadow-sm ring-1 ring-accent";

const tabActiveClasses =
  "rounded-none rounded-t border-b-2 border-b-accent bg-accent/10 font-bold text-accent";

const sizeClasses: Record<Size, string> = {
  sm: "px-2 py-1 text-sm",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      active = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const variantClass =
      variant === "filter" && active
        ? filterActiveClasses
        : variant === "tab" && active
          ? tabActiveClasses
          : variantClasses[variant];

    const roundedClass = variant === "tab" ? "" : "rounded";

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`cursor-pointer ${roundedClass} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${variantClass} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center gap-1.5">
            <svg
              className="animate-spin"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {children}
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
