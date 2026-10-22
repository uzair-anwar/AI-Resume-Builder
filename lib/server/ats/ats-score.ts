import "server-only";
import type { MasterResume, ResumeView } from "@/lib/schemas/resume";
import type { AtsScorecard, JobAnalysis } from "@/lib/schemas/tailoring";
import { buildDefaultResumeView } from "@/lib/build-default-resume";
import { countResumeBulletsWithMetrics } from "./bullet-metrics";
import { findTaxonomyTermByName, findTermInText } from "./taxonomy";

function termPresentInText(term: string, text: string): boolean {
  const hay = text.toLowerCase();
  const needle = term.toLowerCase().trim();
  if (!needle) return false;
  if (hay.includes(needle)) return true;

  const taxTerm = findTaxonomyTermByName(term);
  if (taxTerm && findTermInText(hay, taxTerm)) return true;

  return false;
}

function scoreSingleResumeView(
  view: ResumeView,
  master: MasterResume,
  analysis: JobAnalysis,
): {
  total: number;
  keywordsInContextScore: number;
  skillCoverageScore: number;
  titleAlignmentScore: number;
  structuralScore: number;
  presentTerms: Set<string>;
} {
  const narrativeCorpus = [
    view.headline,
    view.summary,
    ...view.experience.flatMap((e) => [e.title, ...e.bullets.map((b) => b.text)]),
    ...view.projects.map((p) => `${p.name} ${p.description}`),
  ].join(" \n ");

  const skillsCorpus = view.skills
    .flatMap((c) => [c.categoryLabel, ...c.items.map((i) => i.name)])
    .join(" ");

  const fullCorpus = `${narrativeCorpus} \n ${skillsCorpus}`;
  const presentTerms = new Set<string>();

  const terms = analysis.terms;
  if (!terms.length) {
    return {
      total: 85,
      keywordsInContextScore: 85,
      skillCoverageScore: 85,
      titleAlignmentScore: 85,
      structuralScore: 95,
      presentTerms,
    };
  }

  // 1. Keyword Match in Context (50% weight)
  // Enterprise ATS (Workday/iCIMS/Jobscan) weight narrative occurrence (summary + bullets) higher than skills-only
  let contextPoints = 0;
  const maxContextPoints = terms.length;
  for (const t of terms) {
    const forms = [t.term, ...(t.surfaceForms ?? [])];
    const inNarrative =
      forms.some((f) => termPresentInText(f, narrativeCorpus)) ||
      (t.relatedVia ? termPresentInText(t.relatedVia, narrativeCorpus) : false);
    const inSkills =
      forms.some((f) => termPresentInText(f, skillsCorpus)) ||
      (t.relatedVia ? termPresentInText(t.relatedVia, skillsCorpus) : false);

    if (inNarrative) {
      contextPoints += 1.0;
      presentTerms.add(t.term);
    } else if (inSkills) {
      contextPoints += 0.65;
      presentTerms.add(t.term);
    } else if (t.status === "related") {
      contextPoints += 0.35;
    }
  }
  const keywordsInContextScore = Math.min(
    100,
    Math.round((contextPoints / Math.max(1, maxContextPoints)) * 100),
  );

  // 2. Skill & Concept Coverage (25% weight)
  const coveredCount = terms.filter(
    (t) => t.status === "matched" || t.status === "related" || presentTerms.has(t.term),
  ).length;
  const skillCoverageScore = Math.min(
    100,
    Math.round((coveredCount / Math.max(1, terms.length)) * 100),
  );

  // 3. Title & Headline Alignment (15% weight)
  const targetTitle = (analysis.detectedTitle ?? analysis.focusLabel ?? "").toLowerCase();
  const titleTokens = targetTitle
    .split(/[^a-z0-9.+#]+/)
    .filter((w) => w.length >= 3 && !["the", "and", "for", "with", "about"].includes(w));
  const headAndSum = `${view.headline} ${view.summary}`.toLowerCase();
  let titleHits = 0;
  for (const tok of titleTokens) {
    if (headAndSum.includes(tok)) titleHits++;
  }
  const titleAlignmentScore =
    titleTokens.length > 0
      ? Math.min(100, Math.round(50 + (titleHits / titleTokens.length) * 50))
      : 85;

  // 4. Structural & Metric Completeness (10% weight)
  const expectedBullets = master.experience.reduce(
    (n, e) => n + Math.max(1, e.facts.length - 1),
    0,
  );
  const actualBullets = view.experience.reduce((n, e) => n + e.bullets.length, 0);
  const bulletRatio = expectedBullets > 0 ? Math.min(1, actualBullets / expectedBullets) : 1;
  const { total: bulletTotal, withMetric } = countResumeBulletsWithMetrics(view);
  const metricRatio = bulletTotal > 0 ? withMetric / bulletTotal : 0;
  const metricScore = metricRatio >= 0.5 ? 20 : metricRatio >= 0.35 ? 15 : metricRatio > 0 ? 12 : 8;
  const structuralScore = Math.round(bulletRatio * 80 + metricScore);

  const total = Math.min(
    99,
    Math.round(
      keywordsInContextScore * 0.5 +
        skillCoverageScore * 0.25 +
        titleAlignmentScore * 0.15 +
        structuralScore * 0.1,
    ),
  );

  return {
    total,
    keywordsInContextScore,
    skillCoverageScore,
    titleAlignmentScore,
    structuralScore,
    presentTerms,
  };
}

export function attachAtsScorecard(
  analysis: JobAnalysis,
  master: MasterResume,
  tailoredView: ResumeView,
): JobAnalysis {
  const baselineView = buildDefaultResumeView(master);
  const base = scoreSingleResumeView(baselineView, master, analysis);
  const tail = scoreSingleResumeView(tailoredView, master, analysis);

  const wovenTerms: string[] = [];
  const enrichedTerms = analysis.terms.map((t) => {
    const inTailored = tail.presentTerms.has(t.term);
    if (inTailored && !base.presentTerms.has(t.term)) {
      wovenTerms.push(t.term);
    }
    return {
      ...t,
      inTailoredResume: inTailored,
    };
  });

  const atsScorecard: AtsScorecard = {
    baselineScore: base.total,
    tailoredScore: Math.max(base.total, tail.total),
    keywordsInContextScore: tail.keywordsInContextScore,
    skillCoverageScore: tail.skillCoverageScore,
    titleAlignmentScore: tail.titleAlignmentScore,
    structuralScore: tail.structuralScore,
    wovenTerms,
  };

  return {
    ...analysis,
    terms: enrichedTerms,
    atsScorecard,
  };
}
