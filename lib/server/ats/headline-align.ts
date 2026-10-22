import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import type { RoleFamily } from "./role-families";
import { toResumeHeadlineCase } from "@/lib/shared/format-headline";
import { compactRoleTitle, extractRoleTitleFromText, isPlausibleJobTitle, sanitizeDetectedJobTitle } from "./job-title-detect";

const JUNK_HEADLINE =
  /\b(what you will|who you are|responsibilities|requirements|qualifications|you will do)\b/i;

function defaultTitleCore(resume: MasterResume, family: RoleFamily): string {
  const fromDefault = resume.person.defaultHeadline.split("(")[0]!.trim();
  const fromFamily = family.headlinePattern.split("(")[0]!.trim();
  return compactRoleTitle(fromDefault || fromFamily, 6);
}

function optionalStackSuffix(analysis: JobAnalysis, maxLen = 28): string {
  const terms = analysis.terms
    .filter((t) => t.status === "matched" || t.status === "related")
    .filter((t) => t.termKind === "tool" || t.termKind === "concept")
    .slice(0, 2)
    .map((t) => (t.surfaceForms?.[0] ?? t.term).split(/\s+/).slice(0, 2).join(" "));
  const stack = terms.join(" · ").trim();
  if (!stack || stack.length > maxLen) return "";
  return ` (${stack})`;
}

/**
 * Resume headline = short JD-aligned role (3–6 words), not JD section headers or keyword dumps.
 */
export function finalizeResumeHeadline(
  aiHeadline: string,
  analysis: JobAnalysis,
  resume: MasterResume,
  family: RoleFamily,
): string {
  const max = 115;
  const jdCore =
    sanitizeDetectedJobTitle(analysis.detectedTitle) ??
    extractRoleTitleFromText(aiHeadline) ??
    (isPlausibleJobTitle(aiHeadline.split("(")[0] ?? "")
      ? compactRoleTitle(aiHeadline.split("(")[0]!)
      : undefined) ??
    defaultTitleCore(resume, family);

  const core = compactRoleTitle(jdCore, 5);
  const suffix = optionalStackSuffix(analysis);
  let out = `${core}${suffix}`.trim();

  if (JUNK_HEADLINE.test(aiHeadline) || JUNK_HEADLINE.test(out)) {
    out = `${defaultTitleCore(resume, family)}${suffix}`.trim();
  }

  return toResumeHeadlineCase(out.slice(0, max));
}

/** @deprecated Use finalizeResumeHeadline */
export function alignHeadlineToJd(headline: string, analysis: JobAnalysis): string {
  return headline;
}
