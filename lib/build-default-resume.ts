import type { MasterResume, ResumeView } from "@/lib/schemas/resume";

export function buildDefaultResumeView(resume: MasterResume): ResumeView {
  const catMap = new Map(resume.skillCategories.map((c) => [c.id, c.label]));
  const byCat = new Map<string, ResumeView["skills"][0]>();

  for (const s of resume.skills) {
    const bucket =
      byCat.get(s.categoryId) ?? {
        categoryId: s.categoryId,
        categoryLabel: catMap.get(s.categoryId) ?? s.categoryId,
        items: [],
      };
    bucket.items.push({ id: s.id, name: s.name, userAttested: s.userAttested });
    byCat.set(s.categoryId, bucket);
  }

  return {
    headline: resume.person.defaultHeadline,
    summary: resume.summaryFacts.map((f) => f.text).join(" "),
    person: resume.person,
    skills: resume.skillCategories
      .map((c) => byCat.get(c.id))
      .filter(Boolean) as ResumeView["skills"],
    experience: resume.experience.map((e) => ({
      id: e.id,
      company: e.company,
      title: e.title,
      location: e.location ?? "",
      startDate: e.startDate,
      endDate: e.endDate,
      bullets: e.facts.map((f) => ({ text: f.text, sourceFactIds: [f.id] })),
    })),
    projects: resume.projects.map((p) => ({
      id: p.id,
      name: p.name,
      link: p.link,
      description: p.facts.map((f) => f.text).join(" "),
      sourceFactIds: p.facts.map((f) => f.id),
    })),
    education: resume.education,
  };
}
