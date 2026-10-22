import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { applyTailorLineBudgetCaps, computeLineBudgets } from "@/lib/layout/budgets";
import { mergeResumeWithExpansionSkills } from "./ats-expansion";
import { analyzeJob } from "./analyze-job";
import { narrowResumeProjects, selectProjectIdsForJob } from "./project-select";

export type TailoringWorkspace = {
  /** Full profile (all projects) — ATS baseline, vocabulary, term matching. */
  master: MasterResume;
  /** Job-specific slice (top N projects) — AI steps, assembly, repair. */
  tailoring: MasterResume;
  analysis: JobAnalysis;
};

export function prepareTailoringWorkspace(
  resume: MasterResume,
  jobText: string,
): TailoringWorkspace {
  const baseAnalysis = analyzeJob(jobText, resume);
  const master = mergeResumeWithExpansionSkills(resume, baseAnalysis);
  const selectedProjectIds = selectProjectIdsForJob(master, jobText, baseAnalysis);
  const tailoring = narrowResumeProjects(master, selectedProjectIds);
  const lineBudgets = applyTailorLineBudgetCaps(computeLineBudgets(tailoring), tailoring);
  const analysis: JobAnalysis = {
    ...baseAnalysis,
    selectedProjectIds,
    lineBudgets,
  };
  return { master, tailoring, analysis };
}
