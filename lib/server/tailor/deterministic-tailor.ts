import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { TailorResponse } from "@/lib/schemas/tailoring";
import { buildDefaultResumeView } from "@/lib/resume/build-default-resume";
import { attachAtsScorecard } from "@/lib/server/ats/ats-score";
import { coverResumeView } from "@/lib/server/ats/phrase-coverage";
import { fitResumeViewToOnePage } from "@/lib/resume/layout/fit-one-page";
import { RESUME_MAX_PROJECTS } from "@/lib/resume/layout/constants";
import { scoreFactRelevance } from "./select-facts";
import { prepareTailoringWorkspace } from "./tailoring-workspace";
import { selectedProjectLabel } from "./project-select";
import { polishResumeView } from "@/lib/server/resume/polish-resume-copy";

export function deterministicTailor(resume: MasterResume, jobText: string): TailorResponse {
  const { master: working, tailoring, analysis } = prepareTailoringWorkspace(resume, jobText);
  const base = buildDefaultResumeView(tailoring);

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

  const projects = tailoring.projects.map((p) => ({
    id: p.id,
    name: p.name,
    link: p.link,
    description: p.facts.map((f) => f.text).join(" "),
    sourceFactIds: p.facts.map((f) => f.id),
  }));

  const tailoredResume = polishResumeView(
    fitResumeViewToOnePage(
      coverResumeView(
        {
          ...base,
          experience,
          projects,
        },
        working,
        analysis,
      ),
      analysis,
    ),
    working,
  );

  const warnings = [
    "Used deterministic reordering (AI unavailable or validation failed). Wording unchanged.",
  ];
  if (resume.projects.length > RESUME_MAX_PROJECTS && analysis.selectedProjectIds?.length) {
    warnings.push(
      `Projects on this resume (JD fit): ${selectedProjectLabel(working, analysis.selectedProjectIds)}.`,
    );
  }

  return {
    resume: tailoredResume,
    analysis: attachAtsScorecard(analysis, working, tailoredResume),
    changes: [],
    warnings,
    usedFallback: true,
  };
}
