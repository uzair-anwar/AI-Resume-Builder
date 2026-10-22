import type { ReactNode } from "react";

type Props = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function SectionCard({ title, subtitle, children, className = "", id }: Props) {
  return (
    <section
      id={id}
      className={`glass-panel rounded-2xl p-5 sm:p-6 ${className}`}
    >
      {title ? (
        <header className="mb-4">
          <p className="section-label">{title}</p>
          {subtitle ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
