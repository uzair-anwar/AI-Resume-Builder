import type { JobAnalysis } from "@/lib/schemas/tailoring";

export function JdTermChips({ analysis }: { analysis: JobAnalysis }) {
  const { coverage, focusLabel, terms } = analysis;
  const covered = coverage.matched + coverage.related;

  return (
    <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Focus:</span>
        <span className="text-zinc-600 dark:text-zinc-400">{focusLabel}</span>
        <span className="text-xs text-zinc-500">
          {covered} of {coverage.total} terms matched or related
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {terms.slice(0, 24).map((t) => (
          <span
            key={t.term}
            title={t.relatedVia ? `Related via ${t.relatedVia}` : undefined}
            className={`rounded-full px-2 py-0.5 text-xs ${
              t.status === "matched"
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                : t.status === "related"
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                  : "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200"
            }`}
          >
            {t.term}
            {t.relatedVia ? ` (${t.relatedVia})` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
