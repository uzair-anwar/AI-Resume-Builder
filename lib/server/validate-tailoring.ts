import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis, TailoringResult } from "@/lib/schemas/tailoring";
import { TailoringResultSchema } from "@/lib/schemas/tailoring";
import { countBulletLines, countWrappedLines } from "@/lib/layout/measure";
import { COLUMN_WIDTH, SIZE_BODY } from "@/lib/layout/constants";
import { getAllFactIds } from "./master-resume";

export type ValidationIssue = { code: string; message: string };

const METRIC_RE = /\b\d+(\.\d+)?%|\b\d+\+?\b/g;

function extractNumbers(text: string): string[] {
  return text.match(METRIC_RE) ?? [];
}

function containsForbiddenTerm(text: string, term: string): boolean {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${esc}\\b`, "i").test(text);
}

export function validateTailoring(
  raw: unknown,
  resume: MasterResume,
  analysis: JobAnalysis,
): { ok: true; data: TailoringResult } | { ok: false; issues: ValidationIssue[] } {
  const parsed = TailoringResultSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: [{ code: "SCHEMA", message: parsed.error.message.slice(0, 500) }] };
  }
  const data = parsed.data;
  const issues: ValidationIssue[] = [];
  const factIds = getAllFactIds(resume);
  const skillIds = new Set(resume.skills.map((s) => s.id));
  const budgets = analysis.lineBudgets;
  const missingTerms = analysis.missingTerms ?? [];

  for (const sid of data.selectedSkillIds) {
    if (!skillIds.has(sid))
      issues.push({ code: "UNKNOWN_SKILL", message: `Unknown skill id: ${sid}` });
  }

  const outputText = [
    data.headline,
    data.summary,
    ...data.experience.flatMap((e) => e.bullets.map((b) => b.text)),
    ...data.projects.map((p) => p.description),
    ...data.selectedSkillIds.map((id) => resume.skills.find((s) => s.id === id)?.name ?? ""),
  ].join(" ");

  for (const term of missingTerms) {
    if (term.length >= 3 && containsForbiddenTerm(outputText, term)) {
      issues.push({ code: "FOREIGN_TERM", message: `Output mentions missing JD term: ${term}` });
    }
  }

  const summaryLines = countWrappedLines(data.summary, COLUMN_WIDTH, SIZE_BODY);
  if (summaryLines > budgets.summaryMaxLines) {
    issues.push({
      code: "SUMMARY_OVERFLOW",
      message: `Summary ${summaryLines} lines exceeds budget ${budgets.summaryMaxLines}`,
    });
  }

  for (const exp of data.experience) {
    if (!resume.experience.some((e) => e.id === exp.experienceId)) {
      issues.push({ code: "UNKNOWN_EXP", message: `Unknown experience: ${exp.experienceId}` });
    }
    for (const b of exp.bullets) {
      for (const fid of b.sourceFactIds) {
        if (!factIds.has(fid))
          issues.push({ code: "UNKNOWN_FACT", message: `Unknown fact: ${fid}` });
      }
      const max = Math.max(...b.sourceFactIds.map((id) => budgets.bullets[id] ?? 2));
      const lines = countBulletLines(b.text);
      if (lines > max) {
        issues.push({
          code: "BULLET_OVERFLOW",
          message: `Bullet exceeds ${max} lines for ${b.sourceFactIds.join(",")}`,
        });
      }
      const nums = extractNumbers(b.text);
      for (const fid of b.sourceFactIds) {
        const src = [
          ...resume.experience.flatMap((e) => e.facts),
          ...resume.projects.flatMap((p) => p.facts),
        ].find((f) => f.id === fid);
        if (src) {
          const srcNums = extractNumbers(src.text);
          for (const n of nums) {
            if (!srcNums.includes(n))
              issues.push({ code: "INVENTED_METRIC", message: `Metric ${n} not in source` });
          }
        }
      }
    }
  }

  for (const p of data.projects) {
    if (!resume.projects.some((x) => x.id === p.projectId)) {
      issues.push({ code: "UNKNOWN_PROJECT", message: `Unknown project: ${p.projectId}` });
    }
    const max = budgets.projects[p.projectId] ?? 5;
    const lines = countWrappedLines(p.description, COLUMN_WIDTH, SIZE_BODY);
    if (lines > max) {
      issues.push({
        code: "PROJECT_OVERFLOW",
        message: `Project ${p.projectId} exceeds ${max} lines`,
      });
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, data };
}
