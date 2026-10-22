"use client";

import type { ResumeView } from "@/lib/schemas/resume";
import type { LineBudgets } from "@/lib/resume/layout/budgets";
import { countBulletLines, countWrappedLines } from "@/lib/resume/layout/measure";
import { COLUMN_WIDTH, RESUME_MAX_PROJECTS, SIZE_BODY } from "@/lib/resume/layout/constants";
import { plainFromRich } from "@/lib/shared/rich-text";
import { RichTextField } from "@/components/resume/RichTextField";

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
  const projectsOnResume = resume.projects.slice(0, RESUME_MAX_PROJECTS);

  return (
    <div className="w-full space-y-6 text-sm">
      <p className="text-xs text-zinc-500">
        Changes update the PDF preview above. Layout spacing is unchanged; only copy and light
        formatting apply.
      </p>

      <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <RichTextField
          label={
            <span className="flex w-full justify-between gap-2">
              Headline {lineLabel(1, 1)}
            </span>
          }
          value={resume.headline}
          onChange={(headline) => onChange({ ...resume, headline })}
          rows={2}
        />
        <RichTextField
          label={
            <span className="flex w-full justify-between gap-2">
              Summary{" "}
              {lineLabel(
                countWrappedLines(plainFromRich(resume.summary), COLUMN_WIDTH, SIZE_BODY),
                summaryMax,
              )}
            </span>
          }
          value={resume.summary}
          onChange={(summary) => onChange({ ...resume, summary })}
          rows={5}
        />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Professional experience
        </h3>
        <div className="grid w-full items-start gap-3 lg:grid-cols-2">
          {resume.experience.map((exp, ei) => (
            <details
              key={exp.id}
              className="group rounded-xl border border-zinc-200/80 bg-white/40 p-3 dark:border-zinc-700/80 dark:bg-zinc-900/30"
              open
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="truncate">
                  {exp.title} — {exp.company}
                </span>
                <span className="shrink-0 text-xs font-normal text-zinc-500">
                  {exp.bullets.length} bullets ▾
                </span>
              </summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="block text-xs">
                  <span className="text-zinc-500">Role title</span>
                  <input
                    className="input-field mt-0.5"
                    value={exp.title}
                    onChange={(e) => {
                      const experience = resume.experience.map((x, i) =>
                        i === ei ? { ...x, title: e.target.value } : x,
                      );
                      onChange({ ...resume, experience });
                    }}
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-zinc-500">Company</span>
                  <input
                    className="input-field mt-0.5"
                    value={exp.company}
                    onChange={(e) => {
                      const experience = resume.experience.map((x, i) =>
                        i === ei ? { ...x, company: e.target.value } : x,
                      );
                      onChange({ ...resume, experience });
                    }}
                  />
                </label>
              </div>
              {exp.bullets.map((b, bi) => {
                const fid = b.sourceFactIds[0];
                const max = fid ? (budgets?.bullets[fid] ?? 2) : 2;
                return (
                  <div key={bi} className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <RichTextField
                      label={
                        <span className="flex w-full justify-between gap-2">
                          Bullet {bi + 1}{" "}
                          {lineLabel(countBulletLines(plainFromRich(b.text)), max)}
                        </span>
                      }
                      value={b.text}
                      onChange={(text) => {
                        const experience = resume.experience.map((x, i) =>
                          i !== ei
                            ? x
                            : {
                                ...x,
                                bullets: x.bullets.map((bb, j) =>
                                  j === bi ? { ...bb, text } : bb,
                                ),
                              },
                        );
                        onChange({ ...resume, experience });
                      }}
                      rows={3}
                    />
                    <button
                      type="button"
                      className="mt-1 text-xs text-rose-600 hover:underline"
                      onClick={() => {
                        const experience = resume.experience.map((x, i) =>
                          i !== ei ? x : { ...x, bullets: x.bullets.filter((_, j) => j !== bi) },
                        );
                        onChange({ ...resume, experience });
                      }}
                    >
                      Remove bullet
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                className="mt-2 text-xs text-indigo-600 hover:underline"
                onClick={() => {
                  const experience = resume.experience.map((x, i) =>
                    i !== ei
                      ? x
                      : {
                          ...x,
                          bullets: [...x.bullets, { text: "", sourceFactIds: [] }],
                        },
                  );
                  onChange({ ...resume, experience });
                }}
              >
                Add bullet
              </button>
            </details>
          ))}
        </div>
      </div>

      {projectsOnResume.length > 0 ? (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Projects
          </h3>
          <p className="mb-2 text-xs text-zinc-500">
            Up to {RESUME_MAX_PROJECTS} projects on this resume (chosen for the job when you
            tailored). Edit copy only — not which projects appear.
          </p>
          <div className="space-y-3">
            {projectsOnResume.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-700/80"
              >
                <label className="mb-2 block text-xs">
                  <span className="text-zinc-500">Project name</span>
                  <input
                    className="input-field mt-0.5"
                    value={p.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      onChange({
                        ...resume,
                        projects: resume.projects.map((x) =>
                          x.id === p.id ? { ...x, name } : x,
                        ),
                      });
                    }}
                  />
                </label>
                <RichTextField
                  label="Description"
                  value={p.description}
                  onChange={(description) => {
                    onChange({
                      ...resume,
                      projects: resume.projects.map((x) =>
                        x.id === p.id ? { ...x, description } : x,
                      ),
                    });
                  }}
                  rows={4}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Education
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {resume.education.map((ed, ei) => (
            <div
              key={ed.id}
              className="rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-700/80"
            >
              <label className="mb-2 block text-xs">
                <span className="text-zinc-500">Degree</span>
                <input
                  className="input-field mt-0.5"
                  value={ed.degree}
                  onChange={(e) => {
                    const education = resume.education.map((x, i) =>
                      i === ei ? { ...x, degree: e.target.value } : x,
                    );
                    onChange({ ...resume, education });
                  }}
                />
              </label>
              <label className="block text-xs">
                <span className="text-zinc-500">Institution</span>
                <input
                  className="input-field mt-0.5"
                  value={ed.institution}
                  onChange={(e) => {
                    const education = resume.education.map((x, i) =>
                      i === ei ? { ...x, institution: e.target.value } : x,
                    );
                    onChange({ ...resume, education });
                  }}
                />
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
