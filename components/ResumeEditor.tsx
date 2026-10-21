"use client";

import type { ResumeView } from "@/lib/schemas/resume";
import type { LineBudgets } from "@/lib/layout/budgets";
import { countBulletLines, countWrappedLines } from "@/lib/layout/measure";
import { COLUMN_WIDTH, SIZE_BODY } from "@/lib/layout/constants";

type Props = {
  resume: ResumeView;
  onChange: (next: ResumeView) => void;
  budgets?: LineBudgets;
};

function lineLabel(current: number, max: number) {
  const over = current > max;
  return (
    <span className={over ? "text-rose-600 text-xs" : "text-zinc-500 text-xs"}>
      {current}/{max} lines
    </span>
  );
}

export function ResumeEditor({ resume, onChange, budgets }: Props) {
  const summaryMax = budgets?.summaryMaxLines ?? 9;

  return (
    <div className="w-full space-y-4 text-sm">
      <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <label className="block">
          <span className="flex justify-between font-medium">Headline {lineLabel(1, 1)}</span>
          <input
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
            value={resume.headline}
            onChange={(e) => onChange({ ...resume, headline: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="flex justify-between font-medium">
            Summary{" "}
            {lineLabel(countWrappedLines(resume.summary, COLUMN_WIDTH, SIZE_BODY), summaryMax)}
          </span>
          <textarea
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
            rows={5}
            value={resume.summary}
            onChange={(e) => onChange({ ...resume, summary: e.target.value })}
          />
        </label>
      </div>

      <div className="grid w-full items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {resume.experience.map((exp, ei) => (
          <details
            key={exp.id}
            className="group rounded border border-zinc-200 p-3 dark:border-zinc-700"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
              <span>
                {exp.title} — {exp.company}
              </span>
              <span className="flex items-center gap-2 text-xs font-normal text-zinc-500">
                {exp.bullets.length} bullets
                <span className="transition-transform group-open:rotate-180" aria-hidden>
                  ▾
                </span>
              </span>
            </summary>
            {exp.bullets.map((b, bi) => {
              const fid = b.sourceFactIds[0];
              const max = fid ? (budgets?.bullets[fid] ?? 2) : 2;
              return (
                <div key={bi} className="mt-2">
                  <div className="mb-1 flex justify-between">
                    <span className="text-xs text-zinc-500">Bullet</span>
                    {lineLabel(countBulletLines(b.text), max)}
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      className="min-h-[48px] flex-1 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                      value={b.text}
                      onChange={(e) => {
                        const experience = resume.experience.map((x, i) =>
                          i !== ei
                            ? x
                            : {
                                ...x,
                                bullets: x.bullets.map((bb, j) =>
                                  j === bi ? { ...bb, text: e.target.value } : bb,
                                ),
                              },
                        );
                        onChange({ ...resume, experience });
                      }}
                    />
                    <button
                      type="button"
                      className="text-xs text-rose-600"
                      onClick={() => {
                        const experience = resume.experience.map((x, i) =>
                          i !== ei ? x : { ...x, bullets: x.bullets.filter((_, j) => j !== bi) },
                        );
                        onChange({ ...resume, experience });
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </details>
        ))}
      </div>
    </div>
  );
}
