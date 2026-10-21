import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { buildSkillResolver } from "@/lib/skills/skill-resolver";

/** Numeric tokens, including unit-suffixed ones (99.9%, 3x, 10k, 800ms), so invented metrics are caught. */
const METRIC_RE = /\b\d+(?:\.\d+)?(?:%|x\b|k\b|ms\b)?/gi;

export function extractNumbers(text: string): string[] {
  return text.match(METRIC_RE) ?? [];
}

export function containsForbiddenTerm(text: string, term: string): boolean {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, "i").test(text);
}

export function hasForeignTerm(text: string, analysis: JobAnalysis): boolean {
  const missingTerms = (analysis.missingTerms ?? []).filter((t) => t.length >= 3);
  return missingTerms.some((t) => containsForbiddenTerm(text, t));
}

export function numbersAllowedInText(text: string, allowedFrom: string[]): boolean {
  const allowed = new Set(allowedFrom.flatMap(extractNumbers));
  return extractNumbers(text).every((n) => allowed.has(n));
}

export function defaultSummaryText(resume: MasterResume): string {
  return resume.summaryFacts.map((f) => f.text).join(" ");
}

export function resolveSkillIds(
  resume: MasterResume,
  rawIds: string[],
): string[] {
  const resolve = buildSkillResolver(resume);
  const out: string[] = [];
  for (const raw of rawIds) {
    const id = resolve(raw);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}
