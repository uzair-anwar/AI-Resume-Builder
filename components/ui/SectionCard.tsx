import type { ReactNode } from "react";

type Props = {
  title?: string;
  subtitle?: string;
  /** Renders on the right of the title row (e.g. primary action). */
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function SectionCard({
  title,
  subtitle,
  headerAction,
  children,
  className = "",
  id,
}: Props) {
  return (
    <section
      id={id}
      className={`glass-panel rounded-2xl p-5 sm:p-6 ${className}`}
    >
      {title ? (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="section-label">{title}</p>
            {subtitle ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
            ) : null}
          </div>
          {headerAction ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {headerAction}
            </div>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
