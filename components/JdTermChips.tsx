import type { JobAnalysis } from "@/lib/schemas/tailoring";

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 75
      ? "bg-emerald-500"
      : score >= 50
        ? "bg-amber-500"
        : "bg-rose-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
        <span className="font-medium">{score}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className={`h-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export function JdTermChips({ analysis }: { analysis: JobAnalysis }) {
  const { coverage, focusLabel, terms, atsScorecard } = analysis;
  const covered = coverage.matched + coverage.related;
  const score = atsScorecard?.tailoredScore;
  const baseScore = atsScorecard?.baselineScore;
  const delta =
    score !== undefined && baseScore !== undefined ? Math.max(0, score - baseScore) : 0;

  return (
    <div className="glass-panel space-y-3 rounded-2xl p-5 sm:p-6">
      <p className="section-label">ATS insights</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Focus:</span>
          <span className="text-zinc-700 dark:text-zinc-300">{focusLabel}</span>
          <span className="text-xs text-zinc-500">
            ({covered} of {coverage.total} JD terms matched or bridged)
          </span>
        </div>

        {score !== undefined ? (
          <div className="flex items-center gap-2.5">
            {baseScore !== undefined && delta > 0 ? (
              <span className="text-xs text-zinc-500">
                Baseline {baseScore}% →{" "}
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  +{delta}% boost
                </span>
              </span>
            ) : null}
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                score >= 75
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                  : score >= 55
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                    : "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200"
              }`}
            >
              ATS Match Rate: {score}%
            </span>
          </div>
        ) : null}
      </div>

      {atsScorecard ? (
        <div className="grid gap-3 pt-1 sm:grid-cols-2 lg:grid-cols-4">
          <ScoreBar
            label="Keywords in Bullets & Summary"
            score={atsScorecard.keywordsInContextScore}
          />
          <ScoreBar label="Skill & Concept Coverage" score={atsScorecard.skillCoverageScore} />
          <ScoreBar label="Title & Role Alignment" score={atsScorecard.titleAlignmentScore} />
          <ScoreBar label="One-Page Structure & Metrics" score={atsScorecard.structuralScore} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5 pt-1">
        {terms.slice(0, 28).map((t) => {
          const isWoven = atsScorecard?.wovenTerms.includes(t.term);
          return (
            <span
              key={t.term}
              title={
                isWoven
                  ? `Newly woven into tailored resume${t.relatedVia ? ` (via ${t.relatedVia})` : ""}`
                  : t.relatedVia
                    ? `Bridged via ${t.relatedVia}`
                    : t.status === "missing"
                      ? "Not on profile — add to Profile if you have this skill"
                      : "Matched on profile"
              }
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                t.status === "matched" || t.inTailoredResume
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                  : t.status === "related"
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                    : "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200"
              }`}
            >
              {t.term}
              {t.relatedVia ? ` (${t.relatedVia})` : ""}
              {isWoven ? " ★" : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}
