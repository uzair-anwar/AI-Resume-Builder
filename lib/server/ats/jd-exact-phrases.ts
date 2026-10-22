import "server-only";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { classifyJdTermKind, isHiringCompanyTerm } from "./jd-dynamic-vocab";

export type JdPhraseTarget = {
  phrase: string;
  canonical: string;
  kind: "tool" | "concept" | "soft" | "industry";
  status: "missing" | "related" | "matched";
  priority: number;
};

/** Prefer the wording scanners see in the job description (longest surface form). */
export function preferredJdSurface(
  chip: JobAnalysis["terms"][number],
  hiringCompanyNames: string[] = [],
): string | undefined {
  const forms = [...(chip.surfaceForms ?? []), chip.term].filter(Boolean);
  const unique = [...new Map(forms.map((f) => [f.toLowerCase(), f])).values()];
  const ok = unique
    .filter((f) => !isHiringCompanyTerm(f, hiringCompanyNames))
    .sort((a, b) => b.length - a.length);
  return ok[0];
}

export function buildJdPhraseTargets(analysis: JobAnalysis): JdPhraseTarget[] {
  const hiring = analysis.hiringCompanyNames ?? [];
  const out: JdPhraseTarget[] = [];
  for (const chip of analysis.terms) {
    if (chip.status === "matched") continue;
    if (isHiringCompanyTerm(chip.term, hiring)) continue;
    const kind = chip.termKind ?? classifyJdTermKind(chip.term);
    if (kind === "noise") continue;
    const phrase = preferredJdSurface(chip, hiring);
    if (!phrase) continue;
    const priority =
      chip.status === "missing" ? (kind === "soft" ? 0 : 1) : kind === "soft" ? 2 : 3;
    out.push({
      phrase,
      canonical: chip.term,
      kind,
      status: chip.status,
      priority,
    });
  }
  out.sort((a, b) => a.priority - b.priority || a.phrase.length - b.phrase.length);
  return out;
}

/** Prompt block: copy exact JD spelling into summary / bullets / projects. */
export function formatExactJdWordingBlock(analysis: JobAnalysis, limit = 40): string {
  const targets = buildJdPhraseTargets(analysis).slice(0, limit);
  if (!targets.length) return "";
  const soft = targets.filter((t) => t.kind === "soft").map((t) => `"${t.phrase}"`);
  const hard = targets
    .filter((t) => t.kind !== "soft")
    .map((t) => `"${t.phrase}"`);
  const lines = [
    "EXACT JOB DESCRIPTION WORDING (Jobscan / ATS match the spelling below — include in summary, experience bullets, or project text, not only the skills list):",
  ];
  if (hard.length) lines.push(`• Hard / domain / concepts: ${hard.join(", ")}`);
  if (soft.length) lines.push(`• Soft skills (summary + at least one bullet): ${soft.join(", ")}`);
  return lines.join("\n");
}

export function augmentAllowedNarrativeTerms(
  base: string[],
  analysis: JobAnalysis,
): string[] {
  const hiring = analysis.hiringCompanyNames ?? [];
  const extra: string[] = [];
  for (const chip of analysis.terms) {
    if (chip.status === "matched") continue;
    if (isHiringCompanyTerm(chip.term, hiring)) continue;
    const kind = chip.termKind ?? classifyJdTermKind(chip.term);
    if (kind === "noise") continue;
    extra.push(chip.term);
    for (const f of chip.surfaceForms ?? []) extra.push(f);
  }
  return [...new Set([...base, ...extra].map((t) => t.trim()).filter(Boolean))];
}
