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
          ? `Working on ${STEP_DEFS.find((s) => s.id === activeStep)?.label ?? activeStep}…`
          : "Tailoring your resume…";

  const stepState = (id: TailorProgressStepId): "done" | "active" | "todo" => {
    if (stage === "done") return "done";
    if (completedSet.has(id)) return "done";
    if (activeStep === id) return "active";
    return "todo";
  };

  return (
    <div
      className="w-full rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
      role="status"
      aria-live="polite"
    >
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">{message}</span>
        <span className="tabular-nums text-zinc-500">{Math.round(percent)}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${
            stage === "done" ? "bg-emerald-500" : "bg-blue-600"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {visibleSteps.map((s) => {
          const state = stepState(s.id);
          return (
            <li
              key={s.id}
              className={
                state === "done"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : state === "active"
                    ? "font-medium text-blue-600 dark:text-blue-400"
                    : "text-zinc-400"
              }
            >
              {state === "done" ? "✓" : state === "active" ? "●" : "○"} {s.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
