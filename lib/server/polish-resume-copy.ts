import "server-only";
import type { ResumeView } from "@/lib/schemas/resume";
import type { TailoringResult } from "@/lib/schemas/tailoring";
import { normalizeRoleTitleHyphens, toResumeHeadlineCase } from "@/lib/format-headline";
import { normalizeTypography } from "@/lib/text-normalize";
import { dedupeResumeSynonyms } from "./term-synonym-dedupe";

function polishLine(text: string): string {
  return dedupeResumeSynonyms(normalizeTypography(text));
}

export function polishResumeView(view: ResumeView): ResumeView {
  return {
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
}

/** Typography + one canonical form per taxonomy alias group (JS/JavaScript, TS/TypeScript, …). */
export function polishTailoringResult(data: TailoringResult): TailoringResult {
  return {
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
}
