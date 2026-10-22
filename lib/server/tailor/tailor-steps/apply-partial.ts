import type { MasterResume, ResumeView } from "@/lib/schemas/resume";
import type { TailorStepPrevious } from "@/lib/schemas/tailoring-steps";
import { buildDefaultResumeView } from "@/lib/resume/build-default-resume";
import { stagedToTailoringResult } from "@/lib/server/tailor/tailor-steps/run-step";
import { assembleResumeView } from "@/lib/server/resume/assemble-resume";

/** Merge staged step output onto the default resume view for incremental UI preview. */
export function applyStagedToResumeView(
  resume: MasterResume,
  state: TailorStepPrevious,
): ResumeView {
  const tailoring = stagedToTailoringResult(state, resume);
  return assembleResumeView(resume, tailoring);
}

export function baseResumeView(resume: MasterResume): ResumeView {
  return buildDefaultResumeView(resume);
}
