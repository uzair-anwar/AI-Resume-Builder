import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis, TailorResponse } from "@/lib/schemas/tailoring";
import { buildDefaultResumeView } from "@/lib/build-default-resume";
import { attachAtsScorecard } from "./ats-score";
import { mergeResumeWithExpansionSkills } from "./ats-expansion";
import { coverResumeView } from "./phrase-coverage";
import { scoreFactRelevance } from "./select-facts";

export function deterministicTailor(
  resume: MasterResume,
  jobText: string,
  analysis: JobAnalysis,
): TailorResponse {
  const working = mergeResumeWithExpansionSkills(resume, analysis);
  const base = buildDefaultResumeView(working);

  const scoredBullets = working.experience.map((exp) => ({
    exp,
    facts: [...exp.facts].sort(
      (a, b) =>
        scoreFactRelevance(b.text, jobText, analysis) -
        scoreFactRelevance(a.text, jobText, analysis),
    ),
  }));

  const experience = scoredBullets.map(({ exp, facts }) => ({
    id: exp.id,
    company: exp.company,
    title: exp.title,
    location: exp.location ?? "",
    startDate: exp.startDate,
    endDate: exp.endDate,
    bullets: facts.map((f) => ({ text: f.text, sourceFactIds: [f.id] })),
  }));

  const projects = [...working.projects]
    .sort((a, b) => {
      const ta = a.facts.map((f) => f.text).join(" ");
      const tb = b.facts.map((f) => f.text).join(" ");
      return scoreFactRelevance(tb, jobText, analysis) - scoreFactRelevance(ta, jobText, analysis);
    })
    .map((p) => ({
      id: p.id,
      name: p.name,
      link: p.link,
      description: p.facts.map((f) => f.text).join(" "),
      sourceFactIds: p.facts.map((f) => f.id),
    }));

  const tailoredResume = coverResumeView(
    {
      ...base,
      experience,
      projects,
    },
    working,
    analysis,
  );

  return {
    resume: tailoredResume,
    analysis: attachAtsScorecard(analysis, working, tailoredResume),
    changes: [],
    warnings: [
      "Used deterministic reordering (AI unavailable or validation failed). Wording unchanged.",
    ],
    usedFallback: true,
  };
}
