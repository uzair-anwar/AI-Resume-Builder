import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { RESUME_MAX_PROJECTS } from "@/lib/resume/layout/constants";
import { scoreFactRelevance } from "@/lib/shared/relevance";

type Project = MasterResume["projects"][number];

/** Domain cues when JD text aligns with a project portfolio (not hiring company names). */
const PROJECT_DOMAIN_HINTS: Record<string, RegExp> = {
  "proj-carecentrix":
    /\b(health\s*care|healthcare|home\s+health|palliative|hospital|readmission|medical\s+equipment|pbm|pharmacy\s+benefit)\b/i,
  "proj-navitus": /\b(health\s*care|healthcare|pharmacy|pbm|provider\s+workflow)\b/i,
  "proj-ontab":
    /\b(fintech|finance|financial|investment|transaction|treasury|capital\s+markets|banking)\b/i,
  "proj-monte":
    /\b(analytics|business\s+intelligence|reporting|dashboard|financial\s+analytics)\b/i,
  "proj-ehata": /\b(real\s+estate|property\s+management|proptech)\b/i,
  "proj-adaptec":
    /\b(manufacturing|warehouse|distribution|automation|industrial|supply\s+chain|logistics)\b/i,
};

function projectCorpus(project: Project): string {
  const skillNames = project.facts.flatMap((f) => f.skills ?? []);
  return [project.name, ...project.facts.map((f) => f.text), ...skillNames].join(" ");
}

export function scoreProjectForJob(
  project: Project,
  jobText: string,
  analysis: JobAnalysis,
): number {
  const corpus = projectCorpus(project);
  let score = 0;
  for (const fact of project.facts) {
    score += scoreFactRelevance(fact.text, analysis) * 2;
    for (const skill of fact.skills ?? []) {
      score += scoreFactRelevance(skill, analysis) * 3;
    }
  }
  score += scoreFactRelevance(corpus, analysis);

  const domainRe = PROJECT_DOMAIN_HINTS[project.id];
  if (domainRe && domainRe.test(jobText)) score += 12;

  const jd = jobText.toLowerCase();
  const name = project.name.toLowerCase();
  if (name.length > 3 && jd.includes(name)) score += 8;

  return score;
}

/** Pick up to RESUME_MAX_PROJECTS projects for the one-page resume (highest JD relevance first). */
export function selectProjectIdsForJob(
  resume: MasterResume,
  jobText: string,
  analysis: JobAnalysis,
): string[] {
  if (resume.projects.length <= RESUME_MAX_PROJECTS) {
    return resume.projects.map((p) => p.id);
  }
  const ranked = [...resume.projects].sort(
    (a, b) =>
      scoreProjectForJob(b, jobText, analysis) - scoreProjectForJob(a, jobText, analysis),
  );
  return ranked.slice(0, RESUME_MAX_PROJECTS).map((p) => p.id);
}

export function narrowResumeProjects(resume: MasterResume, projectIds: string[]): MasterResume {
  const byId = new Map(resume.projects.map((p) => [p.id, p]));
  const projects = projectIds.map((id) => byId.get(id)).filter(Boolean) as Project[];
  return { ...resume, projects };
}

export function selectedProjectLabel(resume: MasterResume, ids: string[]): string {
  const byId = new Map(resume.projects.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)?.name ?? id).join(", ");
}
