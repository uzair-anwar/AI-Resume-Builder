import type { JobAnalysis } from "@/lib/schemas/tailoring";

export function RequirementsPanel({ analysis }: { analysis: JobAnalysis }) {
  const { coverage, gapAnalysis, roleFamilyLabel } = analysis;
  const covered = coverage.matched + coverage.transferable;

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium dark:bg-zinc-800">
          {roleFamilyLabel}
        </span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {covered} of {coverage.total} requirements matched or transferable
        </span>
      </div>
      <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
        {gapAnalysis.slice(0, 25).map((g, i) => (
          <li key={i} className="flex gap-2">
            <StatusDot status={g.status} />
            <span>
              {g.requirement}
              {g.status === "transferable" && g.transferableVia ? (
                <span className="text-zinc-500"> — via {g.transferableVia}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "matched"
      ? "bg-emerald-500"
      : status === "transferable"
        ? "bg-amber-400"
        : "bg-rose-400";
  return <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />;
}
