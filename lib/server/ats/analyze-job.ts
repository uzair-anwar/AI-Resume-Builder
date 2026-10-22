import "server-only";
import "@/lib/server/layout-fonts";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { applyTailorLineBudgetCaps, computeLineBudgets } from "@/lib/resume/layout/budgets";
import {
  classifyJdTermKind,
  detectHiringCompanyNames,
  detectJobTitle,
  extractDynamicJdTerms,
  extractJdTerms,
  isEnforceableMissingTerm,
} from "./jd-extract";
import { shortJobTitleForFilename } from "@/lib/shared/job-title";
import { sanitizeDetectedJobTitle } from "./job-title-detect";
import { narrativeAllowTerms } from "./ats-expansion";
import { augmentAllowedNarrativeTerms } from "./jd-exact-phrases";
import { buildProfileVocabulary, isTermMatched, relatedVia } from "./profile-vocab";
import { registerDynamicTaxonomyTerm, resetDynamicTaxonomy } from "./taxonomy";

function mapTermKind(kind: ReturnType<typeof classifyJdTermKind>): "tool" | "concept" | "soft" | "industry" | undefined {
  if (kind === "noise") return undefined;
  return kind;
}

export function analyzeJob(jobText: string, resume: MasterResume): JobAnalysis {
  resetDynamicTaxonomy();
  for (const dyn of extractDynamicJdTerms(jobText)) {
    const kind = classifyJdTermKind(dyn.term);
    if (kind === "noise") continue;
    registerDynamicTaxonomyTerm(
      dyn.term,
      kind === "industry" ? "industry" : kind,
      dyn.surfaceForms,
    );
  }

  const hiringCompanyNames = detectHiringCompanyNames(jobText);
  const extracted = extractJdTerms(jobText);
  const terms = extracted.map((t) => {
    const surfaceForms = t.surfaceForms.length ? t.surfaceForms : [t.term];
    const termKind = mapTermKind(classifyJdTermKind(t.term));
    if (isTermMatched(t.term, resume)) {
      return { term: t.term, surfaceForms, termKind, status: "matched" as const };
    }
    const via = relatedVia(t.term, resume);
    if (via) {
      return { term: t.term, surfaceForms, termKind, status: "related" as const, relatedVia: via };
    }
    return { term: t.term, surfaceForms, termKind, status: "missing" as const };
  });

  const matched = terms.filter((t) => t.status === "matched").length;
  const related = terms.filter((t) => t.status === "related").length;
  const missing = terms.filter((t) => t.status === "missing").length;

  const topMatched = terms
    .filter((t) => t.status === "matched")
    .slice(0, 3)
    .map((t) => t.term);
  const focusLabel =
    topMatched.length > 0
      ? topMatched.join(" · ")
      : (detectJobTitle(jobText, resume.person.defaultHeadline) ?? "General engineering");

  const lineBudgets = applyTailorLineBudgetCaps(computeLineBudgets(resume), resume);
  const analysisDraft = {
    terms,
    hiringCompanyNames,
    coverage: { matched, related, missing, total: terms.length },
    lineBudgets,
    focusLabel,
  } as JobAnalysis;

  const allowedNarrativeTerms = augmentAllowedNarrativeTerms(
    narrativeAllowTerms(terms, resume, analysisDraft),
    analysisDraft,
  );
  const allowedLower = new Set(allowedNarrativeTerms.map((t) => t.toLowerCase()));

  return {
    detectedTitle: shortJobTitleForFilename(
      sanitizeDetectedJobTitle(detectJobTitle(jobText, resume.person.defaultHeadline)) ??
        detectJobTitle(jobText, resume.person.defaultHeadline),
      { hiringCompanyNames },
    ),
    focusLabel,
    terms,
    hiringCompanyNames,
    coverage: {
      matched,
      related,
      missing,
      total: terms.length,
    },
    lineBudgets,
    profileVocabulary: [...buildProfileVocabulary(resume)],
    allowedNarrativeTerms,
    missingTerms: terms
      .filter((t) => t.status === "missing")
      .map((t) => t.term)
      .filter(isEnforceableMissingTerm)
      .filter((t) => !allowedLower.has(t.toLowerCase())),
  };
}
