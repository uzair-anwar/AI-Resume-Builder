import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis, TailoringResult } from "@/lib/schemas/tailoring";
import { TailoringResultSchema } from "@/lib/schemas/tailoring";
import { getAllFactIds } from "./master-resume";
import { buildVerifiedVocabulary, loadTaxonomy, findTermInText } from "./taxonomy";

export type ValidationIssue = { code: string; message: string };

const METRIC_RE = /\b\d+(\.\d+)?%|\b\d+\+?\b/g;

function extractNumbers(text: string): string[] {
  const matches = text.match(METRIC_RE);
  return matches ?? [];
}

export function validateTailoring(
  raw: unknown,
  resume: MasterResume,
  analysis: JobAnalysis,
): { ok: true; data: TailoringResult } | { ok: false; issues: ValidationIssue[] } {
  const parsed = TailoringResultSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: [{ code: "SCHEMA", message: parsed.error.message.slice(0, 500) }],
    };
  }
  const data = parsed.data;
  const issues: ValidationIssue[] = [];
  const factIds = getAllFactIds(resume);
  const skillIds = new Set(resume.skills.map((s) => s.id));
  const vocab = buildVerifiedVocabulary(resume);
  const allowedSkillNames = new Set(resume.skills.map((s) => s.name.toLowerCase()));

  for (const sid of data.selectedSkillIds) {
    if (!skillIds.has(sid)) {
      issues.push({ code: "UNKNOWN_SKILL", message: `Unknown skill id: ${sid}` });
    }
  }

  for (const exp of data.experience) {
    if (!resume.experience.some((e) => e.id === exp.experienceId)) {
      issues.push({ code: "UNKNOWN_EXP", message: `Unknown experience: ${exp.experienceId}` });
    }
    for (const b of exp.bullets) {
      for (const fid of b.sourceFactIds) {
        if (!factIds.has(fid)) issues.push({ code: "UNKNOWN_FACT", message: `Unknown fact: ${fid}` });
      }
      const nums = extractNumbers(b.text);
      for (const fid of b.sourceFactIds) {
        const src = [...resume.experience.flatMap((e) => e.facts), ...resume.projects.flatMap((p) => p.facts)]
          .find((f) => f.id === fid);
        if (src) {
          const srcNums = extractNumbers(src.text);
          for (const n of nums) {
            if (!srcNums.includes(n)) {
              issues.push({ code: "INVENTED_METRIC", message: `Metric ${n} not in source facts` });
            }
          }
        }
      }
    }
  }

  for (const p of data.projects) {
    if (!resume.projects.some((x) => x.id === p.projectId)) {
      issues.push({ code: "UNKNOWN_PROJECT", message: `Unknown project: ${p.projectId}` });
    }
  }

  const tax = loadTaxonomy();
  const checkText = [data.headline, data.summary, ...data.experience.flatMap((e) => e.bullets.map((b) => b.text))].join(
    " ",
  );
  for (const term of tax.terms) {
    if (!findTermInText(checkText, term)) continue;
    const inVocab =
      vocab.has(term.canonical.toLowerCase()) ||
      [...allowedSkillNames].some((s) => s.includes(term.canonical.toLowerCase()));
    if (!inVocab && ["java", "csharp", "dotnet", "kotlin", "go", "ruby", "php", "laravel", "rails"].includes(term.id)) {
      issues.push({
        code: "UNVERIFIED_TECH",
        message: `Technology ${term.canonical} appears in output but is not verified`,
      });
    }
  }

  for (const note of data.requirementNotes) {
    if (note.status === "matched") {
      const det = analysis.gapAnalysis.find(
        (g) => g.requirement === note.requirement || g.requirement.includes(note.requirement),
      );
      if (det && det.status === "missing") {
        issues.push({ code: "FALSE_MATCH", message: `Contradicts gap analysis: ${note.requirement}` });
      }
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, data };
}
