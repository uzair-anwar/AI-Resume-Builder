import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { TailorResponse } from "@/lib/schemas/tailoring";
import { TAILOR_STEP_IDS } from "@/lib/schemas/tailoring-steps";
import type { TailorStepPrevious } from "@/lib/schemas/tailoring-steps";
import { RESUME_MAX_PROJECTS } from "@/lib/layout/constants";
import { selectedProjectLabel } from "../project-select";
import { prepareTailoringWorkspace } from "../tailoring-workspace";
import { assembleResumeView, buildChanges } from "../assemble-resume";
import { attachAtsScorecard } from "../ats-score";
import { deterministicTailor } from "../deterministic-tailor";
import { normalizeTypography as nt } from "@/lib/text-normalize";
import { applyPhraseCoverage } from "../phrase-coverage";
import { fitResumeViewToOnePage } from "@/lib/layout/fit-one-page";
import { finalizeResumeHeadline } from "../headline-align";
import { detectRoleFamily } from "../role-families";
import { polishTailoringResult } from "../polish-resume-copy";
import { repairTailoring } from "../validate-tailoring";
import { mergePrevious, runTailorStep, stagedToTailoringResult } from "./run-step";
import type { TailorAiOptions } from "./run-ai-structured";

export async function runStagedTailorPipeline(
  resume: MasterResume,
  jobText: string,
  ai: TailorAiOptions = {},
): Promise<TailorResponse> {
  const { master: workingResume, tailoring, analysis } = prepareTailoringWorkspace(resume, jobText);
  let state: TailorStepPrevious = {};
  const warnings: string[] = [];
  if (
    resume.projects.length > RESUME_MAX_PROJECTS &&
    analysis.selectedProjectIds?.length
  ) {
    warnings.push(
      `Projects on this resume (JD fit): ${selectedProjectLabel(workingResume, analysis.selectedProjectIds)}.`,
    );
  }
  let lastAiUsage: TailorResponse["aiUsage"];

  for (const step of TAILOR_STEP_IDS) {
    const result = await runTailorStep(step, tailoring, jobText, ai, state, analysis);
    state = mergePrevious(state, result.partial);
    warnings.push(...result.warnings);
    if (result.aiUsage) lastAiUsage = result.aiUsage;
  }

  const raw = stagedToTailoringResult(state, tailoring);
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
  const family = detectRoleFamily(jobText);
  const repaired = repairTailoring(cleaned, tailoring, analysis);
  const data = polishTailoringResult(
    applyPhraseCoverage(
      {
        ...repaired.data,
        headline: finalizeResumeHeadline(
          repaired.data.headline,
          analysis,
          workingResume,
          family,
        ),
      },
      workingResume,
      analysis,
    ),
    workingResume,
  );
  const report = repaired.report;

  let resumeView = assembleResumeView(tailoring, data);
  resumeView = fitResumeViewToOnePage(resumeView, analysis);
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
    const fb = deterministicTailor(resume, jobText);
    fb.warnings.push(e instanceof Error ? e.message : "Staged tailoring failed");
    return fb;
  }
}
