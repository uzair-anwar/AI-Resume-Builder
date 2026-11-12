import "server-only";
import type { MasterResume, ResumeView } from "@/lib/schemas/resume";
import type { TailoringResult } from "@/lib/schemas/tailoring";
import { getFactById } from "./master-resume";
import { buildSkillInputs } from "@/lib/skills/skill-inputs";
import { activeProfile } from "@/lib/resume/layout/profile";

/** Skills block of the resume view for the selected skills, in category order. */
export function buildSkillsView(
  resume: MasterResume,
  selectedSkillIds: string[],
  categoryOrder: string[],
): ResumeView["skills"] {
  const order = [
    ...new Set([...categoryOrder, ...resume.skillCategories.map((c) => c.id)]),
  ].filter((id) => resume.skillCategories.some((c) => c.id === id));

  return buildSkillInputs(resume, selectedSkillIds, order).map((cat) => {
    const def = resume.skillCategories.find((c) => c.id === cat.categoryId)!;
    return {
      categoryId: cat.categoryId,
      categoryLabel: def.label,
      role: def.role,
      bulletStyle: def.bulletStyle,
      items: cat.skillIds.map((id, i) => {
        const s = resume.skills.find((x) => x.id === id)!;
        return {
          id: s.id,
          name: s.name,
          userAttested: s.userAttested,
          ...(cat.breaks?.[i] ? { breakAfter: true } : {}),
        };
      }),
    };
  });
}

export function assembleResumeView(resume: MasterResume, tailored: TailoringResult): ResumeView {
  const skills = buildSkillsView(resume, tailored.selectedSkillIds, tailored.skillCategoryOrder);

  const experience = tailored.experience.map((e) => {
    const src = resume.experience.find((x) => x.id === e.experienceId)!;
    return {
      id: src.id,
      company: src.company,
      title: src.title,
      location: src.location ?? "",
      startDate: src.startDate,
      endDate: src.endDate,
      bullets: e.bullets,
    };
  });

  const projects = tailored.projects.map((p) => {
    const src = resume.projects.find((x) => x.id === p.projectId)!;
    // Bullet-style templates print the master's project facts verbatim (they are already sized for
    // the layout); paragraph-style templates (MERN) print the tailored description.
    const verbatim = activeProfile().projectStyle === "bullets";
    return {
      id: src.id,
      name: src.name,
      link: src.link,
      description: verbatim ? src.facts.map((f) => f.text).join(" ") : p.description,
      tagline: src.tagline,
      bullets: src.facts.map((f) => ({ text: f.text, sourceFactIds: [f.id] })),
      sourceFactIds: verbatim ? src.facts.map((f) => f.id) : p.sourceFactIds,
    };
  });

  return {
    headline: tailored.headline,
    summary: tailored.summary,
    person: resume.person,
    skills,
    experience,
    projects,
    education: resume.education,
  };
}

export function buildChanges(resume: MasterResume, tailored: TailoringResult) {
  const changes: { factId: string; original: string; tailored: string }[] = [];
  const defaultSummary = resume.summaryFacts.map((f) => f.text).join(" ");
  if (tailored.summary.trim() !== defaultSummary.trim()) {
    changes.push({
      factId: "summary",
      original: defaultSummary.slice(0, 200),
      tailored: tailored.summary.slice(0, 200),
    });
  }
  for (const exp of tailored.experience) {
    for (const b of exp.bullets) {
      for (const fid of b.sourceFactIds) {
        const orig = getFactById(resume, fid);
        if (orig && orig !== b.text) {
          changes.push({ factId: fid, original: orig, tailored: b.text });
        }
      }
    }
  }
  return changes;
}
