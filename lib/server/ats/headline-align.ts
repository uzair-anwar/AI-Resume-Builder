import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import type { RoleFamily } from "./role-families";
import { toResumeHeadlineCase } from "@/lib/shared/format-headline";
import {
  compactRoleTitle,
  extractRoleTitleFromText,
  headlinePatternForJob,
  isPlausibleJobTitle,
  sanitizeDetectedJobTitle,
} from "./job-title-detect";

const JUNK_HEADLINE =
  /\b(what you will|who you are|responsibilities|requirements|qualifications|you will do)\b/i;

function defaultTitleCore(resume: MasterResume, family: RoleFamily, jobText?: string): string {
  const familyPattern = jobText
    ? headlinePatternForJob(family.headlinePattern, jobText)
    : family.headlinePattern;
  const fromFamily = familyPattern.split("(")[0]!.trim();
  const fromDefault = resume.person.defaultHeadline.split("(")[0]!.trim();
  const preferFamily =
    Boolean(jobText) &&
    /\bfull\s*stack\b/i.test(fromFamily) &&
    !/\bfull\s*stack\b/i.test(fromDefault);
  const pick = preferFamily ? fromFamily : fromDefault || fromFamily;
  return compactRoleTitle(pick, 6);
}

const WEAK_STACK_TOKENS = new Set(["api", "apis", "rest", "http", "https", "git"]);

function formatStackChip(raw: string): string {
  let chip = raw.trim();
  if (!chip) return "";
  if (/^apis?$/i.test(chip)) return "REST APIs";
  const words = chip.split(/\s+/).filter(Boolean).slice(0, 2);
  if (!words.length) return "";
  chip = words.join(" ");
  if (WEAK_STACK_TOKENS.has(chip.toLowerCase())) return "";
  return chip;
}

function optionalStackSuffix(analysis: JobAnalysis, coreTitle: string, maxLen = 28): string {
  if (/\bfull\s*stack\b/i.test(coreTitle)) return "";

  const chips: string[] = [];
  for (const t of analysis.terms) {
    if (t.status !== "matched" && t.status !== "related") continue;
    if (t.termKind !== "tool" && t.termKind !== "concept") continue;
    const chip = formatStackChip(t.surfaceForms?.[0] ?? t.term);
    if (!chip) continue;
    if (chips.some((c) => c.toLowerCase() === chip.toLowerCase())) continue;
    chips.push(chip);
    if (chips.length >= 2) break;
  }

  const stack = chips.join(" · ").trim();
  if (!stack || stack.length > maxLen || /·\s*$/.test(stack)) return "";
  if (chips.length < 2 && WEAK_STACK_TOKENS.has(chips[0]?.toLowerCase() ?? "")) return "";
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
  jobText?: string,
): string {
  const max = 115;
  const jdCore =
    sanitizeDetectedJobTitle(analysis.detectedTitle) ??
    extractRoleTitleFromText(aiHeadline) ??
    (isPlausibleJobTitle(aiHeadline.split("(")[0] ?? "")
      ? compactRoleTitle(aiHeadline.split("(")[0]!)
      : undefined) ??
    defaultTitleCore(resume, family, jobText);

  const core = compactRoleTitle(jdCore, 5);
  const suffix = optionalStackSuffix(analysis, core);
  let out = `${core}${suffix}`.trim();

  if (JUNK_HEADLINE.test(aiHeadline) || JUNK_HEADLINE.test(out)) {
    out = `${defaultTitleCore(resume, family, jobText)}${suffix}`.trim();
  }

  out = out.replace(/\s*\(\s*·?\s*\)/g, "").replace(/\s*\([^)]*·\s*\)/g, (m) => {
    const inner = m.slice(1, -1).trim();
    if (!inner || /^·/.test(inner) || /·\s*$/.test(inner)) return "";
    return m;
  });

  return toResumeHeadlineCase(out.slice(0, max));
}

/** @deprecated Use finalizeResumeHeadline */
export function alignHeadlineToJd(headline: string, analysis: JobAnalysis): string {
  return headline;
}
