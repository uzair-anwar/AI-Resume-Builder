import { z } from "zod";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { SUMMARY_MAX_LINES } from "@/lib/resume/layout/constants";
import { COLUMN_WIDTH, SIZE_BODY } from "@/lib/resume/layout/constants";
import { countBulletLines } from "@/lib/resume/layout/measure";
import { normalizeTypography as nt } from "@/lib/shared/text-normalize";
import type { RoleFamily } from "@/lib/server/ats/role-families";
import { getFactById } from "@/lib/server/resume/master-resume";
import { extractNumbers, resolveSkillIds } from "./step-validation-helpers";
import { trimAndFillSkills } from "./tailor-steps/build-skills";
import {
  fitToMaxBulletLines,
  fitToMaxWrappedLines,
  stripDisallowedNumbers,
  stripForbiddenTerms,
} from "@/lib/server/text-sanitize";

const SummarySchema = z.object({ summary: z.string().min(1) });
const ExperienceSchema = z.object({
  bullets: z.array(
    z.object({
      text: z.string().min(1),
      sourceFactIds: z.array(z.string()),
    }),
  ),
});
const SkillsSchema = z.object({
  selectedSkillIds: z.array(z.string()),
  skillCategoryOrder: z.array(z.string()).optional(),
});
const ProjectSchema = z.object({
  description: z.string().min(1),
  sourceFactIds: z.array(z.string()),
});
const HeadlineSchema = z.object({ headline: z.string().min(1) });

export function coerceSummaryStep(
  raw: unknown,
  resume: MasterResume,
  analysis: JobAnalysis,
): { summary: string } | null {
  const parsed = SummarySchema.safeParse(raw);
  if (!parsed.success) return null;
  const allowedNums = resume.summaryFacts.flatMap((f) => extractNumbers(f.text));
  let summary = nt(parsed.data.summary);
  summary = stripForbiddenTerms(summary, analysis);
  summary = stripDisallowedNumbers(summary, allowedNums);
  summary = fitToMaxWrappedLines(summary, SUMMARY_MAX_LINES, COLUMN_WIDTH, SIZE_BODY);
  if (!summary.trim()) return null;
  return { summary };
}

export function coerceExperienceStep(
  raw: unknown,
  resume: MasterResume,
  analysis: JobAnalysis,
  experienceId: string,
): { bullets: { text: string; sourceFactIds: string[] }[] } | null {
  const parsed = ExperienceSchema.safeParse(raw);
  const src = resume.experience.find((e) => e.id === experienceId);
  if (!src) return null;

  const roleIds = new Set(src.facts.map((f) => f.id));
  const roleBudget = Math.min(
    src.facts.reduce((n, f) => n + Math.min(countBulletLines(f.text), 3), 0) + 2,
    src.facts.length * 3 + 2,
  );
  const bullets: { text: string; sourceFactIds: string[] }[] = [];

  const rows = parsed.success ? parsed.data.bullets : [];
  for (const b of rows) {
    let ids = b.sourceFactIds.filter((id) => roleIds.has(id));
    if (!ids.length && src.facts.length) {
      ids = [src.facts[0]!.id];
    }
    if (!ids.length) continue;

    const srcNums = ids.flatMap((id) => extractNumbers(getFactById(resume, id) ?? ""));
    let text = nt(b.text);
    text = stripForbiddenTerms(text, analysis);
    text = stripDisallowedNumbers(text, srcNums);
    text = fitToMaxBulletLines(text, 3);
    if (!text.trim()) continue;
    bullets.push({ text, sourceFactIds: ids });
  }

  if (!bullets.length) {
    for (const f of src.facts) {
      bullets.push({ text: f.text, sourceFactIds: [f.id] });
    }
  } else {
    // Structural invariant: backfill uncovered facts if AI returned fewer than N - 1 bullets
    const minBullets = Math.max(1, src.facts.length - 1);
    if (bullets.length < minBullets) {
      const covered = new Set(bullets.flatMap((b) => b.sourceFactIds));
      for (const f of src.facts) {
        if (bullets.length >= minBullets) break;
        if (covered.has(f.id)) continue;
        bullets.push({ text: f.text, sourceFactIds: [f.id] });
        covered.add(f.id);
      }
    }
  }

  while (bullets.length > 1) {
    const lineCount = bullets.reduce((n, b) => n + countBulletLines(b.text), 0);
    if (lineCount <= roleBudget + 2) break;
    bullets.pop();
  }
  if (!bullets.length) return null;
  return { bullets };
}

export function coerceSkillsStep(
  raw: unknown,
  resume: MasterResume,
  analysis: JobAnalysis,
  candidateIds: string[],
  family: RoleFamily,
): { selectedSkillIds: string[]; skillCategoryOrder: string[] } | null {
  const parsed = SkillsSchema.safeParse(raw);
  const rawIds = parsed.success ? parsed.data.selectedSkillIds : [];
  const resolved = resolveSkillIds(resume, rawIds);
  const merged = [...resolved];
  for (const id of candidateIds) {
    if (!merged.includes(id)) merged.push(id);
  }
  if (!merged.length) return null;
  const trimmed = trimAndFillSkills(resume, analysis, merged, family);
  const catOrder = parsed.success
    ? (parsed.data.skillCategoryOrder ?? []).filter((c) =>
        resume.skillCategories.some((x) => x.id === c),
      )
    : [];
  return {
    selectedSkillIds: trimmed.selectedSkillIds,
    skillCategoryOrder: catOrder.length ? catOrder : trimmed.skillCategoryOrder,
  };
}

export function coerceProjectStep(
  raw: unknown,
  resume: MasterResume,
  analysis: JobAnalysis,
  projectId: string,
): { description: string; sourceFactIds: string[] } | null {
  const parsed = ProjectSchema.safeParse(raw);
  const src = resume.projects.find((p) => p.id === projectId);
  if (!src) return null;

  const original = src.facts.map((f) => f.text).join(" ");
  const srcNums = extractNumbers(original);
  const max = (analysis.lineBudgets.projects[projectId] ?? 5) + 1;
  const defaultIds = src.facts.map((f) => f.id);

  if (!parsed.success) return null;

  let ids = parsed.data.sourceFactIds.filter((id) => defaultIds.includes(id));
  if (!ids.length) ids = defaultIds;

  let description = nt(parsed.data.description);
  description = stripForbiddenTerms(description, analysis);
  description = stripDisallowedNumbers(description, srcNums);
  description = fitToMaxWrappedLines(description, max, COLUMN_WIDTH, SIZE_BODY);
  if (!description.trim()) return null;

  return { description, sourceFactIds: ids };
}

export function coerceHeadlineStep(
  raw: unknown,
  resume: MasterResume,
  analysis: JobAnalysis,
): { headline: string } | null {
  const parsed = HeadlineSchema.safeParse(raw);
  if (!parsed.success) return null;

  let headline = nt(parsed.data.headline).slice(0, 120);
  headline = stripForbiddenTerms(headline, analysis);
  if (!headline.trim()) return null;

  const seniorityToken = resume.person.defaultHeadline.split("(")[0].trim().split(/\s+/)[0];
  if (seniorityToken && !headline.toLowerCase().includes(seniorityToken.toLowerCase())) {
    headline = `${seniorityToken} ${headline}`.slice(0, 120);
  }
  return { headline };
}
