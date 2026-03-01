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
  as: Tag = "h2",
}: {
  children: ReactNode;
  className?: string;
  as?: "h2" | "h3" | "h4";
}) {
  return (
    <Tag
      className={`text-lg font-semibold leading-snug text-text-heading ${className}`}
    >
      {children}
    </Tag>
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
