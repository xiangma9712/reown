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

export function Panel({ children, className = "" }: Props) {
  return (
    <div
      className={`rounded-lg border border-border bg-bg-primary p-5 ${className}`}
    >
      {children}
    </div>
  );
}
