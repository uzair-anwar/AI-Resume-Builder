"use client";

import { useEffect, useMemo, useState } from "react";
import type { TailorStepId } from "@/lib/schemas/tailoring-steps";

export type TailorStage = "idle" | "fetching" | "working" | "done";

export type TailorProgressStepId =
  | "fetch"
  | TailorStepId
  | "assemble"
  | "preview";

type Props = {
  stage: TailorStage;
  viaUrl: boolean;
  /** Step currently running, or null when between steps */
  activeStep: TailorProgressStepId | null;
  /** Steps finished in this run */
  completedSteps: TailorProgressStepId[];
};

const STEP_DEFS: { id: TailorProgressStepId; label: string; skipWithoutUrl?: boolean }[] = [
  { id: "fetch", label: "Fetch job", skipWithoutUrl: true },
  { id: "summary", label: "Summary" },
  { id: "experience", label: "Work experience" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "headline", label: "Headline" },
  { id: "assemble", label: "Finalize layout" },
  { id: "preview", label: "Preview ready" },
];

function useCreep(active: boolean, start: number, ceiling: number): number {
  const [value, setValue] = useState(start);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setValue((v) => v + (ceiling - v) * 0.06);
    }, 300);
    return () => clearInterval(timer);
  }, [active, ceiling]);
  return value;
}

export function TailorProgress({ stage, viaUrl, activeStep, completedSteps }: Props) {
  const visibleSteps = STEP_DEFS.filter((s) => viaUrl || !s.skipWithoutUrl);
  const completedSet = useMemo(() => new Set(completedSteps), [completedSteps]);

  const doneCount = completedSteps.length;
  const total = visibleSteps.length;
  const basePercent = stage === "done" ? 100 : (doneCount / total) * 100;
  const creeping = useCreep(stage === "working" && activeStep !== null, basePercent, basePercent + 12);
  const percent = stage === "done" ? 100 : stage === "fetching" ? creeping : creeping;

  if (stage === "idle") return null;

  const message =
    stage === "fetching"
      ? "Fetching the job description…"
      : stage === "done"
        ? "Resume tailored to this job."
        : activeStep
          ? `AI step: ${STEP_DEFS.find((s) => s.id === activeStep)?.label ?? activeStep}…`
          : "Tailoring your resume…";

  const stepState = (id: TailorProgressStepId): "done" | "active" | "todo" => {
    if (stage === "done") return "done";
    if (completedSet.has(id)) return "done";
    if (activeStep === id) return "active";
    return "todo";
  };

  const working = stage === "working" || stage === "fetching";

  return (
    <div
      className="glass-panel w-full rounded-2xl p-5"
      role="status"
      aria-live="polite"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {working ? (
            <span
              className="relative flex h-2.5 w-2.5"
              aria-hidden
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
            </span>
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-xs text-emerald-600 dark:text-emerald-400">
              ✓
            </span>
          )}
          <span className="text-sm font-medium">{message}</span>
        </div>
        <span className="tabular-nums text-sm font-semibold text-indigo-600 dark:text-indigo-300">
          {Math.round(percent)}%
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${
            stage === "done" ? "bg-emerald-500" : "progress-shimmer"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {visibleSteps.map((s) => {
          const state = stepState(s.id);
          return (
            <li
              key={s.id}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                state === "done"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : state === "active"
                    ? "bg-indigo-500/10 font-medium text-indigo-700 dark:text-indigo-200"
                    : "text-zinc-500 dark:text-zinc-500"
              }`}
            >
              <span
                className={
                  state === "active" ? "step-active-dot text-indigo-500" : "text-[10px]"
                }
                aria-hidden
              >
                {state === "done" ? "✓" : state === "active" ? "●" : "○"}
              </span>
              {s.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
