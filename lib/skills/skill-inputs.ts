import type { MasterResume } from "@/lib/schemas/resume";
import type { SkillCategoryInput } from "@/lib/resume/layout/skill-line";
import { categoryRole } from "./category-roles";

/** Row sizes ("• a • b" rows) of a category as the master resume prints them (from `breakAfter`). */
function masterRowSizes(resume: MasterResume, categoryId: string): number[] {
  const rows: number[] = [];
  let run = 0;
  for (const s of resume.skills) {
    if (s.categoryId !== categoryId) continue;
    run += 1;
    if (s.breakAfter) {
      rows.push(run);
      run = 0;
    }
  }
  if (run) rows.push(run);
  return rows;
}

/**
 * Row ends for `count` selected items of a category: the master's row sizes are replayed, so a
 * trimmed or reordered category keeps the look of the original rows.
 */
export function rowBreaks(resume: MasterResume, categoryId: string, count: number): boolean[] {
  const breaks = new Array<boolean>(count).fill(false);
  const sizes = masterRowSizes(resume, categoryId);
  if (sizes.length <= 1) return breaks;
  let at = 0;
  for (const size of sizes) {
    at += size;
    if (at >= count) break;
    breaks[at - 1] = true;
  }
  return breaks;
}

/**
 * Layout inputs for the selected skills (in the given order) grouped by category order. Used for
 * line budgets and for the resume view so both measure exactly what the PDF prints.
 */
export function buildSkillInputs(
  resume: MasterResume,
  selectedIds: string[],
  categoryOrder: string[] = resume.skillCategories.map((c) => c.id),
): (SkillCategoryInput & { skillIds: string[] })[] {
  const skillById = new Map(resume.skills.map((s) => [s.id, s]));
  const catById = new Map(resume.skillCategories.map((c) => [c.id, c]));
  const out: (SkillCategoryInput & { skillIds: string[] })[] = [];
  for (const categoryId of categoryOrder) {
    const cat = catById.get(categoryId);
    const ids = selectedIds.filter((id) => skillById.get(id)?.categoryId === categoryId);
    if (!cat || !ids.length) continue;
    out.push({
      categoryId,
      label: cat.label,
      role: categoryRole(cat),
      bulletStyle: cat.bulletStyle,
      names: ids.map((id) => skillById.get(id)!.name),
      breaks: cat.bulletStyle === "inline" ? rowBreaks(resume, categoryId, ids.length) : undefined,
      skillIds: ids,
    });
  }
  return out;
}
