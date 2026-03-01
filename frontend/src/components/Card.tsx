import type { CSSProperties, ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Card({ children, className = "", style }: Props) {
  return (
    <section
      className={`rounded-lg border border-border bg-bg-secondary p-6 ${className}`}
      style={style}
    >
      {children}
    </section>
  );
}

export function CardTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`text-lg font-semibold leading-snug text-text-heading ${className}`}
    >
      {children}
    </h2>
  );
}

export function CardContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-sm leading-relaxed text-text-secondary ${className}`}>
      {children}
    </p>
  );
}

export function Panel({ children, className = "" }: Props) {
  return (
    <div
      className={`rounded-lg border-l-2 border-border bg-bg-primary p-5 ${className}`}
    >
      {children}
    </div>
  );
}
