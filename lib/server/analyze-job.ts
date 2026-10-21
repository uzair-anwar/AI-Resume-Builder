import "server-only";
import "./layout-fonts";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { computeLineBudgets } from "@/lib/layout/budgets";
import { detectJobTitle, extractJdTerms, isEnforceableMissingTerm } from "./jd-extract";
import { shortJobTitleForFilename } from "@/lib/job-title";
import { buildProfileVocabulary, isTermMatched, relatedVia } from "./profile-vocab";

export function analyzeJob(jobText: string, resume: MasterResume): JobAnalysis {
  const extracted = extractJdTerms(jobText);
  const terms = extracted.map((t) => {
    if (isTermMatched(t.term, resume)) {
      return { term: t.term, status: "matched" as const };
    }
    const via = relatedVia(t.term, resume);
    if (via) {
      return { term: t.term, status: "related" as const, relatedVia: via };
    }
    return { term: t.term, status: "missing" as const };
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
      : (detectJobTitle(jobText) ?? "General engineering");

  return {
    detectedTitle: shortJobTitleForFilename(detectJobTitle(jobText)),
    focusLabel,
    terms,
    coverage: {
      matched,
      related,
      missing,
      total: terms.length,
    },
    lineBudgets: computeLineBudgets(resume),
    profileVocabulary: [...buildProfileVocabulary(resume)],
    missingTerms: terms
      .filter((t) => t.status === "missing")
      .map((t) => t.term)
      .filter(isEnforceableMissingTerm),
  };
}
