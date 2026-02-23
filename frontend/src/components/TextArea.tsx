import { TextareaHTMLAttributes, forwardRef } from "react";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, id, className = "", ...props }, ref) => {
    return (
      <div>
        {label && (
          <label
            htmlFor={id}
            className="mb-0.5 block text-[0.8rem] text-text-secondary"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={`w-full rounded border bg-bg-primary px-2.5 py-1.5 font-mono text-[0.85rem] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none ${error ? "border-danger" : "border-border-hover"} ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-[0.8rem] text-danger">{error}</p>
        )}
      </div>
    );
  },
);

TextArea.displayName = "TextArea";
