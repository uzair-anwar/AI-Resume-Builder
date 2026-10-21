import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { TailorResponse } from "@/lib/schemas/tailoring";
import { TAILOR_STEP_IDS } from "@/lib/schemas/tailoring-steps";
import type { TailorStepPrevious } from "@/lib/schemas/tailoring-steps";
import { analyzeJob } from "../analyze-job";
import { assembleResumeView, buildChanges } from "../assemble-resume";
import { attachAtsScorecard } from "../ats-score";
import { deterministicTailor } from "../deterministic-tailor";
import { normalizeTypography as nt } from "@/lib/text-normalize";
import { repairTailoring } from "../validate-tailoring";
import { mergePrevious, runTailorStep, stagedToTailoringResult } from "./run-step";
import type { TailorAiOptions } from "./run-ai-structured";

export async function runStagedTailorPipeline(
  resume: MasterResume,
  jobText: string,
  ai: TailorAiOptions = {},
): Promise<TailorResponse> {
  const analysis = analyzeJob(jobText, resume);
  let state: TailorStepPrevious = {};
  const warnings: string[] = [];
  let lastAiUsage: TailorResponse["aiUsage"];

  for (const step of TAILOR_STEP_IDS) {
    const result = await runTailorStep(step, resume, jobText, ai, state);
    state = mergePrevious(state, result.partial);
    warnings.push(...result.warnings);
    if (result.aiUsage) lastAiUsage = result.aiUsage;
  }

  const raw = stagedToTailoringResult(state, resume);
  const cleaned: typeof raw = {
    ...raw,
    headline: nt(raw.headline),
    summary: nt(raw.summary),
    experience: raw.experience.map((e) => ({
      ...e,
      bullets: e.bullets.map((b) => ({ ...b, text: nt(b.text) })),
    })),
    projects: raw.projects.map((p) => ({ ...p, description: nt(p.description) })),
  };
  const { data, report } = repairTailoring(cleaned, resume, analysis);

  const resumeView = assembleResumeView(resume, data);
  const scoredAnalysis = attachAtsScorecard(analysis, resume, resumeView);
  return {
    resume: resumeView,
    analysis: scoredAnalysis,
    changes: buildChanges(resume, data),
    warnings: [
      ...warnings,
      ...(report.count
        ? [
            `Layout guardrails adjusted ${report.count} item(s) to fit the one-page template.`,
          ]
        : []),
    ],
    usedFallback: false,
    aiUsage: lastAiUsage,
  };
}

export async function tailorResumeStagedOrFallback(
  resume: MasterResume,
  jobText: string,
  ai: TailorAiOptions,
): Promise<TailorResponse> {
  try {
    return await runStagedTailorPipeline(resume, jobText, ai);
  } catch (e) {
    const analysis = analyzeJob(jobText, resume);
    const fb = deterministicTailor(resume, jobText, analysis);
    fb.warnings.push(e instanceof Error ? e.message : "Staged tailoring failed");
    return fb;
  }
}
