"use client";

import { useEffect, useState } from "react";

export type TailorStage = "idle" | "fetching" | "tailoring" | "done";

type Props = {
  stage: TailorStage;
  /** true when the description came from a job URL (shows the fetch step) */
  viaUrl: boolean;
};

const STEPS = [
  { id: "fetch", label: "Fetch job" },
  { id: "tailor", label: "Tailor resume" },
  { id: "done", label: "Preview ready" },
] as const;

/** Slowly creeps towards `ceiling` while a step is running, so the bar never looks frozen. */
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

export function TailorProgress({ stage, viaUrl }: Props) {
  const fetching = stage === "fetching";
  const tailoring = stage === "tailoring";
  const creepFetch = useCreep(fetching, 8, 32);
  const creepTailor = useCreep(tailoring, 40, 92);

  if (stage === "idle") return null;

  const percent = stage === "done" ? 100 : tailoring ? creepTailor : creepFetch;

  const stepState = (id: (typeof STEPS)[number]["id"]): "done" | "active" | "todo" => {
    if (stage === "done") return "done";
    if (id === "fetch") {
      if (!viaUrl) return "done";
      return fetching ? "active" : "done";
    }
    if (id === "tailor") return tailoring ? "active" : "todo";
    return "todo";
  };

  const message =
    stage === "fetching"
      ? "Fetching the job description…"
      : stage === "tailoring"
        ? viaUrl
          ? "Job fetched — tailoring your resume…"
          : "Tailoring your resume…"
        : "Resume tailored to this job.";

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
      <ol className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
        {STEPS.filter((s) => viaUrl || s.id !== "fetch").map((s) => {
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
