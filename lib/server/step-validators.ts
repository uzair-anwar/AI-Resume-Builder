import { z } from "zod";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { SUMMARY_MAX_LINES } from "@/lib/layout/constants";
import { COLUMN_WIDTH, SIZE_BODY } from "@/lib/layout/constants";
import { countBulletLines, countWrappedLines } from "@/lib/layout/measure";
import { normalizeTypography as nt } from "@/lib/text-normalize";

function getAllFactIds(resume: MasterResume): Set<string> {
  const ids = new Set<string>();
  for (const f of resume.summaryFacts) ids.add(f.id);
  for (const e of resume.experience) for (const f of e.facts) ids.add(f.id);
  for (const p of resume.projects) for (const f of p.facts) ids.add(f.id);
  return ids;
}

function getFactById(resume: MasterResume, id: string): string | undefined {
  for (const f of resume.summaryFacts) if (f.id === id) return f.text;
  for (const e of resume.experience)
    for (const f of e.facts) if (f.id === id) return f.text;
  for (const p of resume.projects)
    for (const f of p.facts) if (f.id === id) return f.text;
  return undefined;
}
import {
  extractNumbers,
  hasForeignTerm,
  numbersAllowedInText,
  resolveSkillIds,
} from "./step-validation-helpers";
import { trimAndFillSkills } from "./tailor-steps/build-skills";
import type { ValidationIssue } from "./validate-tailoring";
import type { RoleFamily } from "./role-families";
import { skillEvidenceTiers } from "./tailor-steps/build-skills";

function textMentionsSkill(text: string, skillName: string, resume: MasterResume): boolean {
  const skill = resume.skills.find((s) => s.name === skillName);
  const names = [skillName, ...(skill?.aliases ?? []), skillName.replace(/\.js$/i, "")];
  return names.some((n) => {
    if (n.length < 2) return false;
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, "i").test(text);
  });
}

const SummarySchema = z.object({ summary: z.string().min(1) });
const ExperienceSchema = z.object({
  bullets: z.array(
    z.object({
      text: z.string().min(1),
      sourceFactIds: z.array(z.string()).min(1),
    }),
  ),
});
const SkillsSchema = z.object({
  selectedSkillIds: z.array(z.string()),
  skillCategoryOrder: z.array(z.string()),
});
const ProjectSchema = z.object({
  description: z.string().min(1),
  sourceFactIds: z.array(z.string()).min(1),
});
const HeadlineSchema = z.object({ headline: z.string().min(1).max(120) });

export function validateSummaryStep(
  raw: unknown,
  resume: MasterResume,
  analysis: JobAnalysis,
): { ok: true; data: { summary: string } } | { ok: false; issues: ValidationIssue[] } {
  const parsed = SummarySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: [{ code: "SCHEMA", message: parsed.error.message.slice(0, 300) }] };
  }
  const summary = nt(parsed.data.summary);
  const allowedNums = resume.summaryFacts.flatMap((f) => extractNumbers(f.text));
  if (
    hasForeignTerm(summary, analysis) ||
    countWrappedLines(summary, COLUMN_WIDTH, SIZE_BODY) > SUMMARY_MAX_LINES ||
    !numbersAllowedInText(summary, allowedNums)
  ) {
    return { ok: false, issues: [{ code: "SUMMARY", message: "Summary failed safety or length checks" }] };
  }
  const tiers = skillEvidenceTiers(resume);
  const primary = tiers.strong.slice(0, 3);
  if (primary.length && !primary.some((n) => textMentionsSkill(summary, n, resume))) {
    return {
      ok: false,
      issues: [
        {
          code: "SUMMARY",
          message: `Summary must name the candidate's primary stack (${primary.join(", ")}). Lead with it, then add JD-matched technologies.`,
        },
      ],
    };
  }
  const specialty = /specializ\w*\s+in\s+([^.]*)/i.exec(summary)?.[1] ?? "";
  if (
    specialty &&
    tiers.working.some((n) => textMentionsSkill(specialty, n, resume)) &&
    !tiers.strong.some((n) => textMentionsSkill(specialty, n, resume))
  ) {
    return {
      ok: false,
      issues: [
        {
          code: "SUMMARY",
          message: `Do not present lightly-evidenced technologies (${tiers.working.slice(0, 4).join(", ")}) as the specialty. Specialize in ${primary.join(", ")}.`,
        },
      ],
    };
  }
  return { ok: true, data: { summary } };
}

export function validateExperienceStep(
  raw: unknown,
  resume: MasterResume,
  analysis: JobAnalysis,
  experienceId: string,
): { ok: true; data: { bullets: { text: string; sourceFactIds: string[] }[] } } | {
  ok: false;
  issues: ValidationIssue[];
} {
  const parsed = ExperienceSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: [{ code: "SCHEMA", message: parsed.error.message.slice(0, 300) }] };
  }
  const src = resume.experience.find((e) => e.id === experienceId);
  if (!src) return { ok: false, issues: [{ code: "EXP", message: "Unknown experience" }] };

  const factIds = getAllFactIds(resume);
  const roleBudget = src.facts.reduce((n, f) => n + countBulletLines(f.text), 0) + 2;
  let lineCount = 0;
  const bullets: { text: string; sourceFactIds: string[] }[] = [];

  for (const b of parsed.data.bullets) {
    const ids = b.sourceFactIds.filter((id) => factIds.has(id) && src.facts.some((f) => f.id === id));
    if (!ids.length) continue;
    const text = nt(b.text);
    const srcNums = ids.flatMap((id) => extractNumbers(getFactById(resume, id) ?? ""));
    if (
      hasForeignTerm(text, analysis) ||
      !numbersAllowedInText(text, srcNums) ||
      countBulletLines(text) > 4
    ) {
      continue;
    }
    lineCount += countBulletLines(text);
    bullets.push({ text, sourceFactIds: ids });
  }

  // Structural invariant: if the model dropped too many bullets (< N - 1), backfill uncovered facts within budget
  const minBullets = Math.max(1, src.facts.length - 1);
  if (bullets.length > 0 && bullets.length < minBullets) {
    const covered = new Set(bullets.flatMap((b) => b.sourceFactIds));
    for (const f of src.facts) {
      if (bullets.length >= minBullets) break;
      if (covered.has(f.id)) continue;
      const flines = countBulletLines(f.text);
      if (lineCount + flines <= roleBudget + 2) {
        bullets.push({ text: f.text, sourceFactIds: [f.id] });
        covered.add(f.id);
        lineCount += flines;
      }
    }
  }

  if (!bullets.length || lineCount > roleBudget + 2) {
    return {
      ok: false,
      issues: [{ code: "EXP", message: "Invalid bullets for role" }],
    };
  }
  return { ok: true, data: { bullets } };
}

export function validateSkillsStep(
  raw: unknown,
  resume: MasterResume,
  analysis: JobAnalysis,
  candidateIds: string[],
  family?: RoleFamily,
):
  | { ok: true; data: { selectedSkillIds: string[]; skillCategoryOrder: string[] } }
  | { ok: false; issues: ValidationIssue[] } {
  const parsed = SkillsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: [{ code: "SCHEMA", message: parsed.error.message.slice(0, 300) }] };
  }
  const resolved = resolveSkillIds(resume, parsed.data.selectedSkillIds);
  const candidateSet = new Set(candidateIds);
  const filtered = resolved.filter((id) => candidateSet.has(id));
  const merged = [...filtered];
  for (const id of candidateIds) {
    if (!merged.includes(id)) merged.push(id);
  }
  const trimmed = trimAndFillSkills(resume, analysis, merged, family);
  const catOrder = parsed.data.skillCategoryOrder.filter((c) =>
    resume.skillCategories.some((x) => x.id === c),
  );
  return {
    ok: true,
    data: {
      selectedSkillIds: trimmed.selectedSkillIds,
      skillCategoryOrder: catOrder.length ? catOrder : trimmed.skillCategoryOrder,
    },
  };
}

export function validateProjectStep(
  raw: unknown,
  resume: MasterResume,
  analysis: JobAnalysis,
  projectId: string,
): { ok: true; data: { description: string; sourceFactIds: string[] } } | {
  ok: false;
  issues: ValidationIssue[];
} {
  const parsed = ProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: [{ code: "SCHEMA", message: parsed.error.message.slice(0, 300) }] };
  }
  const src = resume.projects.find((p) => p.id === projectId);
  if (!src) return { ok: false, issues: [{ code: "PROJ", message: "Unknown project" }] };

  const factIds = getAllFactIds(resume);
  const ids = parsed.data.sourceFactIds.filter((id) => factIds.has(id));
  const description = nt(parsed.data.description);
  const original = src.facts.map((f) => f.text).join(" ");
  const max = (analysis.lineBudgets.projects[projectId] ?? 5) + 1;
  const srcNums = extractNumbers(original);
  if (
    hasForeignTerm(description, analysis) ||
    countWrappedLines(description, COLUMN_WIDTH, SIZE_BODY) > max ||
    !numbersAllowedInText(description, srcNums)
  ) {
    return { ok: false, issues: [{ code: "PROJ", message: "Project description failed checks" }] };
  }
  return {
    ok: true,
    data: {
      description,
      sourceFactIds: ids.length ? ids : src.facts.map((f) => f.id),
    },
  };
}

export function validateHeadlineStep(
  raw: unknown,
  resume: MasterResume,
  analysis: JobAnalysis,
): { ok: true; data: { headline: string } } | { ok: false; issues: ValidationIssue[] } {
  const parsed = HeadlineSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: [{ code: "SCHEMA", message: parsed.error.message.slice(0, 300) }] };
  }
  const headline = nt(parsed.data.headline);
  if (hasForeignTerm(headline, analysis)) {
    return { ok: false, issues: [{ code: "HEADLINE", message: "Headline contains unverified terms" }] };
  }
  const defaultSeniority = resume.person.defaultHeadline.split("(")[0].trim().toLowerCase();
  if (!headline.toLowerCase().includes(defaultSeniority.split(" ")[0])) {
    return { ok: false, issues: [{ code: "HEADLINE", message: "Headline must keep seniority level" }] };
  }
  return { ok: true, data: { headline } };
}

export function fallbackExperience(resume: MasterResume, experienceId: string) {
  const src = resume.experience.find((e) => e.id === experienceId)!;
  return {
    experienceId,
    bullets: src.facts.map((f) => ({ text: f.text, sourceFactIds: [f.id] })),
  };
}

export function fallbackProject(resume: MasterResume, projectId: string) {
  const src = resume.projects.find((p) => p.id === projectId)!;
  return {
    projectId,
    description: src.facts.map((f) => f.text).join(" "),
    sourceFactIds: src.facts.map((f) => f.id),
  };
}
