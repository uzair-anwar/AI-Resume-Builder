import "server-only";
import "./layout-fonts";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis, TailoringResult } from "@/lib/schemas/tailoring";
import { TailoringResultSchema } from "@/lib/schemas/tailoring";
import { countBulletLines, countWrappedLines } from "@/lib/layout/measure";
import { COLUMN_WIDTH, SIZE_BODY, SUMMARY_MAX_LINES } from "@/lib/layout/constants";
import { countSkillLines } from "@/lib/layout/budgets";
import { normalizeTypography as nt } from "@/lib/text-normalize";
import { getAllFactIds, getFactById } from "./master-resume";
import {
  fitToMaxBulletLines,
  fitToMaxWrappedLines,
  stripDisallowedNumbers,
  stripForbiddenTerms,
} from "./text-sanitize";

export type ValidationIssue = { code: string; message: string };

const METRIC_RE = /\b\d+(\.\d+)?%|\b\d+\+?\b/g;

function extractNumbers(text: string): string[] {
  return text.match(METRIC_RE) ?? [];
}

function containsForbiddenTerm(text: string, term: string): boolean {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, "i").test(text);
}

import { buildSkillResolver } from "@/lib/skills/skill-resolver";

export { buildSkillResolver };

export type RepairReport = { count: number; notes: string[] };

/**
 * Turns a model response into something safe to render. Anything that breaks a rule
 * (unknown ids, JD terms the profile does not have, invented numbers, overflowing text)
 * is replaced by the original wording instead of failing the whole request.
 */
export function repairTailoring(
  data: TailoringResult,
  resume: MasterResume,
  analysis: JobAnalysis,
): { data: TailoringResult; report: RepairReport } {
  const report: RepairReport = { count: 0, notes: [] };
  const note = (msg: string) => {
    report.count++;
    if (report.notes.length < 6) report.notes.push(msg);
  };

  const factIds = getAllFactIds(resume);
  const budgets = analysis.lineBudgets;
  const missingTerms = (analysis.missingTerms ?? []).filter((t) => t.length >= 3);
  const hasForeign = (text: string) => missingTerms.some((t) => containsForbiddenTerm(text, t));
  const resolveSkill = buildSkillResolver(resume);

  // headline & summary
  let headline = stripForbiddenTerms(data.headline, analysis);
  if (hasForeign(headline)) {
    headline = resume.person.defaultHeadline;
    note("headline");
  }
  const defaultSummary = resume.summaryFacts.map((f) => f.text).join(" ");
  const summaryAllowedNums = resume.summaryFacts.flatMap((f) => extractNumbers(f.text));
  let summary = stripForbiddenTerms(data.summary, analysis);
  summary = stripDisallowedNumbers(summary, summaryAllowedNums);
  summary = fitToMaxWrappedLines(summary, SUMMARY_MAX_LINES, COLUMN_WIDTH, SIZE_BODY);
  if (!summary.trim() || hasForeign(summary)) {
    summary = defaultSummary;
    note("summary");
  }

  // skills
  const skillById = new Map(resume.skills.map((s) => [s.id, s]));
  const selected: string[] = [];
  for (const raw of data.selectedSkillIds) {
    const id = resolveSkill(raw);
    if (!id || selected.includes(id)) continue;
    const skill = skillById.get(id)!;
    if (hasForeign(skill.name)) continue;
    selected.push(id);
  }
  if (!selected.length) {
    selected.push(...resume.skills.map((s) => s.id));
  }

  const catOrder = [
    ...new Set([
      ...data.skillCategoryOrder.filter((c) => resume.skillCategories.some((x) => x.id === c)),
      ...resume.skillCategories.map((c) => c.id),
    ]),
  ];

  const jdTerms = new Set(
    analysis.terms.filter((t) => t.status !== "missing").map((t) => t.term.toLowerCase()),
  );
  const isRelevantSkill = (id: string) => {
    const name = skillById.get(id)!.name.toLowerCase();
    return [...jdTerms].some((t) => name.includes(t) || t.includes(name));
  };

  const linesFor = (ids: string[]) =>
    countSkillLines(
      catOrder.map((cid) => ({
        categoryId: cid,
        names: ids
          .filter((id) => skillById.get(id)!.categoryId === cid)
          .map((id) => skillById.get(id)!.name),
      })),
    );

  // trim until skills fit the budget: drop JD-irrelevant skills from the end first
  let guard = 0;
  let trimmed = false;
  while (linesFor(selected) > budgets.skillsMaxLines && guard++ < 200) {
    trimmed = true;
    let idx = -1;
    for (let i = selected.length - 1; i >= 0; i--) {
      if (!isRelevantSkill(selected[i])) {
        idx = i;
        break;
      }
    }
    if (idx < 0) idx = selected.length - 1;
    selected.splice(idx, 1);
  }
  if (trimmed) note("skills trimmed to fit");

  // A very sparse skills block looks broken next to the template: top it up with the
  // most JD-relevant remaining skills (then profile order) until it is ~70% of the budget.
  const target = budgets.skillsMaxLines;
  if (linesFor(selected) < target) {
    const rest = resume.skills
      .map((s) => s.id)
      .filter((id) => !selected.includes(id) && !hasForeign(skillById.get(id)!.name));
    rest.sort((a, b) => Number(isRelevantSkill(b)) - Number(isRelevantSkill(a)));
    for (const id of rest) {
      if (linesFor(selected) >= target) break;
      if (linesFor([...selected, id]) <= budgets.skillsMaxLines) selected.push(id);
    }
  }

  // experience (always every role, in resume order)
  const allFacts = [
    ...resume.experience.flatMap((e) => e.facts),
    ...resume.projects.flatMap((p) => p.facts),
  ];
  const experience = resume.experience.map((src) => {
    const fromAi = data.experience.find((e) => e.experienceId === src.id);
    const bullets: TailoringResult["experience"][number]["bullets"] = [];
    for (const b of fromAi?.bullets ?? []) {
      const ids = b.sourceFactIds.filter((id) => factIds.has(id));
      if (!ids.length) {
        note("bullet without a valid source");
        continue;
      }
      const max = Math.max(...ids.map((id) => budgets.bullets[id] ?? 2));
      const srcNums = ids.flatMap((id) => {
        const f = allFacts.find((x) => x.id === id);
        return f ? extractNumbers(f.text) : [];
      });
      let text = stripForbiddenTerms(b.text, analysis);
      text = stripDisallowedNumbers(text, srcNums);
      text = fitToMaxBulletLines(text, max);
      const bad =
        !text.trim() ||
        hasForeign(text) ||
        countBulletLines(text) > max ||
        extractNumbers(text).some((n) => !srcNums.includes(n));
      if (bad) {
        const original = ids
          .map((id) => getFactById(resume, id) ?? "")
          .join(" ")
          .trim();
        note(`bullet ${ids[0]}`);
        bullets.push({ text: original || b.text, sourceFactIds: ids });
      } else {
        bullets.push({ text, sourceFactIds: ids });
      }
    }
    if (!bullets.length) {
      for (const f of src.facts) bullets.push({ text: f.text, sourceFactIds: [f.id] });
    }
    return { experienceId: src.id, bullets };
  });

  // projects (all projects; AI order kept for known ones)
  const knownProjects = data.projects.filter((p) =>
    resume.projects.some((x) => x.id === p.projectId),
  );
  const seen = new Set<string>();
  const projects: TailoringResult["projects"] = [];
  const pushProject = (projectId: string, description: string | null, ids: string[]) => {
    if (seen.has(projectId)) return;
    seen.add(projectId);
    const src = resume.projects.find((x) => x.id === projectId)!;
    const original = src.facts.map((f) => f.text).join(" ");
    const srcIds = src.facts.map((f) => f.id);
    const max = budgets.projects[projectId] ?? 5;
    const srcNums = extractNumbers(original);
    let sanitized =
      description !== null
        ? fitToMaxWrappedLines(
            stripDisallowedNumbers(stripForbiddenTerms(description, analysis), srcNums),
            max,
            COLUMN_WIDTH,
            SIZE_BODY,
          )
        : null;
    const ok =
      sanitized !== null &&
      sanitized.trim() &&
      !hasForeign(sanitized) &&
      countWrappedLines(sanitized, COLUMN_WIDTH, SIZE_BODY) <= max &&
      extractNumbers(sanitized).every((n) => srcNums.includes(n));
    if (description !== null && !ok) note(`project ${projectId}`);
    projects.push({
      projectId,
      description: ok ? sanitized! : original,
      sourceFactIds: ids.length ? ids.filter((id) => factIds.has(id)) : srcIds,
    });
  };
  for (const p of knownProjects) pushProject(p.projectId, p.description, p.sourceFactIds);
  for (const src of resume.projects) pushProject(src.id, null, []);
  for (const p of projects) {
    if (!p.sourceFactIds.length) {
      p.sourceFactIds = resume.projects.find((x) => x.id === p.projectId)!.facts.map((f) => f.id);
    }
  }

  return {
    data: {
      ...data,
      headline,
      summary,
      selectedSkillIds: selected,
      skillCategoryOrder: catOrder,
      experience,
      projects,
    },
    report,
  };
}

export function validateTailoring(
  raw: unknown,
  resume: MasterResume,
  analysis: JobAnalysis,
):
  | { ok: true; data: TailoringResult; repairs: RepairReport }
  | { ok: false; issues: ValidationIssue[] } {
  const parsed = TailoringResultSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: [{ code: "SCHEMA", message: parsed.error.message.slice(0, 500) }] };
  }
  const d = parsed.data;
  const cleaned: TailoringResult = {
    ...d,
    headline: nt(d.headline),
    summary: nt(d.summary),
    experience: d.experience.map((e) => ({
      ...e,
      bullets: e.bullets.map((b) => ({ ...b, text: nt(b.text) })),
    })),
    projects: d.projects.map((p) => ({ ...p, description: nt(p.description) })),
  };
  const { data, report } = repairTailoring(cleaned, resume, analysis);
  return { ok: true, data, repairs: report };
}
