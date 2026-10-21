import type { MasterResume } from "@/lib/schemas/resume";
import { SUMMARY_MAX_LINES, SKILLS_MAX_LINES } from "./constants";
import { countBulletLines, countWrappedLines } from "./measure";
import { COLUMN_WIDTH, SIZE_BODY } from "./constants";
import { formatSkillLine } from "./skill-line";

export type LineBudgets = {
  summaryMaxLines: number;
  skillsMaxLines: number;
  bullets: Record<string, number>;
  projects: Record<string, number>;
};

export function computeLineBudgets(resume: MasterResume): LineBudgets {
  const defaultSummary = resume.summaryFacts.map((f) => f.text).join(" ");
  const summaryMaxLines = Math.min(
    SUMMARY_MAX_LINES,
    countWrappedLines(defaultSummary, COLUMN_WIDTH, SIZE_BODY),
  );

  const bullets: Record<string, number> = {};
  for (const exp of resume.experience) {
    for (const f of exp.facts) {
      bullets[f.id] = countBulletLines(f.text);
    }
  }

  const projects: Record<string, number> = {};
  for (const p of resume.projects) {
    const text = p.facts.map((f) => f.text).join(" ");
    projects[p.id] = countWrappedLines(text, COLUMN_WIDTH, SIZE_BODY);
  }

  const skillLines = countSkillBlockLines(resume);
  const skillsMaxLines = Math.min(SKILLS_MAX_LINES, skillLines);

  return {
    summaryMaxLines: summaryMaxLines || SUMMARY_MAX_LINES,
    skillsMaxLines: skillsMaxLines || SKILLS_MAX_LINES,
    bullets,
    projects,
  };
}

/** Lines used by the skills block (category label + wrapped skill line per non-empty category). */
export function countSkillLines(categories: { categoryId: string; names: string[] }[]): number {
  let lines = 0;
  for (const cat of categories) {
    if (!cat.names.length) continue;
    lines += 1; // category label
    lines += countWrappedLines(formatSkillLine(cat.categoryId, cat.names), COLUMN_WIDTH, SIZE_BODY);
  }
  return lines;
}

function countSkillBlockLines(resume: MasterResume): number {
  return countSkillLines(
    resume.skillCategories.map((cat) => ({
      categoryId: cat.id,
      names: resume.skills.filter((s) => s.categoryId === cat.id).map((s) => s.name),
    })),
  );
}

export function maxCharsForLines(maxLines: number, fontSize: number = SIZE_BODY): number {
  return maxLines * charsPerLineApprox(fontSize);
}

function charsPerLineApprox(fontSize: number): number {
  return Math.floor(COLUMN_WIDTH / (fontSize * 0.52));
}
