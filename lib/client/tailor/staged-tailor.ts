import type { JobAnalysis } from "@/lib/schemas/tailoring";
import type {
  TailorStepId,
  TailorStepPrevious,
  TailorStepResponse,
} from "@/lib/schemas/tailoring-steps";
import type { AiProviderChoice, AiProviderId } from "@/lib/ai/provider-types";

export const TAILOR_STEP_ORDER: TailorStepId[] = [
  "summary",
  "experience",
  "skills",
  "projects",
  "headline",
];

export type StagedTailorOptions = {
  jobDescription: string;
  provider: AiProviderChoice;
  allowProviderFallback: boolean;
  providerModels: Partial<Record<AiProviderId, string>>;
  profileOverride?: Record<string, unknown>;
  onStepStart?: (step: TailorStepId) => void;
  onStepComplete?: (
    step: TailorStepId,
    response: TailorStepResponse,
    accumulated: TailorStepPrevious,
  ) => void;
};

export type StagedTailorResult = {
  previous: TailorStepPrevious;
  analysis: JobAnalysis;
  warnings: string[];
  lastAiUsage?: TailorStepResponse["aiUsage"];
};

export function mergeStepPartial(
  prev: TailorStepPrevious,
  partial: TailorStepPrevious,
): TailorStepPrevious {
  return {
    ...prev,
    ...partial,
    experience: partial.experience ?? prev.experience,
    projects: partial.projects ?? prev.projects,
  };
}

export async function runStagedTailorClient(
  opts: StagedTailorOptions,
): Promise<StagedTailorResult> {
  let previous: TailorStepPrevious = {};
  let analysis: JobAnalysis | null = null;
  const warnings: string[] = [];
  let lastAiUsage: TailorStepResponse["aiUsage"];

  for (const step of TAILOR_STEP_ORDER) {
    opts.onStepStart?.(step);
    const res = await fetch("/api/tailor/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step,
        jobDescription: opts.jobDescription,
        provider: opts.provider,
        allowProviderFallback: opts.allowProviderFallback,
        providerModels: opts.providerModels,
        previous,
        ...(opts.profileOverride ? { profileOverride: opts.profileOverride } : {}),
      }),
    });
    const data = (await res.json()) as TailorStepResponse & {
      error?: string;
      analysis?: JobAnalysis;
    };
    if (!res.ok) throw new Error(data.error ?? `Step ${step} failed`);
    if (data.analysis) analysis = data.analysis;
    previous = mergeStepPartial(previous, data.partial);
    warnings.push(...(data.warnings ?? []));
    if (data.aiUsage) lastAiUsage = data.aiUsage;
    opts.onStepComplete?.(step, data, previous);
  }

  if (!analysis) throw new Error("Missing job analysis");
  return { previous, analysis, warnings, lastAiUsage };
}
