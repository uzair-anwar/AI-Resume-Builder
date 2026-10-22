import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { TailorResponse } from "@/lib/schemas/tailoring";
import { TAILOR_STEP_IDS } from "@/lib/schemas/tailoring-steps";
import type { TailorStepPrevious } from "@/lib/schemas/tailoring-steps";
import { mergeResumeWithExpansionSkills } from "../ats-expansion";
import { analyzeJob } from "../analyze-job";
import { assembleResumeView, buildChanges } from "../assemble-resume";
import { attachAtsScorecard } from "../ats-score";
import { deterministicTailor } from "../deterministic-tailor";
import { normalizeTypography as nt } from "@/lib/text-normalize";
import { applyPhraseCoverage } from "../phrase-coverage";
import { repairTailoring } from "../validate-tailoring";
import { mergePrevious, runTailorStep, stagedToTailoringResult } from "./run-step";
import type { TailorAiOptions } from "./run-ai-structured";

export async function runStagedTailorPipeline(
  resume: MasterResume,
  jobText: string,
  ai: TailorAiOptions = {},
): Promise<TailorResponse> {
  const analysis = analyzeJob(jobText, resume);
  const workingResume = mergeResumeWithExpansionSkills(resume, analysis);
  let state: TailorStepPrevious = {};
  const warnings: string[] = [];
  let lastAiUsage: TailorResponse["aiUsage"];

  for (const step of TAILOR_STEP_IDS) {
    const result = await runTailorStep(step, workingResume, jobText, ai, state);
    state = mergePrevious(state, result.partial);
    warnings.push(...result.warnings);
    if (result.aiUsage) lastAiUsage = result.aiUsage;
  }

  const raw = stagedToTailoringResult(state, workingResume);
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
  const repaired = repairTailoring(cleaned, workingResume, analysis);
  const data = applyPhraseCoverage(repaired.data, workingResume, analysis);
  const report = repaired.report;

  const resumeView = assembleResumeView(workingResume, data);
  const scoredAnalysis = attachAtsScorecard(analysis, workingResume, resumeView);
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
