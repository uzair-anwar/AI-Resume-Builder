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
    <div className="space-y-4 text-sm">
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

      {resume.experience.map((exp, ei) => (
        <div key={exp.id} className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
          <p className="font-semibold">
            {exp.title} — {exp.company}
          </p>
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
        </div>
      ))}
    </div>
  );
}
