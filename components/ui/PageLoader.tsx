"use client";

type Props = {
  label?: string;
};

/** Initial workspace / dynamic import loader. */
export function PageLoader({ label = "Preparing your workspace" }: Props) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-6">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div
          className="ai-loader-ring absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 border-r-cyan-400"
          aria-hidden
        />
        <div
          className="ai-loader-ring absolute inset-2 rounded-full border-2 border-transparent border-b-violet-400 border-l-indigo-300 opacity-70"
          style={{ animationDirection: "reverse", animationDuration: "1.6s" }}
          aria-hidden
        />
        <div
          className="ai-loader-core h-3 w-3 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-[0_0_20px_var(--accent-glow)]"
          aria-hidden
        />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{label}</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Loading fonts & profile data…</p>
      </div>
    </div>
  );
}
