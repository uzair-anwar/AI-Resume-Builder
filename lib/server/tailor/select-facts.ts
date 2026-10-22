import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { scoreFactRelevance as scoreByAnalysis } from "@/lib/shared/relevance";

export type SelectedContext = {
  facts: { id: string; text: string; experienceId?: string; projectId?: string }[];
  skills: { id: string; name: string }[];
  summaryFacts: { id: string; text: string }[];
};

export function scoreFactRelevance(text: string, _jobText: string, analysis: JobAnalysis): number {
  return scoreByAnalysis(text, analysis);
}

export function selectFactsForPrompt(
  resume: MasterResume,
  jobText: string,
  analysis: JobAnalysis,
): SelectedContext {
  const facts: SelectedContext["facts"] = [];
  for (const exp of resume.experience) {
    for (const f of exp.facts) {
      facts.push({ id: f.id, text: f.text, experienceId: exp.id });
    }
  }
  for (const proj of resume.projects) {
    for (const f of proj.facts) {
      facts.push({ id: f.id, text: f.text, projectId: proj.id });
    }
  }
  facts.sort(
    (a, b) =>
      scoreFactRelevance(b.text, jobText, analysis) - scoreFactRelevance(a.text, jobText, analysis),
  );

  const scoredSkills = resume.skills.map((s) => ({
    skill: s,
    score: scoreFactRelevance(s.name, jobText, analysis),
  }));
  scoredSkills.sort((a, b) => b.score - a.score);

  return {
    facts: facts.slice(0, 28),
    skills: scoredSkills.map((x) => ({ id: x.skill.id, name: x.skill.name })),
    summaryFacts: resume.summaryFacts.map((f) => ({ id: f.id, text: f.text })),
  };
}
