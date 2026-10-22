import "server-only";
import type { MasterResume, ResumeView } from "@/lib/schemas/resume";
import type { TailoringResult } from "@/lib/schemas/tailoring";
import { normalizeRoleTitleHyphens, toResumeHeadlineCase } from "@/lib/shared/format-headline";
import { normalizeTypography } from "@/lib/shared/text-normalize";
import { enforceExperienceBulletQuality } from "./bullet-metrics";
import { dedupeResumeSynonyms } from "@/lib/server/resume/term-synonym-dedupe";

function polishLine(text: string): string {
  return dedupeResumeSynonyms(normalizeTypography(text));
}

export function polishResumeView(view: ResumeView, resume?: MasterResume): ResumeView {
  const polished = {
    ...view,
    headline: toResumeHeadlineCase(polishLine(view.headline)),
    summary: polishLine(view.summary),
    experience: view.experience.map((e) => ({
      ...e,
      title: toResumeHeadlineCase(normalizeRoleTitleHyphens(e.title)),
      bullets: e.bullets.map((b) => ({ ...b, text: polishLine(b.text) })),
    })),
    projects: view.projects.map((p) => ({
      ...p,
      description: polishLine(p.description),
    })),
  };
  if (!resume) return polished;
  const asTailor: TailoringResult = {
    headline: polished.headline,
    summary: polished.summary,
    selectedSkillIds: resume.skills.map((s) => s.id),
    skillCategoryOrder: resume.skillCategories.map((c) => c.id),
    experience: polished.experience.map((e) => ({
      experienceId: e.id,
      bullets: e.bullets,
    })),
    projects: polished.projects.map((p) => ({
      projectId: p.id,
      description: p.description,
      sourceFactIds: p.sourceFactIds,
    })),
    requirementNotes: [],
    warnings: [],
  };
  const fixed = enforceExperienceBulletQuality(asTailor, resume);
  return {
    ...polished,
    experience: polished.experience.map((e, i) => ({
      ...e,
      bullets: fixed.experience[i]?.bullets ?? e.bullets,
    })),
  };
}

/** Typography + one canonical form per taxonomy alias group (JS/JavaScript, TS/TypeScript, …). */
export function polishTailoringResult(
  data: TailoringResult,
  resume?: MasterResume,
): TailoringResult {
  const polished: TailoringResult = {
    ...data,
    headline: toResumeHeadlineCase(polishLine(data.headline)),
    summary: polishLine(data.summary),
    experience: data.experience.map((e) => ({
      ...e,
      bullets: e.bullets.map((b) => ({ ...b, text: polishLine(b.text) })),
    })),
    projects: data.projects.map((p) => ({
      ...p,
      description: polishLine(p.description),
    })),
  };
  return resume ? enforceExperienceBulletQuality(polished, resume) : polished;
}
