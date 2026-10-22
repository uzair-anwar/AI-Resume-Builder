import "server-only";
import type { MasterResume, ResumeView } from "@/lib/schemas/resume";
import type { TailoringResult } from "@/lib/schemas/tailoring";
import { getFactById } from "./master-resume";

export function assembleResumeView(resume: MasterResume, tailored: TailoringResult): ResumeView {
  const catMap = new Map(resume.skillCategories.map((c) => [c.id, c.label]));
  const skillById = new Map(resume.skills.map((s) => [s.id, s]));

  const selected = tailored.selectedSkillIds
    .map((id) => skillById.get(id))
    .filter(Boolean) as MasterResume["skills"];

  const order = tailored.skillCategoryOrder.length
    ? tailored.skillCategoryOrder
    : resume.skillCategories.map((c) => c.id);

  const byCat = new Map<string, ResumeView["skills"][0]>();
  for (const catId of order) {
    byCat.set(catId, {
      categoryId: catId,
      categoryLabel: catMap.get(catId) ?? catId,
      items: [],
    });
  }
  for (const s of selected) {
    const bucket = byCat.get(s.categoryId) ?? {
      categoryId: s.categoryId,
      categoryLabel: catMap.get(s.categoryId) ?? s.categoryId,
      items: [],
    };
    bucket.items.push({ id: s.id, name: s.name, userAttested: s.userAttested });
    byCat.set(s.categoryId, bucket);
  }

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
    return {
      id: src.id,
      name: src.name,
      link: src.link,
      description: p.description,
      sourceFactIds: p.sourceFactIds,
    };
  });

  return {
    headline: tailored.headline,
    summary: tailored.summary,
    person: resume.person,
    skills: [...byCat.values()].filter((c) => c.items.length > 0),
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
