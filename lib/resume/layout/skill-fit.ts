import type { MasterResume, ResumeView } from "@/lib/schemas/resume";
import { buildDefaultResumeView } from "@/lib/resume/build-default-resume";
import { layoutResume } from "@/lib/resume/engine/layout";
import { getTemplate } from "@/lib/resume/templates/registry";
import { buildSkillInputs } from "@/lib/skills/skill-inputs";
import { activeProfile } from "./profile";

/** Resume view whose skills block shows exactly `selectedIds` (in the given category order). */
function viewWithSkills(resume: MasterResume, selectedIds: string[], categoryOrder: string[]): ResumeView {
  const base = buildDefaultResumeView(resume);
  const skills = buildSkillInputs(resume, selectedIds, categoryOrder).map((cat) => {
    const def = resume.skillCategories.find((c) => c.id === cat.categoryId)!;
    return {
      categoryId: cat.categoryId,
      categoryLabel: def.label,
      role: def.role,
      bulletStyle: def.bulletStyle,
      items: cat.skillIds.map((id, i) => {
        const s = resume.skills.find((x) => x.id === id)!;
        return { id: s.id, name: s.name, userAttested: s.userAttested, ...(cat.breaks?.[i] ? { breakAfter: true } : {}) };
      }),
    };
  });
  return { ...base, skills };
}

/**
 * How far (pt) a candidate skills block pushes the page past what the master resume itself needs.
 * The rest of the page is the master's own content, so ≤ 0 means "the skills block fits this template".
 */
export function createSkillsFitCheck(resume: MasterResume, categoryOrder: string[]) {
  const template = getTemplate(activeProfile().templateId);
  // The baseline is the master's own skills (JD-injected `expansion-*` skills are extras).
  const all = resume.skills.filter((s) => !s.id.startsWith("expansion-")).map((s) => s.id);
  const baseline = Math.max(0, layoutResume(viewWithSkills(resume, all, categoryOrder), template).overflow);
  const cache = new Map<string, number>();
  return (ids: string[]): number => {
    const key = ids.join("|");
    let v = cache.get(key);
    if (v === undefined) {
      v = layoutResume(viewWithSkills(resume, ids, categoryOrder), template).overflow;
      cache.set(key, v);
    }
    return v - baseline;
  };
}
