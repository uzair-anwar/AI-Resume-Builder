import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { detectRoleFamily, type RoleFamily } from "./role-families";
import { findTermInText, loadTaxonomy, normalizeText } from "./taxonomy";

export type SelectedContext = {
  roleFamily: RoleFamily;
  facts: { id: string; text: string; experienceId?: string; projectId?: string }[];
  skills: { id: string; name: string }[];
  summaryFacts: { id: string; text: string }[];
};

function scoreFact(text: string, jobHay: string, family: RoleFamily): number {
  let score = 0;
  const tax = loadTaxonomy();
  for (const kw of family.detectionKeywords) {
    if (jobHay.includes(normalizeText(kw)) && normalizeText(text).includes(normalizeText(kw))) {
      score += 2;
    }
  }
  for (const term of tax.terms) {
    if (findTermInText(jobHay, term) && findTermInText(text, term)) score += 1;
  }
  return score;
}

export function selectFactsForPrompt(
  resume: MasterResume,
  jobText: string,
  analysis: JobAnalysis,
): SelectedContext {
  const roleFamily = detectRoleFamily(jobText, analysis.roleFamilyId);
  const jobHay = normalizeText(jobText);

  const facts: SelectedContext["facts"] = [];
  for (const exp of resume.experience) {
    for (const f of exp.facts) {
      facts.push({
        id: f.id,
        text: f.text,
        experienceId: exp.id,
        projectId: undefined,
      });
    }
  }
  for (const proj of resume.projects) {
    for (const f of proj.facts) {
      facts.push({ id: f.id, text: f.text, projectId: proj.id });
    }
  }

  facts.sort((a, b) => scoreFact(b.text, jobHay, roleFamily) - scoreFact(a.text, jobHay, roleFamily));

  const skillSet = new Map(resume.skills.map((s) => [s.id, s]));
  const scoredSkills = resume.skills.map((s) => ({
    skill: s,
    score:
      (roleFamily.priorityCategoryIds.includes(s.categoryId) ? 3 : 0) +
      scoreFact(s.name, jobHay, roleFamily),
  }));
  scoredSkills.sort((a, b) => b.score - a.score);

  return {
    roleFamily,
    facts: facts.slice(0, 28),
    skills: scoredSkills.map((x) => ({ id: x.skill.id, name: skillSet.get(x.skill.id)!.name })),
    summaryFacts: resume.summaryFacts.map((f) => ({ id: f.id, text: f.text })),
  };
}
