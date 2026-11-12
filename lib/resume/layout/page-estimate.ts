import type { ResumeView } from "@/lib/schemas/resume";
import { layoutResume } from "@/lib/resume/engine/layout";
import { getTemplate } from "@/lib/resume/templates/registry";
import { activeProfile } from "./profile";

/** Exact one-page check: lays the resume out with the active template and compares to its bottom limit. */
export function resumeOverflowPt(resume: ResumeView, templateId = activeProfile().templateId): number {
  return layoutResume(resume, getTemplate(templateId)).overflow;
}

export function resumeExceedsOnePage(resume: ResumeView, templateId?: string): boolean {
  return resumeOverflowPt(resume, templateId) > 0;
}

/** Overflow expressed in body lines (0 when everything fits). */
export function maxColumnLineOverflow(resume: ResumeView, templateId?: string): number {
  return resumeOverflowPt(resume, templateId) / activeProfile().lineHeight;
}
