import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Full-page ambient background + content wrapper. */
export function AppShell({ children, className = "" }: Props) {
  return (
    <div className={`relative min-h-screen overflow-x-hidden ${className}`}>
      <div className="app-mesh pointer-events-none fixed inset-0 -z-20" aria-hidden />
      <div className="app-grid pointer-events-none fixed inset-0 -z-10 opacity-80" aria-hidden />
      <div className="relative z-0">{children}</div>
    </div>
  );
}
