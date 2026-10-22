import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { TailorResponse } from "@/lib/schemas/tailoring";
import { TAILOR_STEP_IDS } from "@/lib/schemas/tailoring-steps";
import type { TailorStepPrevious } from "@/lib/schemas/tailoring-steps";
import { RESUME_MAX_PROJECTS } from "@/lib/resume/layout/constants";
import { limitTailoringProjects, selectedProjectLabel } from "@/lib/server/tailor/project-select";
import { prepareTailoringWorkspace } from "@/lib/server/tailor/tailoring-workspace";
import { assembleResumeView, buildChanges } from "@/lib/server/resume/assemble-resume";
import { attachAtsScorecard } from "@/lib/server/ats/ats-score";
import { deterministicTailor } from "@/lib/server/tailor/deterministic-tailor";
import { normalizeTypography as nt } from "@/lib/shared/text-normalize";
import { applyPhraseCoverage } from "@/lib/server/ats/phrase-coverage";
import { fitResumeViewToOnePage } from "@/lib/resume/layout/fit-one-page";
import { finalizeResumeHeadline } from "@/lib/server/ats/headline-align";
import { detectRoleFamily } from "@/lib/server/ats/role-families";
import { polishTailoringResult } from "@/lib/server/resume/polish-resume-copy";
import { repairTailoring } from "@/lib/server/resume/validate-tailoring";
import { mergePrevious, runTailorStep, stagedToTailoringResult } from "@/lib/server/tailor/tailor-steps/run-step";
import type { TailorAiOptions } from "@/lib/server/tailor/tailor-steps/run-ai-structured";

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
  const repaired = repairTailoring(
    limitTailoringProjects(cleaned, tailoring, analysis),
    tailoring,
    analysis,
  );
  const data = polishTailoringResult(
    applyPhraseCoverage(
      {
        ...repaired.data,
        headline: finalizeResumeHeadline(
          repaired.data.headline,
          analysis,
          workingResume,
          family,
          jobText,
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
