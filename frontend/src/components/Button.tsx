import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "destructive" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
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
};

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
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`cursor-pointer rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
